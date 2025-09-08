import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromSSO } from '@aws-sdk/credential-providers';
import { readFile } from 'fs/promises';
import { basename } from 'path';

const S3_BUCKET = 'mockup-scroller-cdn-outputs';
const CDN_URL = 'https://mockup-cdn.adpharm.digital';
const AWS_REGION = 'ca-central-1';

// Initialize S3 client with SSO credentials
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: fromSSO({ profile: 'pharmer' })
});

export async function uploadToS3(localPath: string, s3Key: string): Promise<string> {
  const fileContent = await readFile(localPath);
  
  // Determine content type based on extension
  const contentType = localPath.endsWith('.gif') ? 'image/gif' : 'image/png';
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
    // Set cache control for CDN optimization
    CacheControl: 'public, max-age=31536000', // 1 year cache
  });
  
  await s3Client.send(command);
  
  return `${CDN_URL}/${s3Key}`;
}

export async function uploadOutputFiles(
  outputFiles: string[],
  s3FolderName: string
): Promise<{ local: string; cdn: string }[]> {
  const results: { local: string; cdn: string }[] = [];
  
  // Use the provided folder name for S3 organization
  const folderName = s3FolderName;
  
  for (const file of outputFiles) {
    // Create S3 key with folder organization
    const fileName = basename(file);
    const s3Key = `${folderName}/${fileName}`;
    
    try {
      console.log(`Uploading ${fileName}...`);
      const cdnUrl = await uploadToS3(file, s3Key);
      console.log(`✅ Uploaded: ${cdnUrl}`);
      results.push({ local: file, cdn: cdnUrl });
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
      throw error; // Block on failure as requested
    }
  }
  
  return results;
}