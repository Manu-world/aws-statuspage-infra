# StatusPage — AWS cloud infrastructure portfolio

Public service-status page with a **production-shaped AWS footprint**: VPC (public / private-app / private-data), ALB → ASG (EC2) → RDS Postgres, Secrets Manager, scoped IAM, and GitHub Actions CI/CD via **OIDC** (no long-lived AWS keys).

Phase 1 of the app is intentionally skeletal — enough for `/health`, migrations, and the deploy pipeline to be real. Admin/JWT auth ships later through the same pipeline.

---

## Architecture

```mermaid
flowchart TB
  subgraph gh [GitHub]
    Repo[Repo]
    CI[CI: lint build prisma tf]
    CD[CD on main: artifact]
  end

  subgraph aws [AWS]
    OIDC[OIDC deploy role]
    S3[S3 artifacts]
    ALB[ALB public]
    ASG[ASG private-app]
    RDS[RDS private-data]
    SM[Secrets Manager]
    CW[CloudWatch Logs]
  end

  Repo --> CI
  Repo --> CD
  CD -->|assume role| OIDC
  CD -->|upload zip| S3
  CD -->|instance refresh| ASG
  ALB -->|/health :3000| ASG
  ASG --> RDS
  ASG --> SM
  ASG --> S3
  ASG --> CW
```

| Tier | What |
|------|------|
| Edge | Application Load Balancer (HTTP :80), health check `GET /health` |
| Compute | Auto Scaling Group (min 2 / desired 2 / max 4), Amazon Linux 2023, `t3.micro`, private subnets |
| Data | RDS PostgreSQL 15, private-data subnets, **no IGW/NAT route**, `publicly_accessible = false` |
| Secrets | Secrets Manager (`DATABASE_URL`, `JWT_SECRET`) fetched at boot |
| Delivery | GitHub Actions → S3 `releases/<sha>.zip` + `latest.zip` → ASG instance refresh |

Security groups: internet → `alb-sg` (80/443) → `app-sg` (3000 from ALB only) → `db-sg` (5432 from app only).

---

## Repository layout

```
statuspage/
├── app/                    # Node 20 + TypeScript + Express + Prisma
├── deploy/                 # systemd unit + EC2 user-data
├── infra/terraform/        # VPC, ALB, ASG, RDS, IAM, OIDC, S3
├── .github/workflows/      # ci.yml + cd.yml
├── docker-compose.yml
└── .env.example
```

---

## Local development

```bash
cp .env.example .env
# If you run the app on the host (not in Compose), set:
# DATABASE_URL=postgresql://statuspage:statuspage@localhost:5432/statuspage?schema=public

docker compose up -d db

cd app
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run build
PORT=3000 npm start
```

Or full stack in Compose (app uses hostname `db`):

```bash
cp .env.example .env
docker compose up --build
```

Checks:

- `GET http://localhost:3000/health` → `{"status":"ok"}` (200) when Postgres is reachable
- `GET http://localhost:3000/` → public status page with seeded services/incidents
- `GET http://localhost:3000/api/services` / `api/incidents?status=active`

Seed admin credentials come from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` (auth UI is a later app phase).

---

## Terraform (infra)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit github_org / github_repo if needed
terraform init
terraform plan
# terraform apply   # you run this when ready
```

Important outputs after apply:

- `alb_dns_name` / `alb_url`
- `artifact_bucket`
- `asg_name`
- `github_deploy_role_arn`

**Cost note:** NAT Gateway + ALB + 2× t3.micro + RDS are not free-tier-zero. Destroy when idle: `terraform destroy`.

HTTPS / custom domain (ACM + ALB listener) is intentionally omitted — add when you have a domain.

---

## CI/CD

### CI (PRs + `dev`)

- Install, typecheck, build, `prisma validate`
- Postgres service container → migrate + seed + `/health` smoke
- `terraform fmt -check` + `validate`

### CD (`main`)

1. Build + zip release (`dist/`, `prisma/`, `package*.json`, `deploy/statuspage.service`)
2. Assume AWS role via **GitHub OIDC**
3. Upload `releases/<sha>.zip` and `releases/latest.zip` to the artifact bucket
4. `aws autoscaling start-instance-refresh` on the ASG

Until infra exists, CD **skips** AWS steps with a warning unless these are set:

| Kind | Name | Source after `terraform apply` |
|------|------|--------------------------------|
| Secret | `AWS_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` |
| Variable | `ARTIFACT_BUCKET` | `artifact_bucket` |
| Variable | `ASG_NAME` | `asg_name` |
| Variable | `AWS_REGION` | e.g. `us-east-1` |

Also create a GitHub Environment named `production` (referenced by `cd.yml`).

### Boot path on a new EC2 instance

`deploy/user-data.sh` (templated into the launch template):

1. Install Node 20 on AL2023
2. Pull `releases/latest.zip` from S3
3. Fetch secret → `/etc/statuspage/env`
4. `prisma migrate deploy`
5. Enable/start `statuspage.service` (listens on port **3000**)

---

## Auth note (next app phase)

JWT in an **httpOnly secure cookie**, short-lived access token, is the planned model so the app stays **stateless** across ASG instances. Not implemented in phase 1.

---

## What you still do manually

1. `terraform apply` and review the plan first
2. Wire GitHub Actions secrets/vars from Terraform outputs
3. Optional: ACM certificate + HTTPS listener + DNS
4. Optional: flip `db_multi_az = true` for HA RDS
5. Later: admin panel + JWT routes on top of this pipeline

---

## Design talking points (resume)

- Multi-tier VPC with **isolated data subnets** (no internet route)
- Least-privilege security groups and IAM (instance role scoped to one secret ARN + one log group + artifact prefix)
- GitHub OIDC deploy role — no static AWS keys in CI
- ALB health check is a **real DB probe**, not a stub
- Artifact + instance refresh delivery without baking AMI every commit
