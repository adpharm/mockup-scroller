# monitoring.tf - CloudWatch monitoring for cost control

# CloudWatch alarm for S3 costs
resource "aws_cloudwatch_metric_alarm" "s3_cost_alarm" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "mockup-scroller-s3-cost"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = "86400" # 24 hours
  statistic           = "Maximum"
  threshold           = var.cost_alarm_threshold
  alarm_description   = "Alert when mockup-scroller S3 costs exceed $${var.cost_alarm_threshold}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    Currency = "USD"
  }

  tags = merge(var.tags, {
    Name = "mockup-scroller-cost-alarm"
  })
}

# CloudWatch dashboard for monitoring
resource "aws_cloudwatch_dashboard" "mockup_cdn" {
  count = var.enable_monitoring ? 1 : 0

  dashboard_name = "mockup-scroller-cdn"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/S3", "BucketSizeBytes", { stat = "Average", label = "Bucket Size" }],
            [".", "NumberOfObjects", { stat = "Average", label = "Object Count", yAxis = "right" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.bucket_region
          title   = "S3 Bucket Metrics"
          period  = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/S3", "AllRequests", { stat = "Sum", label = "Total Requests" }],
            [".", "GetRequests", { stat = "Sum", label = "GET Requests" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.bucket_region
          title   = "S3 Request Metrics"
          period  = 300
        }
      }
    ]
  })
}