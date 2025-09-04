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

export async function cropSimple(
  contentBuf: Buffer,
  topY: number,
  width: number,
  height: number,
  contentHeight?: number
): Promise<Buffer> {
  // Get the actual dimensions of the content if not provided
  const actualContentHeight = contentHeight ?? (await sharp(contentBuf).metadata()).height!;
  
  // Calculate the actual height we can extract
  const availableHeight = actualContentHeight - topY;
  const extractHeight = Math.min(height, availableHeight);
  
  // If we need to extract less than requested height, we'll need to pad
  const needsPadding = extractHeight < height;
  
  // Extract the available content
  const cropped = await sharp(contentBuf)
    .extract({
      left: 0,
      top: topY,
      width: width,
      height: extractHeight
    })
    .toBuffer();
  
  // If we need padding, extend the canvas to full height
  let finalBuffer = cropped;
  if (needsPadding) {
    finalBuffer = await sharp(cropped)
      .extend({
        bottom: height - extractHeight,
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for clean screens
      })
      .png({
        compressionLevel: 6,
        quality: 85
      })
      .toBuffer();
  }
  
  return finalBuffer;
}

export async function cropFrame(
  contentBuf: Buffer,
  topY: number,
  viewportW: number,
  viewportH: number,
  maskSvgBuf: Buffer,
  contentHeight?: number  // Optional, will fetch if not provided
): Promise<Buffer> {
  // Get the actual dimensions of the content if not provided
  const actualContentHeight = contentHeight ?? (await sharp(contentBuf).metadata()).height!;
  
  // Calculate the actual height we can extract
  const availableHeight = actualContentHeight - topY;
  const extractHeight = Math.min(viewportH, availableHeight);
  
  // If we need to extract less than viewport height, we'll need to pad
  const needsPadding = extractHeight < viewportH;
  
  // Extract the available content
  const cropped = await sharp(contentBuf)
    .extract({
      left: 0,
      top: topY,
      width: viewportW,
      height: extractHeight
    })
    .toBuffer();
  
  // If we need padding, extend the canvas to full viewport height
  let finalBuffer = cropped;
  if (needsPadding) {
    finalBuffer = await sharp(cropped)
      .extend({
        bottom: viewportH - extractHeight,
        background: { r: 245, g: 245, b: 247, alpha: 1 } // Match canvas background
      })
      .toBuffer();
  }

  const masked = await sharp(finalBuffer)
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