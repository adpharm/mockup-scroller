import path from 'path';
import { resolveInputFiles, verifyPng, sanitizeBasename, ensureDirectory } from './fileio.js';
import { loadMeta } from './image.js';
import { renderAllFrames } from './animate.js';
import { encodeGif, writeStaticPreview, cleanupTemp } from './encode.js';
import { IPHONE_SE_PORTRAIT } from './bezel/device-meta.js';
import type { FrameRenderSpec } from './image.js';

async function processOne(inputPath: string, outDir: string, speed: 'slow' | 'normal' | 'fast', index: number, total: number): Promise<boolean> {
  const baseName = sanitizeBasename(inputPath);
  const startTime = Date.now();
  console.log(`[${index}/${total}] Processing: ${baseName}.png`);
  
  try {
    const isPng = await verifyPng(inputPath);
    if (!isPng) {
      console.log(`REJECTED: ${inputPath} - Not a valid PNG file`);
      return false;
    }

    const meta = await loadMeta(inputPath);
    
    if (meta.width < 300) {
      console.log(`REJECTED: ${inputPath} - Width ${meta.width} < 300px minimum`);
      return false;
    }
    
    if (meta.height < 500 || meta.height > 20000) {
      console.log(`REJECTED: ${inputPath} - Height ${meta.height} outside [500, 20000] range`);
      return false;
    }

    const baseName = sanitizeBasename(inputPath);
    
    const spec: FrameRenderSpec = {
      inputPath,
      baseName,
      outDir
    };

    const { framesDir, framesCount, fps } = await renderAllFrames(spec, IPHONE_SE_PORTRAIT, speed);
    
    await encodeGif(framesDir, baseName, outDir, fps);
    
    await writeStaticPreview(framesDir, baseName, outDir);
    
    await cleanupTemp(framesDir);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${index}/${total}] ✓ ${baseName} completed in ${elapsed}s`);
    return true;
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[${index}/${total}] ✗ ${baseName} failed (${elapsed}s): ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function main(input: string, outDir: string, speed: 'slow' | 'normal' | 'fast' = 'normal'): Promise<number> {
  const files = await resolveInputFiles(input);
  
  if (files.length === 0) {
    console.error('ERROR: No valid PNG files found matching the input pattern');
    return 2;
  }
  
  console.log(`Found ${files.length} PNG file(s) to process\n`);
  
  await ensureDirectory(outDir);
  
  let succeeded = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < files.length; i++) {
    const success = await processOne(files[i], outDir, speed, i + 1, files.length);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Summary: ${succeeded} succeeded, ${failed} failed (${totalTime}s total)`);
  
  if (failed > 0) {
    return 4;
  }
  
  return 0;
}