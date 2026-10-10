variable "aws_region" {
  description = "AWS region for the CareBridge demo infrastructure."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short prefix used to name CareBridge resources."
  type        = string
  default     = "carebridge"
}

variable "instance_type" {
  description = "EC2 instance type; check current regional pricing before apply."
  type        = string
  default     = "t3.micro"
}

variable "ssh_cidr" {
  description = "Administrator public IPv4 address in CIDR notation, e.g. 203.0.113.10/32."
  type        = string
  validation {
    condition     = can(cidrnetmask(var.ssh_cidr)) && can(regex("/32$", var.ssh_cidr))
    error_message = "ssh_cidr must be a valid single IPv4 address in /32 notation."
  }
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair in the selected region."
  type        = string
}

variable "ami_id" {
  description = "Optional AMI ID. Leave blank to discover the latest Amazon Linux 2023 x86_64 AMI."
  type        = string
  default     = ""
}

variable "docker_compose_version" {
  description = "Docker Compose CLI plugin release used by EC2 bootstrap."
  type        = string
  default     = "v2.35.1"
}
