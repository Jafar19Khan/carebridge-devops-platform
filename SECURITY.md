# Security notes

This repository is a learning and portfolio project. It is not approved for storing or processing real patient information.

## Before sharing or deploying

- Keep `.env`, Terraform state/plan files, SSH private keys and AWS credentials out of Git.
- Use unique passwords and a randomly generated JWT secret for each environment.
- Store deployed secrets outside the repository (for example, AWS Secrets Manager or a protected deployment environment).
- Restrict SSH ingress to the administrator's current public IP in `/32` notation.
- Keep PostgreSQL off public ingress; the Compose configuration does not publish its port to the host.
- Restrict CORS to the exact frontend origin.
- Review IAM permissions and the Terraform plan before applying it.

## Current limitations

- The example AWS design exposes HTTP endpoints and uses an S3 static website endpoint. It is for demonstration only; it is not suitable for sensitive healthcare data.
- The local payment flow is a demo. Do not accept real payments without an approved provider and the associated security/compliance work.
- Authentication and role checks require end-to-end security testing before any internet-facing use.
- Configure HTTPS, monitoring/alerting, tested backups and restore, dependency updates and a documented incident process before considering a production deployment.

If a credential is accidentally committed, removing it from the latest commit is not enough: revoke/rotate it and clean the repository history as appropriate.
