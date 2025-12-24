# Terraform Outputs
# -----------------
# Deployment ve monitoring için gerekli bilgiler

output "server_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.app_server.public_ip
}

output "server_public_dns" {
  description = "Public DNS of the EC2 instance"
  value       = aws_instance.app_server.public_dns
}

output "graphql_endpoint" {
  description = "GraphQL API endpoint URL"
  value       = "http://${aws_instance.app_server.public_ip}:${var.app_port}/graphql"
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "subnet_id" {
  description = "Public subnet ID"
  value       = aws_subnet.public.id
}

output "security_group_id" {
  description = "Security Group ID"
  value       = aws_security_group.graphql_sg.id
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name"
  value       = var.enable_cloudwatch_logs ? aws_cloudwatch_log_group.app_logs[0].name : "disabled"
}

output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.app_server.id
}

output "iam_role_arn" {
  description = "IAM Role ARN for EC2"
  value       = aws_iam_role.ec2_role.arn
}
