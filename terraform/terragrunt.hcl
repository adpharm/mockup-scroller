# terragrunt.hcl - Root configuration for mockup-scroller infrastructure

locals {
  aws_region  = "ca-central-1"
  aws_profile = "pharmer"

  common_tags = {
    Project   = "mockup-scroller"
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

# Get the bunny api key from AWS Secrets Manager (shared location)
data "aws_secretsmanager_secret" "bunny_api_key_metadata" {
  name = "shared/bunnynet"
}

data "aws_secretsmanager_secret_version" "bunny_api_key" {
  secret_id = data.aws_secretsmanager_secret.bunny_api_key_metadata.id
}

locals {
  bunny_api_key = jsondecode(data.aws_secretsmanager_secret_version.bunny_api_key.secret_string)["bunny_api_key"]
}

# Configure the BunnyNet Provider
provider "bunnynet" {
  api_key = local.bunny_api_key
}
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
    key     = "mockup-scroller/terraform.tfstate"
    region  = "${local.aws_region}"
    profile = "${local.aws_profile}"
    encrypt = true
  }
}
EOF
}

# Use the module directly
terraform {
  source = "./modules/mockup-cdn"
}

# Input variables
inputs = {
  bucket_name          = "mockup-scroller-cdn-outputs"
  bucket_region        = local.aws_region
  bunny_pull_zone_name = "mockup-cdn-adpharm-digital"
  cdn_domain           = "mockup-cdn.adpharm.digital"
  
  # Simple monitoring
  enable_monitoring    = true
  cost_alarm_threshold = 10 # Alert if monthly costs exceed $10

  tags = {
    Component = "cdn"
  }
}