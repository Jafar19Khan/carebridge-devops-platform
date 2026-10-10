output "instance_id" {
  description = "EC2 instance ID for operations and cleanup."
  value       = aws_instance.app.id
}

output "vpc_id" {
  description = "VPC created for this deployment."
  value       = aws_vpc.this.id
}

output "subnet_id" {
  description = "Public subnet used by the EC2 instance."
  value       = aws_subnet.public.id
}

output "public_ip" {
  description = "Public IPv4 address of the EC2 host."
  value       = aws_instance.app.public_ip
}

output "application_url" {
  description = "HTTP URL for the EC2 API reverse proxy; demo use only until HTTPS is configured."
  value       = "http://${aws_instance.app.public_ip}"
}

output "ssh_command" {
  description = "SSH command template for the EC2 host. Replace <key.pem> with your local key path."
  value       = "ssh -i <key.pem> ec2-user@${aws_instance.app.public_ip}"
}

output "security_group_id" {
  description = "Security group attached to the application host."
  value       = aws_security_group.app.id
}

output "frontend_bucket_name" {
  description = "S3 bucket for the static frontend demo."
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_website_endpoint" {
  description = "S3 static website endpoint; HTTP only, not suitable for sensitive healthcare data."
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}
