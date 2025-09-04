import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { DeviceMeta } from './bezel/device-meta.js';
import { FrameRenderSpec, resizeToViewportWidth, cropFrame, cropSimple, compositeOnCanvas, loadMeta } from './image.js';
import { bezelSvgBuffer, maskSvgBuffer } from './bezel/device-meta.js';
import { ensureDirectory } from './fileio.js';

// Smoothness target: slower, smoother scrolling for better readability
const FPS = 30;            // keep fixed
const STATIC_FRAMES = 180; // unchanged for non-scrolling (6s at 30fps)
const PAUSE_FRAMES = 30;   // 1 second pause at beginning and end (30 frames each at 30fps)

// Speed configurations - consistent pixels per frame regardless of content height
const SPEED_CONFIG = {
  slow: {
    targetPpf: 15,      // 15 pixels per frame - always
    minFrames: 120      // Min 4s scrolling (plus pauses)
  },
  normal: {
    targetPpf: 21.5,    // 21.5 pixels per frame - always
    minFrames: 90       // Min 3s scrolling (plus pauses)
  },
  fast: {
    targetPpf: 30,      // 30 pixels per frame - always
    minFrames: 60       // Min 2s scrolling (plus pauses)
  }
};

function computeFrames(scrollable: number, speed: 'slow' | 'normal' | 'fast'): number {
  if (scrollable <= 0) return STATIC_FRAMES; // unchanged for static cases
  
  const config = SPEED_CONFIG[speed];
  
  // Calculate frames needed for consistent scroll speed
  // The speed (pixels per frame) stays constant, only duration changes
  const scrollFramesNeeded = Math.ceil(scrollable / config.targetPpf);
  
  // No max cap - let duration extend as needed for consistent speed
  // Only apply minimum to avoid too-short animations
  const scrollFrames = Math.max(config.minFrames - (PAUSE_FRAMES * 2), scrollFramesNeeded);
  
  // Total frames includes pause frames at beginning and end
  const totalFrames = scrollFrames + (PAUSE_FRAMES * 2);
  
  const actualPpf = scrollable / scrollFrames;
  const duration = totalFrames / FPS;
  
  // Verbose logging commented out for cleaner batch processing
  // console.log(`[${speed.toUpperCase()}] Scroll: ${scrollable}px in ${duration.toFixed(1)}s @ ${actualPpf.toFixed(1)}px/frame`);
  
  return totalFrames;
}

function computeYOffsetSequence(scrollable: number, frames: number): number[] {
  if (scrollable <= 0) {
    // All zeros; still emit STATIC_FRAMES so timing stays 6s
    return Array.from({ length: STATIC_FRAMES }, () => 0);
  }
  
  // Total frames includes pause frames
  const scrollFrames = frames - (PAUSE_FRAMES * 2);
  const offsets: number[] = [];
  
  // Add pause frames at the beginning (stay at top)
  for (let i = 0; i < PAUSE_FRAMES; i++) {
    offsets.push(0);
  }
  
  // Add scrolling frames
  for (let i = 0; i < scrollFrames; i++) {
    const progress = i / (scrollFrames - 1);
    offsets.push(Math.round(progress * scrollable));
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
  deviceMeta: DeviceMeta,
  speed: 'slow' | 'normal' | 'fast' = 'normal'
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
  
  // Calculate scrollable distance and adaptive frames
  const viewportHeight = deviceMeta.viewport.height;
  const scrollable = Math.max(0, contentHeight - viewportHeight);
  const framesCount = computeFrames(scrollable, speed);
  const yOffsets = computeYOffsetSequence(scrollable, framesCount);
  
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