import sharp from 'sharp';
import { DeviceMeta } from './bezel/device-meta.js';

export interface LoadedImageMeta {
  width: number;
  height: number;
}

export interface FrameRenderSpec {
  inputPath: string;
  baseName: string;
  outDir: string;
}

export async function loadMeta(path: string): Promise<LoadedImageMeta> {
  const metadata = await sharp(path).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }
  return {
    width: metadata.width,
    height: metadata.height
  };
}

export async function resizeToViewportWidth(
  path: string,
  targetWidth: number = 750
): Promise<Buffer> {
  const resized = await sharp(path)
    .resize({ width: targetWidth, withoutEnlargement: false })
    .png()
    .toBuffer();
  return resized;
}

export async function cropFrame(
  contentBuf: Buffer,
  topY: number,
  viewportW: number,
  viewportH: number,
  maskSvgBuf: Buffer
): Promise<Buffer> {
  const cropped = await sharp(contentBuf)
    .extract({
      left: 0,
      top: topY,
      width: viewportW,
      height: viewportH
    })
    .toBuffer();

  const masked = await sharp(cropped)
    .composite([{
      input: maskSvgBuf,
      blend: 'dest-in'
    }])
    .png({
      compressionLevel: 6,  // Balanced compression
      quality: 85          // Slightly reduce quality for size
    })
    .toBuffer();

  return masked;
}

export async function compositeOnCanvas(
  frameContentBuf: Buffer,
  bezelPngBuf: Buffer,
  deviceMeta: DeviceMeta
): Promise<Buffer> {
  const canvas = sharp({
    create: {
      width: deviceMeta.canvas.width,
      height: deviceMeta.canvas.height,
      channels: 4,
      background: deviceMeta.backgroundColor
    }
  });

  const composite = await canvas
    .composite([
      {
        input: frameContentBuf,
        left: deviceMeta.viewport.x,
        top: deviceMeta.viewport.y
      },
      {
        input: bezelPngBuf,
        left: 0,
        top: 0
      }
    ])
    .png({
      compressionLevel: 6,  // Balanced compression (0-9)
      quality: 85          // Reduce quality slightly for smaller size
    })
    .toBuffer();

  return composite;
}