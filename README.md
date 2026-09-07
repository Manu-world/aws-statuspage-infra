# StatusPage - AWS cloud infrastructure portfolio

Public service-status page with a **production-shaped AWS footprint**: VPC (public / private-app / private-data), ALB → ASG (EC2) → RDS Postgres, Secrets Manager, scoped IAM, and GitHub Actions CI/CD via **OIDC** (no long-lived AWS keys).

Includes a **stateless JWT admin panel** (httpOnly cookie) so you can manage services and incidents behind the same deploy pipeline.

## Docs

| Document | Description |
|----------|-------------|
| [Architecture diagram (draw.io)](docs/statuspage-architecture.drawio) | VPC 3-tier reference diagram (ALB → EC2 ASG → RDS) |
| [Cost analysis report](docs/cost-analysis-report.md) | Always-on us-east-1 estimate (~$88/mo) with Pricing API unit rates |

---

## Architecture
![Architecture Diagram](docs/architecture.png)

| Tier | What |
|------|------|
| Edge | Application Load Balancer (HTTP :80), health check `GET /health` |
| Compute | Auto Scaling Group (min 2 / desired 2 / max 4), Amazon Linux 2023, `t3.micro`, private subnets |
| Data | RDS PostgreSQL 15, private-data subnets, **no IGW/NAT route**, `publicly_accessible = false` |
| Secrets | Secrets Manager (`DATABASE_URL`, `JWT_SECRET`, seed admin creds) fetched at boot |
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

- `GET /health` → `{"status":"ok"}` (200)
- `GET /` → public status page
- `GET /login` → admin login (seed credentials from `.env`)
- `GET /admin` → dashboard (requires cookie after login)

---

## Auth and admin

### Design

- **JWT** signed with `JWT_SECRET`, **8 hour** expiry, payload `{ sub, email }`
- Stored in **httpOnly** cookie `statuspage_token` (`SameSite=Lax`, `path=/`)
- **No refresh-token store** - fully stateless across ASG instances
- `COOKIE_SECURE` env (default `false`) - keep false on HTTP ALB; set `true` after you add HTTPS/ACM
- Unauthenticated mutating APIs → **401**; unauthenticated `/admin` → redirect `/login`

### Routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | public (clears cookie) |
| GET | `/login` | public |
| GET | `/admin` | cookie |
| POST/PATCH | `/api/services`, `/api/services/:id` | cookie |
| POST/PATCH | `/api/incidents`, `/api/incidents/:id` | cookie |
| POST | `/api/incidents/:id/updates` | cookie |

### Seed modes

| Env | Behavior |
|-----|----------|
| `SEED_DEMO_DATA=true` (local/CI) | Upsert admin **and** reset demo services/incidents |
| `SEED_DEMO_DATA=false` (prod boot) | Upsert admin **only** - does not wipe live data |

---

## Terraform (infra)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# set seed_admin_email / seed_admin_password for real admin creds
terraform init
terraform plan
# terraform apply
```

Sensitive vars (override in `terraform.tfvars`, never commit real values):

- `seed_admin_email`
- `seed_admin_password`

Important outputs: `alb_url`, `artifact_bucket`, `asg_name`, `github_deploy_role_arn`

**Cost note:** NAT + ALB + 2× t3.micro + RDS are not free. `terraform destroy` when idle.

After changing secret fields, run `terraform apply`, then trigger a deploy/instance refresh so new user-data picks up seed env.

---

## CI/CD

### CI (PRs + `dev`)

- Install, typecheck, build, `prisma validate`
- Migrate + seed + `/health` + **login + create service** smoke
- `terraform fmt -check` + `validate`

### CD (`main`)

1. Build + zip release
2. OIDC assume deploy role
3. Upload `releases/<sha>.zip` and `releases/latest.zip`
4. ASG instance refresh

GitHub Environment **`production`** needs:

| Kind | Name | From |
|------|------|------|
| Secret | `AWS_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` |
| Variable | `ARTIFACT_BUCKET` | `artifact_bucket` |
| Variable | `ASG_NAME` | `asg_name` |
| Variable | `AWS_REGION` | e.g. `us-east-1` |

### Boot path (EC2 user-data)

1. Install Node 20
2. Pull `releases/latest.zip`
3. Secrets Manager → `/etc/statuspage/env`
4. `prisma migrate deploy`
5. `prisma db seed` (admin upsert; demo off in prod)
6. Start `statuspage.service` on port **3000**

First-time tip: if instances launch before any zip exists in S3, you get ALB **502** - see the [troubleshooting playbook](../docs/troubleshooting-playbook.md).

---

## What you still do manually

1. `terraform apply` (and again after seed-admin secret fields if upgrading an existing stack)
2. Wire GitHub Actions secrets/vars
3. Optional: ACM + HTTPS listener + set `COOKIE_SECURE=true` in the secret
4. Optional: `db_multi_az = true`

---

## Design talking points (resume)

- Multi-tier VPC with **isolated data subnets**
- Least-privilege SG chain and IAM (no wildcard resource ARNs on write paths)
- GitHub OIDC deploy - no static AWS keys in CI
- ALB health check is a **real DB probe**
- Stateless JWT cookie auth safe for multi-instance ASG
- Seed-on-boot without wiping production incident data
