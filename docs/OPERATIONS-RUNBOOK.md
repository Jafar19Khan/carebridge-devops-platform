# Operations runbook

Commands below assume they are run from the repository root.

## Check service state

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml ps
```

The `db` and `backend` services should report healthy. The frontend should be running and healthy.

## Read logs

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=200 backend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=200 frontend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs --tail=200 db
```

## Restart services

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml restart
```

## Rebuild after code changes

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

## Stop the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

This keeps the named PostgreSQL volume. To reset the local database, run `docker compose -f docker-compose.yml -f docker-compose.local.yml down -v`; this deletes the database volume and its data. Do not use `-v` unless that is intentional.

## Basic smoke checks

```bash
curl http://localhost/health
curl http://localhost/api/specialties
```

The API routes may require authentication; use the health endpoint for a basic process/database check. Then manually test patient registration/login, doctor listing, appointment creation/cancellation and staff-only actions in the browser.

## AWS deployment checks

Before applying Terraform, verify the AWS account and region, inspect the plan, and review estimated costs. After deployment:

1. Confirm the EC2 instance is running and SSH is restricted to the expected `/32` address.
2. Confirm the backend and database containers are healthy on EC2.
3. Check `http://<EC2_PUBLIC_IP>/health`.
4. Build and publish the frontend to the Terraform-created S3 bucket.
5. Verify the browser origin matches `CORS_ORIGIN` and test the app workflows.
6. If deployment fails, inspect the EC2 Docker logs and Nginx error log before redeploying.

The current demo uses HTTP. Do not submit real patient information or payment details.
