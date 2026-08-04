# StatusPage (EC2 ASG + ALB + RDS) Cost Analysis Estimate Report

## Service Overview

StatusPage is a cloud-native status / incident dashboard on **EC2 Auto Scaling** behind an **Application Load Balancer**, with **RDS PostgreSQL** in isolated private data subnets. Release artifacts are stored in **S3** and pulled by instance user-data. Networking uses a 3-tier VPC with a **single NAT Gateway**. CI/CD uses GitHub Actions with OIDC.

## Pricing Model

- **ON DEMAND** pricing (pay-as-you-go) unless otherwise specified
- Standard configurations without Reserved Instances or Savings Plans
- Pricing sourced from the **AWS Pricing API** for `us-east-1` (retrieved August 2026)

## Assumptions

- Region: **us-east-1** (Terraform `aws_region` default)
- Always-on portfolio/dev stack matching Terraform defaults
- ASG: **desired=2, min=2, max=4** of **t3.micro** (Amazon Linux 2023)
- Target-tracking CPU policy at 50% (cost impact only if load scales toward max)
- **1 NAT Gateway**
- ALB always on; light traffic ≈ **1 LCU** average
- RDS PostgreSQL 15 **db.t3.micro** Single-AZ, **20 GB gp3**, `db_multi_az=false`
- **730 hours/month**
- S3 artifacts under 1 GB; Secrets Manager **1 secret**; CloudWatch Logs light (14-day retention)
- EBS: ~**8 GB gp3** root volume × 2 instances

## Limitations and Exclusions

- Heavy NAT data-processing charges
- Second NAT Gateway or Multi-AZ RDS
- WAF, ACM, CloudFront
- Reserved Instances / Savings Plans / Spot (ASG could use Spot but Terraform uses On Demand)
- GitHub Actions minutes
- Free Tier year-1 credits (not assumed)

## Unit Pricing Details (us-east-1)

| Service | Unit | Price (API) | Source |
|---------|------|-------------|--------|
| NAT Gateway | hour | **$0.045** | AmazonEC2 `NatGateway-Hours` |
| Application Load Balancer | ALB-hour | **$0.0225** | AWSELB `LoadBalancerUsage` |
| Application Load Balancer | LCU-hour | **$0.008** | AWSELB `LCUUsage` |
| Amazon EC2 Linux t3.micro | hour | **$0.0104** | AmazonEC2 Pricing API |
| Amazon RDS PostgreSQL db.t3.micro Single-AZ | hour | **$0.018** | AmazonRDS Pricing API |
| EBS gp3 | GB-month | **~$0.08** | Standard list (approx.) |
| RDS gp3 storage | GB-month | **~$0.115** | Standard list (approx.) |
| Amazon S3 Standard | GB-month | **$0.023** | Standard list |
| Secrets Manager | secret-month | **$0.40** | Standard list |

## Cost Calculation (monthly)

| Service | Usage | Calculation | Monthly Cost |
|---------|-------|-------------|-------------|
| NAT Gateway | 1 × 730 hrs | $0.045 × 730 | **$32.85** |
| Application Load Balancer | 730 hrs + ~1 LCU × 730 | ($0.0225 × 730) + ($0.008 × 730) | **$22.27** |
| EC2 (2 × t3.micro) | 1,460 instance-hrs | $0.0104 × 1,460 | **$15.18** |
| EBS root volumes | ~16 GB gp3 | 16 × $0.08 | **$1.28** |
| RDS PostgreSQL db.t3.micro | 730 hrs + 20 GB | ($0.018 × 730) + (20 × $0.115) | **$15.44** |
| S3 + Secrets Manager + CloudWatch | light | ~$0.05 + $0.40 + ~$1.00 | **~$1.45** |
| **Total (always-on)** | | | **~$88/month** |

### Cost share (idle / always-on)

| Driver | Approx. share |
|--------|----------------|
| NAT Gateway | ~37% |
| ALB | ~25% |
| EC2 + EBS | ~19% |
| RDS | ~17% |
| Other | ~2% |

## Cost Scaling with Usage

| Scenario | What changes | Est. monthly |
|----------|--------------|--------------|
| Lab / destroy when idle | Nearly $0 when torn down | **$0–5** |
| Portfolio always-on (defaults) | Table above | **~$88** |
| Load scales ASG to 4 × t3.micro | +2 instances (~$15) | **~$103** |
| Demo HA (2 NAT + Multi-AZ RDS) | +~$33 NAT + ~2× RDS | **~$135+** |

## Key Cost Factors

1. **NAT Gateway** dominates fixed cost (same pattern as FlagBoard).
2. **ALB** bills hourly with little traffic.
3. **EC2 is cheap at t3.micro** — compute is not the main driver compared to NAT/ALB/RDS.
4. ASG **max=4** is a soft ceiling; CPU target tracking can raise spend under load.

## Comparison note (vs FlagBoard Fargate)

At these defaults, StatusPage (~$88) and FlagBoard (~$90) are in the **same ballpark** because **NAT + ALB + RDS** dominate both. Compute choice (EC2 vs Fargate) is secondary for a small always-on portfolio stack.

## AWS Well-Architected Cost Optimization Recommendations

### Immediate

- Tear down when not demoing — NAT + ALB dominate idle spend
- Keep `db_multi_az=false` and single NAT (Terraform defaults)
- Lower `asg_desired_capacity` to 1 for personal labs if HA is not required

### Best practices

- Use VPC endpoints for S3 / Secrets Manager / CloudWatch Logs to reduce NAT data
- Set AWS Budgets alerts (e.g. $100/month)
- Consider Spot instances in the ASG for non-prod
- Watch ASG CPU target tracking so scaling to `max=4` is intentional

## Data Sources

- AWS Pricing API via MCP (`get_pricing`) for AmazonEC2 (t3.micro + NAT), AWSELB, AmazonRDS
- Terraform defaults in `infra/terraform/variables.tf`, `compute.tf`, `network.tf`, `data.tf`
- Attempted retrieval methods: Terraform project analysis + Pricing API filters (success)

## Disclaimer

Estimates only. Actual bills vary with traffic, NAT data processing, log ingestion, backups, and Free Tier eligibility. Validate with the AWS Pricing Calculator before production commitments.
