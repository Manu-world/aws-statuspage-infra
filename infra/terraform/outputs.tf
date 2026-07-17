output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_url" {
  description = "HTTP URL for the status page"
  value       = "http://${aws_lb.main.dns_name}"
}

output "artifact_bucket" {
  description = "S3 bucket for release artifacts"
  value       = aws_s3_bucket.artifacts.bucket
}

output "asg_name" {
  description = "Auto Scaling Group name (for instance refresh)"
  value       = aws_autoscaling_group.app.name
}

output "github_deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC deploy"
  value       = aws_iam_role.github_deploy.arn
}

output "secrets_manager_secret_arn" {
  description = "Secrets Manager secret ARN used by EC2 user-data"
  value       = aws_secretsmanager_secret.app.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for app logs"
  value       = aws_cloudwatch_log_group.app.name
}

output "rds_endpoint" {
  description = "RDS endpoint (hostname:port) — private only"
  value       = aws_db_instance.main.endpoint
}
