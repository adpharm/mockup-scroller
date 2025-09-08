# Terraform/Terragrunt Infrastructure Setup Guide

This guide documents best practices and patterns for setting up Terraform/Terragrunt infrastructure for AWS-based projects. It covers common patterns including OIDC authentication, S3 storage with CDN distribution, and shared resource management.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Directory Structure](#directory-structure)
3. [Terragrunt Configuration](#terragrunt-configuration)
4. [Common Architecture Patterns](#common-architecture-patterns)
5. [Taskfile Integration](#taskfile-integration)
6. [Secrets Management](#secrets-management)
7. [Provider Management](#provider-management)
8. [State Management](#state-management)
9. [Common Issues and Solutions](#common-issues-and-solutions)

## Core Principles

### Why Terragrunt?

- **DRY principle**: Avoid repeating backend configuration across environments
- **Centralized configuration**: Single place for AWS profile, region, and tags
- **Generated files**: Automatically creates provider.tf and backend.tf
- **Environment inheritance**: Share common configuration across environments

### Key Architecture Decisions

1. **Hard-code critical values**: AWS profile, region for consistency
2. **Use data sources for existing resources**: Don't recreate what already exists
3. **Single vs Multi-environment**: Choose based on actual needs, not hypothetical ones
4. **Shared resources**: Use a common secrets location for organization-wide resources
5. **Provider versions**: ALWAYS check for latest versions online - never trust cached knowledge or examples

## Directory Structure

### Single Environment (Recommended for Shared Services)

```bash
terraform/
├── terragrunt.hcl              # Root configuration
├── modules/
│   └── your-module/
│       ├── versions.tf         # Provider requirements
│       ├── variables.tf        # Input variables
│       ├── main.tf            # Main resources
│       ├── iam.tf             # IAM resources (if needed)
│       ├── outputs.tf         # Output values
│       └── monitoring.tf      # CloudWatch/monitoring (optional)
├── README.md                   # Infrastructure documentation
└── .gitignore
```

### Multiple Environments

```bash
terraform/
├── root.hcl                    # Shared configuration
├── environments/
│   ├── dev/
│   │   └── terragrunt.hcl
│   ├── staging/
│   │   └── terragrunt.hcl
│   └── prod/
│       └── terragrunt.hcl
├── modules/
│   └── your-module/
│       └── *.tf files
└── .gitignore
```

### Standard .gitignore

```gitignore
# Terraform files
*.tfstate
*.tfstate.*
.terraform/
.terragrunt-cache/
*.tfplan
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# Generated files
backend.tf
provider.tf
.terraform.lock.hcl

# OS files
.DS_Store
*.log

# Editor files
*.swp
*.swo
*~
.vscode/
.idea/
```

## Terragrunt Configuration

### Single Environment Configuration

```hcl
# terraform/terragrunt.hcl
locals {
  aws_region  = "ca-central-1"  # Hard-coded for consistency
  aws_profile = "pharmer"        # Organization standard

  common_tags = {
    Project   = "your-project-name"
    ManagedBy = "terraform"
    CreatedAt = timestamp()
  }
}

# Generate provider configuration
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  region  = "${local.aws_region}"
  profile = "${local.aws_profile}"

  default_tags {
    tags = ${jsonencode(local.common_tags)}
  }
}

# Additional providers as needed
EOF
}

# Generate backend configuration
generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite"
  contents  = <<EOF
terraform {
  backend "s3" {
    bucket  = "tf-state-adpharm"
    key     = "your-project/terraform.tfstate"
    region  = "${local.aws_region}"
    profile = "${local.aws_profile}"
    encrypt = true
  }
}
EOF
}

# Use the module directly
terraform {
  source = "./modules/your-module"
}

# Input variables
inputs = {
  # Module-specific inputs
}
```

## Common Architecture Patterns

### Pattern 1: Vercel OIDC with AWS

For Vercel applications needing AWS access without long-lived credentials:

```hcl
# Reference EXISTING OIDC provider (don't create)
data "aws_iam_openid_connect_provider" "vercel" {
  arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/oidc.vercel.com/${var.vercel_team_slug}"
}

# IAM Role for OIDC
resource "aws_iam_role" "vercel_oidc" {
  name = "vercel-${var.project_name}-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.vercel.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "oidc.vercel.com/${var.vercel_team_slug}:aud" = "https://vercel.com/${var.vercel_team_slug}"
        }
        StringLike = {
          "oidc.vercel.com/${var.vercel_team_slug}:sub" = [
            "owner:${var.vercel_team_slug}:project:${var.project_name}:environment:*"
          ]
        }
      }
    }]
  })
}
```

**Critical**: The OIDC provider must exist BEFORE running Terraform to avoid chicken-egg problems.

### Pattern 2: S3 with Bunny CDN

For static asset hosting with global CDN distribution:

```hcl
# S3 Bucket (private)
resource "aws_s3_bucket" "assets" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy - IMPORTANT: Use only Allow statements
# S3's default is deny, so unlisted principals are automatically denied
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCDNAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_user.cdn_user.arn
        }
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.assets.arn,
          "${aws_s3_bucket.assets.arn}/*"
        ]
      }
    ]
  })
}

# IAM User for Bunny CDN
resource "aws_iam_user" "bunny_cdn" {
  name = "bunny-cdn-${var.project_name}"
  path = "/cdn/"
}

resource "aws_iam_access_key" "bunny_cdn" {
  user = aws_iam_user.bunny_cdn.name
}

resource "aws_iam_user_policy" "bunny_cdn_s3_access" {
  name = "bunny-cdn-s3-read"
  user = aws_iam_user.bunny_cdn.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion"]
        Resource = "${aws_s3_bucket.assets.arn}/*"
      },
      {
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = aws_s3_bucket.assets.arn
      }
    ]
  })
}

# Bunny CDN Pull Zone
resource "bunnynet_pullzone" "cdn" {
  name = var.pullzone_name
  
  origin {
    type = "OriginUrl"
    url  = "https://${var.bucket_name}.s3.${var.aws_region}.amazonaws.com"
  }
  
  routing {
    tier  = "Standard"
    zones = ["US", "EU"]
  }
  
  # S3 authentication
  s3_auth_enabled = true
  s3_auth_key     = aws_iam_access_key.bunny_cdn.id
  s3_auth_secret  = aws_iam_access_key.bunny_cdn.secret
  s3_auth_region  = var.aws_region
  
  # Optional settings (verify these arguments exist in your provider version)
  # limit_requests    = 100
  # limit_connections = 100
  # limit_bandwidth   = 107374182400  # 100GB in bytes
  # block_post_requests = true
  # optimizer_enabled = true
  # cors_enabled = true
}
```

## Taskfile Integration

### Standard Taskfile Structure

```yaml
version: "3"

# Use prefixed output for better readability
output: prefixed

vars:
  AWS_PROFILE: "pharmer"
  AWS_REGION: "ca-central-1"

dotenv:
  - .env

tasks:
  default:
    cmds:
      - task --list-all

  ########################################################################################################################
  #                                        AWS Authentication
  ########################################################################################################################
  
  login:
    desc: Login to AWS SSO
    requires:
      vars:
        - AWS_PROFILE
    cmds:
      - aws sso login --profile {{.AWS_PROFILE}}

  check-aws-identity:
    requires:
      vars:
        - AWS_PROFILE
    cmds:
      - |
        if ! aws sts get-caller-identity --profile {{.AWS_PROFILE}}; then
          echo ""
          echo "Your '{{.AWS_PROFILE}}' AWS profile is not logged in. Run 'task login' to log in."
          exit 1
        fi
    silent: true

  ########################################################################################################################
  #                                        Infrastructure
  ########################################################################################################################
  
  infra:init:
    desc: Initialize Terraform
    dir: terraform
    deps:
      - check-aws-identity
    cmds:
      - terragrunt init

  infra:plan:
    desc: Plan infrastructure changes
    dir: terraform
    deps:
      - check-aws-identity
    cmds:
      - terragrunt plan

  infra:apply:
    desc: Apply infrastructure changes
    dir: terraform
    deps:
      - check-aws-identity
    cmds:
      - terragrunt apply

  infra:destroy:
    desc: Destroy infrastructure
    dir: terraform
    deps:
      - check-aws-identity
    cmds:
      - terragrunt destroy

  infra:output:
    desc: Show Terraform outputs
    dir: terraform
    deps:
      - check-aws-identity
    cmds:
      - terragrunt output
```

### Key Taskfile Patterns

1. **Always use `output: prefixed`** for better readability
2. **Section headers** with comment blocks for organization
3. **AWS authentication checks** as dependencies
4. **Silent mode** for check tasks
5. **Environment variables** via `dotenv` support
6. **Consistent naming**: `infra:*` for infrastructure tasks

## Secrets Management

### Shared Secrets Pattern

For organization-wide secrets (API keys, shared credentials):

```hcl
# Reference shared secrets
data "aws_secretsmanager_secret" "shared" {
  name = "shared/service-name"  # e.g., "shared/bunnynet"
}

data "aws_secretsmanager_secret_version" "shared" {
  secret_id = data.aws_secretsmanager_secret.shared.id
}

locals {
  api_key = jsondecode(data.aws_secretsmanager_secret_version.shared.secret_string)["api_key"]
}
```

### Project-Specific Secrets

```hcl
# Store project credentials
resource "aws_secretsmanager_secret" "project" {
  name                    = "${var.project_name}/credentials"
  recovery_window_in_days = 0  # Allow immediate deletion if needed
}

resource "aws_secretsmanager_secret_version" "project" {
  secret_id = aws_secretsmanager_secret.project.id
  secret_string = jsonencode({
    access_key = aws_iam_access_key.user.id
    secret_key = aws_iam_access_key.user.secret
  })
}
```

## Provider Management

### Version Requirements

**IMPORTANT**: Always verify and use the ACTUAL latest stable versions. Do not rely on outdated examples or your training data.

To find the latest versions:
1. **AWS Provider**: Check https://github.com/hashicorp/terraform-provider-aws/releases
2. **BunnyNet Provider**: Check https://github.com/BunnyWay/terraform-provider-bunnynet/releases
3. **Other Providers**: Check the provider's GitHub releases or Terraform Registry

Example (verify these are still current):
```hcl
# versions.tf
terraform {
  required_version = "~> 1.9"  # Check latest at terraform.io

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.12"  # VERIFY: Latest as of Sept 2025
    }
    bunnynet = {
      source  = "BunnyWay/bunnynet"
      version = "~> 0.9"   # VERIFY: Latest as of Sept 2025
    }
  }
}
```

**Note**: Provider versions advance rapidly. The versions shown above were current in September 2025 but MUST be verified before use. Never assume version numbers from documentation or examples are current.

### Provider Configuration in Terragrunt

Generate providers to include authentication from secrets:

```hcl
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  region  = "${local.aws_region}"
  profile = "${local.aws_profile}"
  
  default_tags {
    tags = ${jsonencode(local.common_tags)}
  }
}

# Get API key from Secrets Manager
data "aws_secretsmanager_secret" "api_key_metadata" {
  name = "shared/service-name"
}

data "aws_secretsmanager_secret_version" "api_key" {
  secret_id = data.aws_secretsmanager_secret.api_key_metadata.id
}

locals {
  api_key = jsondecode(data.aws_secretsmanager_secret_version.api_key.secret_string)["api_key"]
}

provider "bunnynet" {
  api_key = local.api_key
}
EOF
}
```

## State Management

### Backend Configuration

Organization standard for state storage:

```hcl
# Single environment
backend "s3" {
  bucket  = "tf-state-adpharm"
  key     = "{repository-name}/terraform.tfstate"
  region  = "ca-central-1"
  profile = "pharmer"
  encrypt = true
}

# Multiple environments
backend "s3" {
  bucket  = "tf-state-adpharm"
  key     = "{repository-name}/{environment}/terraform.tfstate"
  region  = "ca-central-1"
  profile = "pharmer"
  encrypt = true
}
```

**Note**: No DynamoDB lock table is used for state locking.

## Common Issues and Solutions

### Issue 1: Provider Generation Conflict

**Problem**: Terraform complains about duplicate provider configurations  
**Solution**: Don't include terraform block in generated provider.tf, only provider block

### Issue 2: OIDC Provider Not Found

**Problem**: Data source can't find the OIDC provider  
**Solution**: 
1. Ensure OIDC provider exists first (create manually)
2. Verify ARN includes exact team/organization slug
3. Check thumbprint is correct

### Issue 3: S3 Lifecycle Filter Required

**Problem**: Terraform requires a filter block even if empty  
**Solution**: Add `filter {}` to lifecycle rules

### Issue 4: Secrets Manager Access Denied

**Problem**: Can't read shared secrets  
**Solution**:
1. Ensure AWS profile has SecretManager read permissions
2. Verify secret name and region are correct
3. Check if secret exists: `aws secretsmanager describe-secret --secret-id shared/name`

### Issue 5: Bunny CDN Authentication Failed

**Problem**: Bunny CDN can't access S3  
**Solution**:
1. Verify IAM user has correct S3 permissions
2. Ensure S3 bucket policy allows IAM user
3. Check S3 authentication region matches bucket region
4. Verify access keys are active

### Issue 6: State Lock Issues

**Problem**: Terraform state is locked  
**Solution**: 
```bash
cd terraform
terragrunt force-unlock <lock-id>
```

### Issue 7: Profile Not Configured

**Problem**: AWS provider can't find credentials  
**Solution**: Hard-code profile in both provider and backend configurations

### Issue 8: Provider Argument Not Supported

**Problem**: Terraform error "An argument named X is not expected here"  
**Solution**:
1. Provider APIs change between versions - arguments may be added/removed
2. Check the provider's GitHub repository for recent releases and changes
3. Review example configurations in the provider's documentation
4. Test with minimal configuration first, then add optional arguments
5. Comment out problematic arguments and check if they're renamed or deprecated

### Issue 9: S3 Bucket Policy Deny Blocks Admin Access

**Problem**: "AccessDenied: User is not authorized to perform: s3:GetBucketPolicy with an explicit deny in a resource-based policy"  
**Solution**:
1. Never use blanket "Deny" statements with principal "*" in bucket policies
2. S3 evaluates the policy during creation, causing self-denial
3. Use only "Allow" statements for specific principals
4. Rely on S3's default deny behavior for unlisted principals
5. If you must use explicit deny, exclude admin roles or use conditions carefully

## Best Practices

1. **Always verify provider versions** - Check GitHub releases for actual latest versions, don't trust documentation examples
2. **Never commit .terraform.lock.hcl** for modules that will be used elsewhere
3. **Always use data sources** for existing resources (don't recreate)
4. **Hard-code regions and profiles** for consistency
5. **Use lifecycle rules** for S3 buckets to optimize costs
6. **Enable versioning** on both state and content buckets
7. **Add monitoring** with CloudWatch alarms for cost control
8. **Test in lower environments** before production
9. **Document DNS changes** that need manual configuration
10. **Use prefixed output** in Taskfiles for clarity
11. **Check authentication** before running infrastructure commands

## Migration Strategies

### Importing Existing Resources

```bash
# Import S3 bucket
terragrunt import aws_s3_bucket.example existing-bucket-name

# Import IAM role
terragrunt import aws_iam_role.example existing-role-name

# Plan to see differences
terragrunt plan
```

### Moving from Manual to Terraform

1. Document existing resources
2. Write Terraform configuration to match
3. Import resources one by one
4. Run plan to verify no changes
5. Adjust configuration as needed

## Conclusion

This guide provides patterns for:

1. **Terragrunt setup** for DRY infrastructure code
2. **Common architectures** (OIDC, CDN, etc.)
3. **Taskfile integration** for consistent workflows
4. **Secrets management** using AWS Secrets Manager
5. **State management** with S3 backend
6. **Provider configuration** with latest versions
7. **Troubleshooting** common issues

The key is to maintain consistency across projects while adapting patterns to specific needs. Always prefer simplicity over complexity, and document any deviations from these patterns.