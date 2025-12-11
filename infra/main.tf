terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1" # Free tier için genelde varsayılan
}

# 1. Güvenlik Grubu (Firewall)
resource "aws_security_group" "graphql_sg" {
  name        = "graphql-security-group"
  description = "Allow SSH and API traffic"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Prod ortamında kendi IP'nizi yazın
  }

  ingress {
    description = "GraphQL API"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 2. SSH Anahtarı Tanımlama (Ansible bağlanabilsin diye)
resource "aws_key_pair" "deployer" {
  key_name   = "graphql-deploy-key"
  public_key = file("~/.ssh/id_rsa.pub") 
}

# 3. EC2 Sunucusu
resource "aws_instance" "app_server" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS (us-east-1)
  instance_type = "t2.micro"              # Free tier
  key_name      = aws_key_pair.deployer.key_name
  security_groups = [aws_security_group.graphql_sg.name]

  tags = {
    Name = "UnifiedGraph-Gateway"
  }
}