import path from 'path';
import { resolveInputFiles, verifyPng, sanitizeBasename, ensureDirectory } from './fileio.js';
import { loadMeta } from './image.js';
import { renderAllFrames } from './animate.js';
import { encodeGif, writeStaticPreview, cleanupTemp } from './encode.js';
import { IPHONE_SE_PORTRAIT } from './bezel/device-meta.js';
import type { FrameRenderSpec } from './image.js';

async function processOne(inputPath: string, outDir: string, speed: 'slow' | 'normal' | 'fast'): Promise<boolean> {
  const absPath = path.resolve(inputPath);
  console.log(`PROCESSING: ${absPath}`);
  
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
    
    console.log(`DONE: ${baseName} (gif, png)`);
    return true;
    
  } catch (error) {
    const baseName = sanitizeBasename(inputPath);
    console.error(`ERROR: ${baseName} - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function main(input: string, outDir: string, speed: 'slow' | 'normal' | 'fast' = 'normal'): Promise<number> {
  const files = await resolveInputFiles(input);
  
  if (files.length === 0) {
    console.error('ERROR: No valid PNG files found matching the input pattern');
    return 2;
  }
  
  console.log(`Found ${files.length} PNG file(s) to process`);
  
  await ensureDirectory(outDir);
  
  let succeeded = 0;
  let failed = 0;
  
  for (const file of files) {
    const success = await processOne(file, outDir, speed);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }
  
  console.log(`\nProcessed: ${files.length} | Succeeded: ${succeeded} | Failed: ${failed}`);
  
  if (failed > 0) {
    return 4;
  }
  
  return 0;
}