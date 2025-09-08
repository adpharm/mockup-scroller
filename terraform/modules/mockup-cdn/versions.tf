# versions.tf - Provider requirements for mockup-cdn module

terraform {
  required_version = "~> 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.12"
    }
    bunnynet = {
      source  = "BunnyWay/bunnynet"
      version = "~> 0.9"
    }
  }
}