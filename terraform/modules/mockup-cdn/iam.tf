# iam.tf - IAM user and policies for Bunny CDN access

# IAM user for Bunny CDN
resource "aws_iam_user" "bunny_cdn" {
  name = "bunny-cdn-mockup-scroller"
  path = "/cdn/"

  tags = merge(var.tags, {
    Name        = "bunny-cdn-mockup-scroller"
    Description = "IAM user for Bunny CDN to access mockup-scroller S3 bucket"
  })
}

# Access key for Bunny CDN user
resource "aws_iam_access_key" "bunny_cdn" {
  user = aws_iam_user.bunny_cdn.name
}

# IAM policy for S3 read access
resource "aws_iam_user_policy" "bunny_cdn_s3_access" {
  name = "bunny-cdn-s3-read-policy"
  user = aws_iam_user.bunny_cdn.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3Read"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetObjectMetadata",
          "s3:GetObjectVersionMetadata"
        ]
        Resource = "${aws_s3_bucket.mockup_outputs.arn}/*"
      },
      {
        Sid    = "AllowS3List"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.mockup_outputs.arn
      }
    ]
  })
}

# Store IAM credentials in AWS Secrets Manager for reference
resource "aws_secretsmanager_secret" "bunny_cdn_credentials" {
  name                    = "mockup-scroller/bunny-cdn-credentials"
  description             = "IAM credentials for Bunny CDN to access S3"
  recovery_window_in_days = 0 # Allow immediate deletion if needed

  tags = merge(var.tags, {
    Name = "mockup-scroller-bunny-cdn-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "bunny_cdn_credentials" {
  secret_id = aws_secretsmanager_secret.bunny_cdn_credentials.id
  secret_string = jsonencode({
    access_key_id     = aws_iam_access_key.bunny_cdn.id
    secret_access_key = aws_iam_access_key.bunny_cdn.secret
    user_arn          = aws_iam_user.bunny_cdn.arn
  })
}