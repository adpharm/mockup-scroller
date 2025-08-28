import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { DeviceMeta } from './bezel/device-meta.js';
import { FrameRenderSpec, resizeToViewportWidth, cropFrame, compositeOnCanvas, loadMeta } from './image.js';
import { bezelSvgBuffer, maskSvgBuffer } from './bezel/device-meta.js';
import { ensureDirectory } from './fileio.js';

// Smoothness target: slower, smoother scrolling for better readability
const FPS = 30;            // keep fixed
const STATIC_FRAMES = 180; // unchanged for non-scrolling (6s at 30fps)
const PAUSE_FRAMES = 30;   // 1 second pause at beginning and end (30 frames each at 30fps)

// Speed configurations
const SPEED_CONFIG = {
  slow: {
    targetPpf: 15,      // Slower scrolling
    minFrames: 180,     // Min 6s
    maxFrames: 360      // Max 12s
  },
  normal: {
    targetPpf: 21.5,    // Normal speed
    minFrames: 150,     // Min 5s
    maxFrames: 270      // Max 9s
  },
  fast: {
    targetPpf: 30,      // Faster scrolling
    minFrames: 90,      // Min 3s
    maxFrames: 180      // Max 6s
  }
};

function computeFrames(scrollable: number, speed: 'slow' | 'normal' | 'fast'): number {
  if (scrollable <= 0) return STATIC_FRAMES; // unchanged for static cases
  
  const config = SPEED_CONFIG[speed];
  
  // Calculate ideal frames for smooth scrolling based on speed
  const idealScrollFrames = Math.ceil(scrollable / config.targetPpf) + 1;
  
  // Apply min/max constraints for scrolling frames only
  const scrollFrames = Math.min(config.maxFrames - (PAUSE_FRAMES * 2), Math.max(config.minFrames - (PAUSE_FRAMES * 2), idealScrollFrames));
  
  // Total frames includes pause frames at beginning and end
  const totalFrames = scrollFrames + (PAUSE_FRAMES * 2);
  
  const pixelsPerFrame = scrollable / scrollFrames;
  const duration = totalFrames / FPS;
  
  // Verbose logging commented out for cleaner batch processing
  // console.log(`[${speed.toUpperCase()}] Scroll: ${scrollable}px over ${scrollFrames} frames + ${PAUSE_FRAMES*2} pause frames = ${totalFrames} total (${duration.toFixed(1)}s) @ ${pixelsPerFrame.toFixed(1)}px/frame`);
  
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
      maskSvg
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