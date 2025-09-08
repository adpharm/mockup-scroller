# CDN Implementation Guide for mockup-scroller

## Overview
This guide outlines the remaining steps to implement CDN upload functionality for the mockup-scroller CLI tool. The infrastructure has been deployed with:
- S3 bucket: `mockup-scroller-cdn-outputs`
- Bunny CDN pull zone: `mockup-cdn-adpharm-digital`
- CDN URL: `https://mockup-cdn.adpharm.digital`

## Implementation Tasks

### 1. Configure DNS (Manual - One-time Setup)

**Status**: Required before CDN will work

Add a CNAME record in your DNS provider:
- **Type**: CNAME
- **Name**: `mockup-cdn`
- **Value**: `mockup-cdn-adpharm-digital.b-cdn.net`
- **TTL**: 300 seconds

Verify DNS propagation:
```bash
dig mockup-cdn.adpharm.digital
# Should resolve to mockup-cdn-adpharm-digital.b-cdn.net
```

### 2. Add S3 Upload Functionality to CLI

**Location**: `src/cli.ts` and `src/main.ts`

#### 2.1 Install AWS SDK
```bash
bun add @aws-sdk/client-s3
```

#### 2.2 Add CLI Flag
In `src/cli.ts`, add a new option:
```typescript
.option('--upload', 'Upload generated files to CDN')
```

#### 2.3 Create S3 Upload Module
Create `src/s3-upload.ts`:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';

const S3_BUCKET = 'mockup-scroller-cdn-outputs';
const CDN_URL = 'https://mockup-cdn.adpharm.digital';
const AWS_REGION = 'ca-central-1';

// Use the pharmer profile
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    // This will use the pharmer profile from AWS config
    // Alternatively, use fromIni() credential provider
  }
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
    // Optional: Set cache control headers
    CacheControl: 'public, max-age=31536000', // 1 year cache
  });
  
  await s3Client.send(command);
  
  return `${CDN_URL}/${s3Key}`;
}

export async function uploadOutputFiles(
  outputFiles: string[],
  upload: boolean
): Promise<{ local: string; cdn?: string }[]> {
  if (!upload) {
    return outputFiles.map(file => ({ local: file }));
  }
  
  const results = [];
  
  for (const file of outputFiles) {
    // Create S3 key from filename (preserve directory structure if needed)
    const s3Key = basename(file);
    
    try {
      const cdnUrl = await uploadToS3(file, s3Key);
      console.log(`✅ Uploaded: ${cdnUrl}`);
      results.push({ local: file, cdn: cdnUrl });
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
      results.push({ local: file });
    }
  }
  
  return results;
}
```

#### 2.4 Integrate with Main Processing
In `src/main.ts`, modify the `processOne` function:
```typescript
import { uploadOutputFiles } from './s3-upload';

export async function processOne(
  input: string,
  outDir: string,
  options: {
    noSegments?: boolean;
    screenHeight?: number;
    upload?: boolean; // Add this
  }
): Promise<void> {
  // ... existing processing code ...
  
  // After all files are generated, collect output paths
  const outputFiles = [
    gifPath,
    ...framedSegmentPaths,
    ...screenSegmentPaths
  ];
  
  // Upload if requested
  if (options.upload) {
    const results = await uploadOutputFiles(outputFiles, true);
    
    console.log('\n📤 CDN URLs:');
    results.forEach(result => {
      if (result.cdn) {
        console.log(`  ${result.cdn}`);
      }
    });
  }
}
```

### 3. Configure AWS Credentials

The CLI needs AWS credentials to upload to S3. Since you're using the `pharmer` profile:

#### Option A: Use AWS Profile (Recommended)
```typescript
import { fromIni } from '@aws-sdk/credential-providers';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: fromIni({ profile: 'pharmer' })
});
```

#### Option B: Environment Variables
Set these in `.env` or shell:
```bash
AWS_PROFILE=pharmer
AWS_REGION=ca-central-1
```

### 4. Test the Implementation

#### 4.1 Test Upload Manually First
```bash
# Create a test file
echo "test" > test.txt

# Upload to S3 using AWS CLI
aws s3 cp test.txt s3://mockup-scroller-cdn-outputs/test.txt \
  --profile pharmer \
  --region ca-central-1

# Test CDN access (after DNS propagates)
curl https://mockup-cdn.adpharm.digital/test.txt
```

#### 4.2 Test CLI Upload
```bash
# Run with upload flag
bun run dev --input "./test.png" --out "./out" --upload

# Expected output:
# ✅ Uploaded: https://mockup-cdn.adpharm.digital/test.framed.scroll.gif
# ✅ Uploaded: https://mockup-cdn.adpharm.digital/test.framed.1.png
# ✅ Uploaded: https://mockup-cdn.adpharm.digital/test.screen.1.png
```

### 5. Optional Enhancements

#### 5.1 Add Progress Bar for Uploads
```bash
bun add cli-progress
```

#### 5.2 Organize Files in S3
Instead of flat structure, organize by date or project:
```typescript
const s3Key = `${new Date().toISOString().split('T')[0]}/${basename(file)}`;
// Results in: 2025-09-07/mockup.framed.scroll.gif
```

#### 5.3 Add Metadata
```typescript
const command = new PutObjectCommand({
  // ... existing params ...
  Metadata: {
    'original-filename': basename(input),
    'generated-at': new Date().toISOString(),
    'mockup-scroller-version': '1.0.0'
  }
});
```

#### 5.4 Batch Upload with Concurrency
```typescript
import pLimit from 'p-limit';

const limit = pLimit(3); // Upload 3 files at a time

const uploadPromises = outputFiles.map(file => 
  limit(() => uploadToS3(file, basename(file)))
);

await Promise.all(uploadPromises);
```

### 6. Update Documentation

#### 6.1 Update README.md
Add section about CDN upload:
```markdown
## CDN Upload

Upload generated files to CDN for easy sharing:

\```bash
# Generate and upload to CDN
bun run dev --input "./mockup.png" --out "./out" --upload

# Access your files at:
# https://mockup-cdn.adpharm.digital/mockup.framed.scroll.gif
\```
```

#### 6.2 Update CHANGELOG.md
```markdown
## [2025-09-08]

### Added
- **CDN Upload Feature** - Upload generated files to S3/Bunny CDN with `--upload` flag
  - Automatic upload to S3 bucket
  - Files accessible via CDN URL
  - Progress indicators for uploads
```

### 7. Error Handling Considerations

1. **DNS Not Configured**: CDN URLs won't work until DNS propagates
2. **AWS Credentials**: Handle missing/expired credentials gracefully
3. **Network Issues**: Implement retry logic for failed uploads
4. **Large Files**: Consider multipart uploads for files > 100MB

### 8. Testing Checklist

- [ ] DNS configured and propagated
- [ ] Manual S3 upload works
- [ ] CDN URL accessible
- [ ] CLI with `--upload` flag works
- [ ] Error handling for missing credentials
- [ ] Multiple file batch upload works
- [ ] Progress indicators display correctly

## Infrastructure Reference

| Resource | Value |
|----------|-------|
| S3 Bucket | `mockup-scroller-cdn-outputs` |
| AWS Region | `ca-central-1` |
| CDN URL | `https://mockup-cdn.adpharm.digital` |
| Bunny Hostname | `mockup-cdn-adpharm-digital.b-cdn.net` |
| IAM User | `bunny-cdn-mockup-scroller` |
| AWS Profile | `pharmer` |

## Troubleshooting

### Issue: CDN URL returns 404
- **Cause**: DNS not configured or not propagated
- **Solution**: Add CNAME record and wait up to 48 hours for propagation

### Issue: Access Denied uploading to S3
- **Cause**: AWS credentials not configured
- **Solution**: Ensure `pharmer` profile is configured and authenticated

### Issue: Uploaded files not accessible via CDN
- **Cause**: Bunny CDN cache or S3 permissions
- **Solution**: 
  1. Check S3 object exists: `aws s3 ls s3://mockup-scroller-cdn-outputs/`
  2. Purge Bunny CDN cache if needed
  3. Verify IAM user has GetObject permission

## Next Steps After Implementation

1. Test with various file sizes
2. Monitor CDN bandwidth usage in Bunny dashboard
3. Set up CDN cache purging if needed
4. Consider adding signed URLs for private content
5. Implement cleanup policy for old uploads

## Estimated Implementation Time

- DNS Configuration: 5 minutes (plus propagation time)
- CLI Upload Feature: 2-3 hours
- Testing: 1 hour
- Documentation: 30 minutes

**Total: ~4-5 hours of development time**