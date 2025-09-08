# variables.tf - Input variables for mockup-cdn module

variable "bucket_name" {
  description = "Name of the S3 bucket for mockup outputs"
  type        = string
}

variable "bucket_region" {
  description = "AWS region for the S3 bucket"
  type        = string
}

variable "bunny_pull_zone_name" {
  description = "Name for the Bunny CDN pull zone"
  type        = string
}

variable "cdn_domain" {
  description = "Custom domain for the CDN (e.g., mockup-cdn.adpharm.digital)"
  type        = string
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = false
}

variable "cost_alarm_threshold" {
  description = "Monthly cost threshold in USD for CloudWatch alarm"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}