# AWS demo infrastructure

This Terraform configuration provisions the network and compute resources used by the optional CareBridge demo deployment:

- VPC, public subnet, internet gateway and route table
- Security group with SSH restricted to a supplied `/32` address and public HTTP ingress
- EC2 instance with encrypted gp3 root storage and IMDSv2 required
- S3 bucket for a static frontend website, with versioning and server-side encryption

## Prerequisites

- Terraform `>= 1.6.0, < 2.0.0`
- AWS CLI configured for the intended account
- An existing EC2 key pair in the selected region
- Your current public IPv4 address in `/32` CIDR notation

## Plan before applying

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars; do not use the example placeholders as real values.
terraform fmt -recursive
terraform init
terraform validate
terraform plan
```

Review the complete plan and current AWS pricing before running `terraform apply`. `t3.micro` does not guarantee that the deployment is free; pricing and free-tier eligibility vary by account, region and date. Applying this stack creates billable resources.

## After provisioning

Use the Terraform outputs to obtain the EC2 address and S3 bucket name. Follow the root [README](../../README.md) for the deployment sequence and [operations runbook](../../docs/OPERATIONS-RUNBOOK.md) for checks.

## Limitations

The S3 website and EC2 API use HTTP. The bucket policy allows public reads of the built frontend. This is intended for a non-sensitive demo, not production healthcare workloads. HTTPS, production secrets management, monitoring, tested backups and restore, and a security review are outside this stack's current scope.
