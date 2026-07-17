provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(
      {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "terraform"
      },
      var.tags
    )
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 2)

  public_subnet_cidrs      = ["10.40.0.0/24", "10.40.1.0/24"]
  private_app_subnet_cidrs = ["10.40.10.0/24", "10.40.11.0/24"]
  private_db_subnet_cidrs  = ["10.40.20.0/24", "10.40.21.0/24"]
}
