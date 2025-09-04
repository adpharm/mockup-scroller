import { execa } from 'execa';
import path from 'path';
import fs from 'fs/promises';
import { cleanupDirectory, cleanupFile } from './fileio.js';

export async function encodeGif(
  framesDir: string,
  baseName: string,
  outDir: string,
  fps: number = 30
): Promise<void> {
  const inputPattern = path.join(framesDir, `${baseName}.%06d.png`);
  const palettePath = path.join(outDir, `${baseName}.palette.png`);
  const outputPath = path.join(outDir, `${baseName}.framed.scroll.gif`);

  // Generate optimized palette - full colors but with smart stats
  await execa('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', inputPattern,
    '-vf', 'palettegen=stats_mode=diff',  // Better palette generation
    '-frames:v', '1',  // Generate single palette image
    palettePath
  ]);

  // Apply palette with file-size optimized settings
  await execa('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', inputPattern,
    '-i', palettePath,
    '-lavfi', 'scale=800:-1,paletteuse=dither=floyd_steinberg',  // Scale down to 80% width for smaller size
    outputPath
  ]);

  await cleanupFile(palettePath);
}

export async function cleanupTemp(
  framesDir: string,
  palettePath?: string
): Promise<void> {
  await cleanupDirectory(framesDir);
  if (palettePath) {
    await cleanupFile(palettePath);
  }
}