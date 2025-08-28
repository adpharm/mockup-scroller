import fs from 'fs/promises';
import path from 'path';
import { globby } from 'globby';

export async function resolveInputFiles(input: string): Promise<string[]> {
  const stat = await fs.stat(input).catch(() => null);
  
  let files: string[];
  if (stat && stat.isDirectory()) {
    const dirFiles = await fs.readdir(input);
    files = dirFiles
      .filter(f => f.endsWith('.png') && !f.startsWith('.'))
      .map(f => path.join(input, f));
  } else {
    files = await globby(input);
    files = files.filter(f => f.endsWith('.png'));
  }

  const validFiles: string[] = [];
  for (const file of files) {
    const size = await fs.stat(file).then(s => s.size).catch(() => 0);
    if (size >= 1024) {
      validFiles.push(file);
    }
  }

  return validFiles;
}

export async function verifyPng(filePath: string): Promise<boolean> {
  try {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(8);
    await handle.read(buffer, 0, 8, 0);
    await handle.close();

    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    return buffer.equals(pngSignature);
  } catch {
    return false;
  }
}

export function sanitizeBasename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function ensureDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function cleanupDirectory(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
  }
}

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
  }
}