#!/usr/bin/env bun
import { Command } from 'commander';
import { z } from 'zod';
import { execa } from 'execa';
import path from 'path';
import { main } from './main.js';

const argsSchema = z.object({
  input: z.string().min(1),
  out: z.string().min(1),
  speed: z.enum(['slow', 'normal', 'fast']).optional().default('normal'),
  segments: z.boolean().optional().default(true),  // Changed to positive flag
  screenHeight: z.number().optional().default(1600)
});

async function checkFfmpeg(): Promise<boolean> {
  try {
    await execa('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const program = new Command();
  
  program
    .name('mockup-scroller')
    .description('Frame Figma mockups in iPhone SE and create scrolling GIFs')
    .requiredOption('--input <glob-or-dir>', 'Input glob pattern or directory path')
    .requiredOption('--out <directory>', 'Output directory')
    .option('--speed <speed>', 'Scroll speed: slow, normal, fast (default: normal)', 'normal')
    .option('--no-segments', 'Disable generation of individual screen segments')
    .option('--screen-height <pixels>', 'Height of screen segments in pixels (default: 1600)', '1600')
    .parse(process.argv);

  const options = program.opts();

  // Convert screen-height string to number
  const processedOptions = {
    ...options,
    screenHeight: options.screenHeight ? parseInt(options.screenHeight, 10) : 1600
  };
  
  const parseResult = argsSchema.safeParse(processedOptions);
  if (!parseResult.success) {
    console.error('ERROR: Invalid arguments:', parseResult.error.format());
    process.exit(2);
  }

  const { input, out, speed, segments, screenHeight } = parseResult.data;
  
  const absInput = path.resolve(input);
  const absOut = path.resolve(out);

  console.log(`Bun version: ${Bun.version}`);
  
  const hasFfmpeg = await checkFfmpeg();
  if (!hasFfmpeg) {
    console.error('ERROR: ffmpeg not found. Please install ffmpeg and ensure it is on your PATH.');
    console.error('  macOS: brew install ffmpeg');
    console.error('  Ubuntu/Debian: sudo apt-get install -y ffmpeg');
    console.error('  Windows: winget install Gyan.FFmpeg');
    process.exit(3);
  }

  const ffmpegVersion = await execa('ffmpeg', ['-version']);
  const ffmpegFirstLine = ffmpegVersion.stdout.split('\n')[0];
  console.log(`ffmpeg version: ${ffmpegFirstLine}`);

  try {
    const exitCode = await main(absInput, absOut, speed, segments, screenHeight);
    process.exit(exitCode);
  } catch (error) {
    console.error('ERROR: Unhandled exception:', error);
    process.exit(4);
  }
}

run().catch(error => {
  console.error('ERROR: Fatal error:', error);
  process.exit(4);
});