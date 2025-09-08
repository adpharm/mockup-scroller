import path from 'path';
import { resolveInputFiles, verifyPng, sanitizeBasename, ensureDirectory } from './fileio.js';
import { loadMeta } from './image.js';
import { renderAllFrames, generateSegments, generateScreenSegments } from './animate.js';
import { encodeGif, cleanupTemp } from './encode.js';
import { IPHONE_SE_PORTRAIT } from './bezel/device-meta.js';
import { uploadOutputFiles } from './s3-upload.js';
import type { FrameRenderSpec } from './image.js';

async function processOne(inputPath: string, outDir: string, generateSegmentFiles: boolean, screenHeight: number, upload: boolean, index: number, total: number): Promise<boolean> {
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

    // Generate screen segments (no bezel, square corners)
    const screenPaths = await generateScreenSegments(spec, screenHeight, generateSegmentFiles);
    
    // Generate framed segments (with bezel)
    const framedPaths = await generateSegments(spec, IPHONE_SE_PORTRAIT, generateSegmentFiles);
    
    // Generate animated frames for GIF
    const { framesDir, framesCount, fps } = await renderAllFrames(spec, IPHONE_SE_PORTRAIT);
    
    // Create animated GIF
    const gifPath = await encodeGif(framesDir, baseName, outDir, fps);
    
    // Clean up temporary frames
    await cleanupTemp(framesDir);
    
    // Upload to CDN if requested
    if (upload) {
      const allOutputFiles = [
        path.join(outDir, `${baseName}.framed.scroll.gif`),
        ...framedPaths,
        ...screenPaths
      ];
      
      // Extract the output folder name for S3 organization
      const s3FolderName = path.basename(outDir);
      const uploadResults = await uploadOutputFiles(allOutputFiles, s3FolderName);
      
      console.log('\n📤 CDN URLs:');
      uploadResults.forEach(result => {
        console.log(`  ${result.cdn}`);
      });
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Update console output based on segments generated
    console.log(`[${index}/${total}] ✓ ${baseName} completed in ${elapsed}s`);
    
    if (framedPaths.length > 0) {
      const framedList = framedPaths.length === 1
        ? `1 framed segment: ${baseName}.framed.1.png`
        : `${framedPaths.length} framed segments: ${baseName}.framed.1-${framedPaths.length}.png`;
      console.log(`    Generated ${framedList}`);
    }
    
    if (screenPaths.length > 0) {
      const screenList = screenPaths.length === 1
        ? `1 screen segment: ${baseName}.screen.1.png`
        : `${screenPaths.length} screen segments: ${baseName}.screen.1-${screenPaths.length}.png`;
      console.log(`    Generated ${screenList}`);
    }
    
    console.log(`    Generated scrolling animation: ${baseName}.framed.scroll.gif`);
    
    return true;
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[${index}/${total}] ✗ ${baseName} failed (${elapsed}s): ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function main(input: string, outDir: string, generateSegments: boolean = true, screenHeight: number = 1600, upload: boolean = false): Promise<number> {
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
    const success = await processOne(files[i], outDir, generateSegments, screenHeight, upload, i + 1, files.length);
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