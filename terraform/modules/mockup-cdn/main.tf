# main.tf - S3 bucket configuration for mockup-scroller

# S3 Bucket for mockup outputs
resource "aws_s3_bucket" "mockup_outputs" {
  bucket = var.bucket_name
  
  tags = merge(var.tags, {
    Name = var.bucket_name
  })
}

# Enable versioning for data protection
resource "aws_s3_bucket_versioning" "mockup_outputs" {
  bucket = aws_s3_bucket.mockup_outputs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "mockup_outputs" {
  bucket = aws_s3_bucket.mockup_outputs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "mockup_outputs" {
  bucket = aws_s3_bucket.mockup_outputs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for CDN access
resource "aws_s3_bucket_cors_configuration" "mockup_outputs" {
  bucket = aws_s3_bucket.mockup_outputs.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = [
      "https://${var.cdn_domain}"
    ]
    expose_headers  = ["ETag", "Content-Length"]
    max_age_seconds = 3600
  }
}

# Bucket policy to allow only Bunny CDN IAM user
resource "aws_s3_bucket_policy" "mockup_outputs" {
  bucket = aws_s3_bucket.mockup_outputs.id
  policy = data.aws_iam_policy_document.bucket_policy.json
}

data "aws_iam_policy_document" "bucket_policy" {
  statement {
    sid    = "AllowBunnyCDNAccess"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_user.bunny_cdn.arn]
    }

    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion"
    ]

    resources = [
      "${aws_s3_bucket.mockup_outputs.arn}/*"
    ]
  }

  statement {
    sid    = "AllowBunnyCDNList"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_user.bunny_cdn.arn]
    }

    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation"
    ]

    resources = [
      aws_s3_bucket.mockup_outputs.arn
    ]
  }
}