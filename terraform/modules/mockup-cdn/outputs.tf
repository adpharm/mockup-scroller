# outputs.tf - Output values for mockup-cdn module

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.mockup_outputs.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.mockup_outputs.arn
}

output "s3_bucket_region" {
  description = "Region of the S3 bucket"
  value       = var.bucket_region
}

output "cdn_url" {
  description = "CDN URL for accessing mockups"
  value       = "https://${var.cdn_domain}"
}

output "bunny_pullzone_id" {
  description = "Bunny CDN pull zone ID"
  value       = bunnynet_pullzone.mockup_cdn.id
}

output "bunny_pullzone_hostname" {
  description = "Bunny CDN hostname (b-cdn.net)"
  value       = "${var.bunny_pull_zone_name}.b-cdn.net"
}

output "bunny_custom_hostname" {
  description = "Custom hostname configured for Bunny CDN"
  value       = bunnynet_pullzone_hostname.mockup_cdn.name
}

output "iam_user_arn" {
  description = "ARN of the IAM user for Bunny CDN"
  value       = aws_iam_user.bunny_cdn.arn
}

output "iam_access_key_id" {
  description = "Access key ID for Bunny CDN (handle with care)"
  value       = aws_iam_access_key.bunny_cdn.id
  sensitive   = true
}

output "deployment_instructions" {
  description = "Instructions for completing the deployment"
  value = <<-EOT
    Deployment Instructions:
    ========================
    1. Ensure Bunny API key exists at shared/bunnynet:
       task infra:check-secrets

    2. Initialize and apply Terraform:
       cd terraform
       terragrunt init
       terragrunt apply

    3. Configure DNS (manually):
       - Add CNAME record: mockup-cdn.adpharm.digital → ${var.bunny_pull_zone_name}.b-cdn.net
       - TTL: 300 seconds

    4. Test the CDN:
       - Upload a test file to S3
       - Access via: https://${var.cdn_domain}/test-file.png

    5. CLI usage:
       bun run dev --input "./mockup.png" --out "./out" --upload
  EOT
}