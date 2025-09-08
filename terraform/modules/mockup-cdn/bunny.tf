# bunny.tf - Bunny CDN pull zone configuration

# Create the pull zone
resource "bunnynet_pullzone" "mockup_cdn" {
  name = var.bunny_pull_zone_name

  origin {
    type = "OriginUrl"
    url  = "https://${var.bucket_name}.s3.${var.bucket_region}.amazonaws.com"
  }

  routing {
    tier = "Standard"
    # US and EU zones for good coverage
    zones = ["US", "EU"]
  }

  # S3 authentication
  s3_auth_enabled = true
  s3_auth_key     = aws_iam_access_key.bunny_cdn.id
  s3_auth_secret  = aws_iam_access_key.bunny_cdn.secret
  s3_auth_region  = var.bucket_region

  # Rate limiting (reasonable for seldom-used service)
  limit_requests    = 100  # Max requests per second per IP
  limit_connections = 100  # Max connections per IP

  # Bandwidth limit: 100GB/month (plenty for seldom use)
  # 100GB = 107374182400 bytes
  # Cost: ~$1.00 at $0.01/GB
  limit_bandwidth = 107374182400

  # Security settings
  block_post_requests = true  # This is read-only CDN
  
  # Performance settings
  optimizer_enabled = true  # Enable image optimization
  
  # CORS headers
  cors_enabled = true
}

# Custom hostname configuration for the pull zone
resource "bunnynet_pullzone_hostname" "mockup_cdn" {
  pullzone    = bunnynet_pullzone.mockup_cdn.id
  name        = var.cdn_domain
  tls_enabled = true
  force_ssl   = true
}