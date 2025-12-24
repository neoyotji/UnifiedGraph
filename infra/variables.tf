# Terraform Variables
# ------------------
# Güvenlik ve ortam yapılandırma değişkenleri

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "app_port" {
  description = "Application port for GraphQL API"
  type        = number
  default     = 4000
}

# SSH, GitHub Actions IP aralıkları için açık
# Not: GitHub Actions IP'leri dinamik, bu yüzden 0.0.0.0/0 kullanıyoruz
# Prod ortamında VPN veya bastion host önerilir
variable "allowed_ssh_cidr" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # GitHub Actions için açık
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type (Free Tier: t2.micro)"
  type        = string
  default     = "t2.micro"
}

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7  # Free Tier friendly
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "UnifiedGraph"
    ManagedBy   = "Terraform"
    Environment = "dev"
  }
}
