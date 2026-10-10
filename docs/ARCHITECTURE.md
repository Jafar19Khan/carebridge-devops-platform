# Architecture

## Local Compose setup

```text
Browser
  |
  v
Frontend container (Nginx :80)
  |  /api/*
  v
Express API (:4000)
  |
  v
PostgreSQL (:5432)
```

Compose places the services on a private network. The database port is not published to the host. The frontend Nginx container serves the compiled Vite app and proxies `/api/` requests to the backend, so local browser requests use the same origin.

## AWS demo setup

```text
Browser --HTTP--> S3 static website (compiled frontend)
   |
   +----HTTP----> EC2 public IP :80
                       |
                    Nginx
                       |
                  127.0.0.1:4000
                       |
                   Express API
                       |
                 PostgreSQL container
```

Terraform creates the VPC, public subnet, internet gateway, route table, security group, EC2 instance and S3 website bucket. The security group allows HTTP from the internet and SSH only from the configured `/32` address. PostgreSQL is not opened in the security group. The EC2 Compose override binds the API to host loopback; Nginx is the public API entry point.

The S3 bucket is configured for static website hosting and public object reads. That website endpoint is HTTP-only. It is a demo trade-off, not a production healthcare architecture. For a real deployment, put the frontend behind HTTPS (for example CloudFront with ACM), put the API behind HTTPS, and review bucket access, IAM, secrets, database hosting, backups and logging.

## Configuration

- `.env.example` configures local Compose services and seeded demo accounts.
- `.env.production.example` documents runtime settings for the EC2 backend. Copy it to `/opt/carebridge/.env` on the instance and replace every placeholder before deployment.
- `VITE_API_URL` is read at frontend build time. Leave it empty locally to use the `/api` proxy; set it to the API base URL when building for the S3 website.
- `CORS_ORIGIN` must exactly match the browser origin used by the frontend.

Do not commit environment files containing real secrets. Terraform state can contain infrastructure details and should be stored and protected accordingly.
