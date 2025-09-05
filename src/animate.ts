import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { DeviceMeta } from './bezel/device-meta.js';
import { FrameRenderSpec, resizeToViewportWidth, cropFrame, cropSimple, compositeOnCanvas, loadMeta } from './image.js';
import { bezelSvgBuffer, maskSvgBuffer } from './bezel/device-meta.js';
import { ensureDirectory } from './fileio.js';

// Frame configuration
const FPS = 30;            // keep fixed
const STATIC_FRAMES = 180; // unchanged for non-scrolling (6s at 30fps)
const PAUSE_FRAMES = 30;   // 1 second pause at beginning and end (30 frames each at 30fps)

// Human-like scroll configuration - easily tunable
interface SwipeConfig {
  distanceFactor: number;  // How far to scroll as % of viewport (0.4 = 40%)
  swipeFrames: number;     // How many frames for the swipe animation
  pauseFrames: number;     // How many frames to pause after swipe
}

// Configurable swipe pattern for human-like scrolling - smoother configuration
const SWIPE_PATTERN: SwipeConfig[] = [
  { distanceFactor: 0.50, swipeFrames: 15, pauseFrames: 15 },  // Smooth 50% swipe
  { distanceFactor: 0.48, swipeFrames: 14, pauseFrames: 16 },  // Slightly less distance
  { distanceFactor: 0.52, swipeFrames: 16, pauseFrames: 14 },  // Bit more distance
  { distanceFactor: 0.45, swipeFrames: 13, pauseFrames: 17 },  // Smaller scroll
  { distanceFactor: 0.53, swipeFrames: 17, pauseFrames: 15 },  // Slightly bigger push
];

// Ease-in-out cubic function for smoother acceleration and deceleration
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function computeHumanScrollOffsets(scrollable: number, viewportHeight: number): number[] {
  if (scrollable <= 0) {
    // All zeros; still emit STATIC_FRAMES so timing stays 6s
    return Array.from({ length: STATIC_FRAMES }, () => 0);
  }
  
  const offsets: number[] = [];
  let currentY = 0;
  let swipeIndex = 0;
  
  // Add pause frames at the beginning (stay at top)
  for (let i = 0; i < PAUSE_FRAMES; i++) {
    offsets.push(0);
  }
  
  // Generate human-like swipes until we reach the bottom
  while (currentY < scrollable) {
    const swipe = SWIPE_PATTERN[swipeIndex % SWIPE_PATTERN.length];
    
    // Calculate swipe distance (capped at remaining scroll distance)
    const targetDistance = viewportHeight * swipe.distanceFactor;
    const actualDistance = Math.min(targetDistance, scrollable - currentY);
    
    // Generate swipe frames with smooth ease-in-out animation
    const startY = currentY;
    for (let i = 0; i < swipe.swipeFrames; i++) {
      const t = i / (swipe.swipeFrames - 1);
      const easedProgress = easeInOutCubic(t);
      const yPos = Math.round(startY + actualDistance * easedProgress);
      offsets.push(yPos);
    }
    
    currentY = Math.round(currentY + actualDistance);
    
    // Only add pause if we're not at the bottom yet
    if (currentY < scrollable) {
      for (let i = 0; i < swipe.pauseFrames; i++) {
        offsets.push(currentY);
      }
    }
    
    swipeIndex++;
  }
  
  // Add pause frames at the end (stay at bottom)
  for (let i = 0; i < PAUSE_FRAMES; i++) {
    offsets.push(scrollable);
  }
  
  return offsets;
}

interface SegmentSpec {
  start: number;
  end: number;
}

function calculateSegments(contentHeight: number, viewportHeight: number): SegmentSpec[] {
  const OVERLAP = 100;
  const TRIVIAL_THRESHOLD = 0.2;
  
  const segments: SegmentSpec[] = [];
  let currentY = 0;
  
  while (currentY < contentHeight) {
    const segmentEnd = Math.min(currentY + viewportHeight, contentHeight);
    const remainingContent = contentHeight - currentY;
    
    // For last segment: skip if < 20% new content vs previous segment
    if (segments.length > 0 && remainingContent < viewportHeight * TRIVIAL_THRESHOLD) {
      break; // Skip this trivial last segment
    }
    
    segments.push({
      start: currentY,
      end: segmentEnd
    });
    
    // If we've covered all content, stop
    if (segmentEnd >= contentHeight) break;
    
    // Move to next segment with overlap
    currentY += viewportHeight - OVERLAP;
  }
  
  return segments;
}

export async function generateScreenSegments(
  spec: FrameRenderSpec,
  screenHeight: number = 1600,
  generateSegments: boolean = true
): Promise<string[]> {
  if (!generateSegments) {
    return [];
  }
  
  const screenWidth = 750; // Fixed width matching viewport
  
  const resizedContent = await resizeToViewportWidth(spec.inputPath, screenWidth);
  
  const resizedMeta = await sharp(resizedContent).metadata();
  const contentHeight = resizedMeta.height!;
  
  // Use same segment calculation logic but with custom height
  const segments = calculateSegments(contentHeight, screenHeight);
  const segmentPaths: string[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const topY = segment.start;
    
    // Use cropSimple for square corners, no masking
    const screenContent = await cropSimple(
      resizedContent,
      topY,
      screenWidth,
      screenHeight,
      contentHeight
    );
    
    const segmentPath = path.join(spec.outDir, `${spec.baseName}.screen.${i + 1}.png`);
    await fs.writeFile(segmentPath, screenContent);
    segmentPaths.push(segmentPath);
  }
  
  return segmentPaths;
}

export async function generateSegments(
  spec: FrameRenderSpec,
  deviceMeta: DeviceMeta,
  generateSegments: boolean = true
): Promise<string[]> {
  if (!generateSegments) {
    return [];
  }

  const bezelSvg = bezelSvgBuffer();
  const bezelPng = await sharp(bezelSvg)
    .resize(deviceMeta.canvas.width, deviceMeta.canvas.height)
    .png()
    .toBuffer();
  
  const maskSvg = maskSvgBuffer();
  
  const resizedContent = await resizeToViewportWidth(spec.inputPath, deviceMeta.viewport.width);
  
  const resizedMeta = await sharp(resizedContent).metadata();
  const contentHeight = resizedMeta.height!;
  const viewportHeight = deviceMeta.viewport.height;
  
  const segments = calculateSegments(contentHeight, viewportHeight);
  const segmentPaths: string[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const topY = segment.start;
    
    const maskedContent = await cropFrame(
      resizedContent,
      topY,
      deviceMeta.viewport.width,
      deviceMeta.viewport.height,
      maskSvg,
      contentHeight  // Pass content height to avoid redundant metadata calls
    );
    
    const frameBuffer = await compositeOnCanvas(
      maskedContent,
      bezelPng,
      deviceMeta
    );
    
    const segmentPath = path.join(spec.outDir, `${spec.baseName}.framed.${i + 1}.png`);
    await fs.writeFile(segmentPath, frameBuffer);
    segmentPaths.push(segmentPath);
  }
  
  return segmentPaths;
}

export async function renderAllFrames(
  spec: FrameRenderSpec,
  deviceMeta: DeviceMeta
): Promise<{ framesDir: string; framesCount: number; fps: number }> {
  const bezelSvg = bezelSvgBuffer();
  const bezelPng = await sharp(bezelSvg)
    .resize(deviceMeta.canvas.width, deviceMeta.canvas.height)
    .png()
    .toBuffer();
  
  const maskSvg = maskSvgBuffer();
  
  const resizedContent = await resizeToViewportWidth(spec.inputPath, deviceMeta.viewport.width);
  
  const resizedMeta = await sharp(resizedContent).metadata();
  const contentHeight = resizedMeta.height!;
  
  // Calculate scrollable distance and generate human-like scroll offsets
  const viewportHeight = deviceMeta.viewport.height;
  const scrollable = Math.max(0, contentHeight - viewportHeight);
  const yOffsets = computeHumanScrollOffsets(scrollable, viewportHeight);
  const framesCount = yOffsets.length;
  
  const framesDir = path.join(spec.outDir, `${spec.baseName}.frames`);
  await ensureDirectory(framesDir);
  
  // Render each frame using the adaptive offsets
  for (let i = 0; i < yOffsets.length; i++) {
    const topY = yOffsets[i];
    
    const maskedContent = await cropFrame(
      resizedContent,
      topY,
      deviceMeta.viewport.width,
      deviceMeta.viewport.height,
      maskSvg,
      contentHeight  // Pass content height to avoid redundant metadata calls
    );
    
    const frameBuffer = await compositeOnCanvas(
      maskedContent,
      bezelPng,
      deviceMeta
    );
    
    const frameNumber = i.toString().padStart(6, '0');
    const framePath = path.join(framesDir, `${spec.baseName}.${frameNumber}.png`);
    
    await fs.writeFile(framePath, frameBuffer);
  }
  
  return { framesDir, framesCount, fps: FPS };
}