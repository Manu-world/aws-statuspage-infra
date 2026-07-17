variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used for resource naming and tags"
  type        = string
  default     = "statuspage"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.40.0.0/16"
}

variable "app_port" {
  description = "Port the Node app listens on (ALB target group forwards here)"
  type        = number
  default     = 3000
}

variable "instance_type" {
  description = "EC2 instance type for the ASG launch template"
  type        = string
  default     = "t3.micro"
}

variable "asg_min_size" {
  type    = number
  default = 2
}

variable "asg_desired_capacity" {
  type    = number
  default = 2
}

variable "asg_max_size" {
  type    = number
  default = 4
}

variable "db_name" {
  type    = string
  default = "statuspage"
}

variable "db_username" {
  type    = string
  default = "statuspage"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ (false by default for cost; flip for HA)"
  type        = bool
  default     = false
}

variable "github_org" {
  description = "GitHub org or user that owns the repo (OIDC trust)"
  type        = string
  default     = "Manu-world"
}

variable "github_repo" {
  description = "GitHub repository name (OIDC trust)"
  type        = string
  default     = "aws-statuspage-infra"
}

variable "tags" {
  description = "Additional tags applied to all taggable resources"
  type        = map(string)
  default     = {}
}
