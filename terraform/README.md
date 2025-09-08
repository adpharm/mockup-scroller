# Terraform Infrastructure for mockup-scroller

This directory contains Terraform/Terragrunt configuration for the mockup-scroller CDN infrastructure.

## Architecture

```
S3 Bucket (private) → Bunny CDN Pull Zone → mockup-cdn.adpharm.digital
```

## Prerequisites

1. **AWS CLI** configured with `pharmer` profile
2. **Terragrunt** installed
3. **Terraform** installed
4. **Bunny CDN account** with API key stored at `shared/bunnynet`
5. **jq** for JSON parsing (optional but recommended)

## Quick Start

### 1. Verify Bunny API Key

The Bunny API key should already be stored in AWS Secrets Manager at `shared/bunnynet`:

```bash
# Check if the secret exists
task infra:check-secrets
```

### 2. Initialize Terraform

```bash
task infra:init
```

### 3. Review Infrastructure Plan

```bash
task infra:plan
```

### 4. Apply Infrastructure

```bash
task infra:apply
```

### 5. Configure DNS (Manual)

Add a CNAME record in your DNS provider:
- **Name**: `mockup-cdn.adpharm.digital`
- **Value**: `mockup-cdn-adpharm-digital.b-cdn.net`
- **TTL**: 300

### 6. View Outputs

```bash
task infra:show-cdn
```

## Resources Created

- **S3 Bucket**: `mockup-scroller-outputs` - Private storage for generated files
- **IAM User**: `bunny-cdn-mockup-scroller` - Read-only access for CDN
- **Bunny Pull Zone**: Connected to S3 with authentication
- **CloudWatch**: Cost monitoring alarm (triggers at $10/month)
- **Secrets**: Stores IAM credentials for reference

## Usage with CLI

Once infrastructure is deployed, use the `--upload` flag:

```bash
# Generate and upload to CDN
bun run dev --input "./mockup.png" --out "./out" --upload

# Access your file at:
# https://mockup-cdn.adpharm.digital/mockup.framed.scroll.gif
```

## Cost Estimates

- **S3 Storage**: ~$0.023/GB/month
- **Bunny CDN**: ~$0.01/GB bandwidth
- **Expected monthly**: < $1 for typical usage

## Maintenance

### Update Bunny API Key

The Bunny API key is managed at `shared/bunnynet` in AWS Secrets Manager. To update it:

```bash
aws secretsmanager put-secret-value \
  --secret-id shared/bunnynet \
  --secret-string '{"bunny_api_key":"new-key-here"}' \
  --region ca-central-1 \
  --profile pharmer
```

### View Current Infrastructure

```bash
task infra:outputs
```

### Destroy Infrastructure

```bash
task infra:destroy
```

## Troubleshooting

### Secret Not Found

If you see "Secret 'shared/bunnynet' not found", the shared Bunny API key needs to be created:

```bash
aws secretsmanager create-secret \
  --name shared/bunnynet \
  --secret-string '{"bunny_api_key":"your-key-here"}' \
  --region ca-central-1 \
  --profile pharmer
```

### CDN Not Working

1. Check DNS propagation (can take up to 48 hours)
2. Verify Bunny pull zone is active in Bunny dashboard
3. Check S3 bucket has files: `aws s3 ls s3://mockup-scroller-outputs/`
4. Review IAM permissions: `task infra:outputs`

### State Lock Issues

If Terraform state is locked:

```bash
cd terraform
terragrunt force-unlock <lock-id>
```

## Files

- `terragrunt.hcl` - Main configuration
- `modules/mockup-cdn/` - Terraform module
  - `main.tf` - S3 bucket configuration
  - `iam.tf` - IAM user and policies
  - `bunny.tf` - CDN pull zone
  - `monitoring.tf` - CloudWatch alarms
  - `outputs.tf` - Output values