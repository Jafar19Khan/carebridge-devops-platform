# CareBridge

CareBridge is a healthcare appointment demo built with React, Express and PostgreSQL. This repository contains the application, local Docker setup, CI checks and an optional AWS deployment using Terraform.

The AWS configuration is intended for a portfolio/demo environment. It currently uses HTTP for the public endpoints and must not be used with real patient information.

## Stack

- React and Vite
- Node.js and Express
- PostgreSQL
- Docker Compose and Nginx
- AWS EC2, VPC and S3
- Terraform
- GitHub Actions and Jenkins

## Repository layout

```text
.
├── backend/                 # Express API, SQL schema, seed script and tests
├── frontend/                # React/Vite application
├── deploy/                  # EC2/Nginx and S3 deployment scripts
├── infra/aws-ec2-s3/        # Optional Terraform stack
├── docs/                    # Architecture and operations notes
├── .github/workflows/       # CI and dependency audit workflows
├── docker-compose.yml       # Shared service definitions
├── docker-compose.local.yml # Local seed/configuration overrides
├── docker-compose.ec2.yml   # EC2 backend/database overrides
├── Jenkinsfile
└── SECURITY.md
```

## Run locally

### Requirements

- Docker Desktop with Docker Compose v2 (or Docker Engine + Compose plugin)
- Git

### 1. Configure environment

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Edit `.env` and replace the example database password, JWT secret and local demo account passwords. These values are for local use only; do not reuse them in AWS.

### 2. Validate and start

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.local.yml ps
```

Open `http://localhost`. The frontend is published on port 80 by default; set `APP_PORT` in `.env` if that port is already in use.

Check logs when a service is not healthy:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=200 backend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=200 frontend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=200 db
```

Stop the services and keep database data:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

To remove the local database volume as well, use `down -v`. This permanently deletes the local PostgreSQL data.

## Checks

Run the backend checks from the repository root:

```bash
npm --prefix backend run check
npm --prefix backend test
```

Build the frontend:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

The existing backend test file contains validation/slot-mode unit tests. These are not a substitute for testing login, role permissions, appointments and database behaviour through the running application.

GitHub Actions runs backend checks/tests, a frontend build, Compose configuration validation and a dependency audit. The Jenkinsfile provides a separate Docker-based validation pipeline. Review the Actions run after pushing; configuration in the repository alone does not prove a pipeline has passed.

## Optional AWS demo deployment

The Terraform stack is in `infra/aws-ec2-s3/`. It provisions a VPC, public subnet, internet gateway, security group, EC2 instance and an S3 static website bucket.

Before provisioning:

1. Configure AWS CLI credentials and confirm the target account and region.
2. Review current EC2, EBS, S3 and data-transfer pricing. Instance eligibility and pricing vary by account, region and date.
3. Copy `terraform.tfvars.example` to `terraform.tfvars` and set the existing EC2 key-pair name and your current public IPv4 address in `/32` notation.
4. Run `terraform fmt -recursive`, `terraform init`, `terraform validate` and `terraform plan`.
5. Read the full plan before running `terraform apply`.

The deployment is not a one-command production release. After provisioning, create the EC2 environment file from `.env.production.example`, deploy the backend with `deploy/ec2/deploy.sh`, configure Nginx with `deploy/ec2/configure-nginx.sh`, then build and upload the frontend using `deploy/s3/deploy.sh`. Follow `docs/ARCHITECTURE.md` and `docs/OPERATIONS-RUNBOOK.md` for the configuration boundary and checks.

The S3 website endpoint and EC2 Nginx endpoint use HTTP. Do not use them for real patient data or real payments. A real deployment needs HTTPS, tighter production controls, tested backups/restore, monitoring and a security review.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — request flow and AWS components
- [Operations runbook](docs/OPERATIONS-RUNBOOK.md) — common checks and recovery commands
- [Security notes](SECURITY.md) — secrets and deployment limitations

## License

See [LICENSE](LICENSE).
