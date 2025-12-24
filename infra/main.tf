# Terraform Backend & Provider Configuration
# Free Tier uyumlu altyapı

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}

# -------------------------------------------
# VPC - İzole Ağ Ortamı
# -------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.common_tags.Project}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.common_tags.Project}-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.common_tags.Project}-public-subnet"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.common_tags.Project}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# -------------------------------------------
# Security Group - Sıkılaştırılmış Firewall
# -------------------------------------------
resource "aws_security_group" "graphql_sg" {
  name        = "${var.common_tags.Project}-sg"
  description = "Security group for GraphQL API Gateway"
  vpc_id      = aws_vpc.main.id

  # SSH - GitHub Actions için açık (prod'da VPN/bastion önerilir)
  ingress {
    description = "SSH Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidr
  }

  # GraphQL API portu
  ingress {
    description = "GraphQL API"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS (gelecekte ALB/Nginx için)
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Tüm çıkış trafiğine izin ver
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.common_tags.Project}-sg"
  }
}

# -------------------------------------------
# IAM Role - En Az Yetki Prensibi
# -------------------------------------------
resource "aws_iam_role" "ec2_role" {
  name = "${var.common_tags.Project}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.common_tags.Project}-ec2-role"
  }
}

# CloudWatch Logs yazma yetkisi
resource "aws_iam_role_policy" "cloudwatch_logs" {
  count = var.enable_cloudwatch_logs ? 1 : 0
  name  = "cloudwatch-logs-policy"
  role  = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/unified-graph/*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.common_tags.Project}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# -------------------------------------------
# CloudWatch Log Group
# -------------------------------------------
resource "aws_cloudwatch_log_group" "app_logs" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/unified-graph/application"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.common_tags.Project}-logs"
  }
}

resource "aws_cloudwatch_log_group" "security_logs" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/unified-graph/security"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.common_tags.Project}-security-logs"
  }
}

# -------------------------------------------
# SSH Key Pair
# -------------------------------------------
resource "aws_key_pair" "deployer" {
  key_name   = "${var.common_tags.Project}-deploy-key"
  public_key = file("~/.ssh/id_rsa.pub")
}

# -------------------------------------------
# EC2 Instance - Free Tier
# -------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "app_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.deployer.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.graphql_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  # Root volume şifreleme
  root_block_device {
    volume_type           = "gp2"
    volume_size           = 8  # Free Tier: 30GB'a kadar
    encrypted             = true
    delete_on_termination = true
  }

  # Metadata güvenliği (IMDSv2 zorunlu)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"  # IMDSv2 zorunlu
    http_put_response_hop_limit = 1
  }

  tags = {
    Name        = "${var.common_tags.Project}-Gateway"
    Environment = var.environment
  }
}