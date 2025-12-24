// Package test - VPC Configuration Terratest
// ------------------------------------------
// VPC yapılandırmasını doğrular

package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// TestVPCConfiguration - VPC yapılandırmasını test eder
func TestVPCConfiguration(t *testing.T) {
	t.Parallel()

	awsRegion := "us-east-1"

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
			"vpc_cidr":    "10.0.0.0/16",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// VPC ID'yi al
	vpcID := terraform.Output(t, terraformOptions, "vpc_id")
	assert.NotEmpty(t, vpcID, "VPC ID boş olmamalı")

	// VPC bilgilerini çek
	vpc := aws.GetVpcById(t, vpcID, awsRegion)

	// Test: VPC doğru CIDR bloğuna sahip mi?
	assert.Equal(t, "10.0.0.0/16", *vpc.CidrBlock, "VPC CIDR bloğu 10.0.0.0/16 olmalı")

	// Test: DNS hostname'ler etkin mi?
	dnsHostnames := aws.IsVpcDnsHostnamesEnabled(t, vpcID, awsRegion)
	assert.True(t, dnsHostnames, "VPC DNS hostnames etkin olmalı")

	// Test: DNS support etkin mi?
	dnsSupport := aws.IsVpcDnsSupportEnabled(t, vpcID, awsRegion)
	assert.True(t, dnsSupport, "VPC DNS support etkin olmalı")
}

// TestSubnetConfiguration - Subnet yapılandırmasını test eder
func TestSubnetConfiguration(t *testing.T) {
	t.Parallel()

	awsRegion := "us-east-1"

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment":        "test",
			"public_subnet_cidr": "10.0.1.0/24",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Subnet ID'yi al
	subnetID := terraform.Output(t, terraformOptions, "subnet_id")
	assert.NotEmpty(t, subnetID, "Subnet ID boş olmamalı")

	// Subnet bilgilerini çek
	subnet := aws.GetSubnetById(t, subnetID, awsRegion)

	// Test: Subnet doğru CIDR bloğuna sahip mi?
	assert.Equal(t, "10.0.1.0/24", *subnet.CidrBlock, "Subnet CIDR bloğu 10.0.1.0/24 olmalı")

	// Test: Public IP auto-assign etkin mi?
	assert.True(t, *subnet.MapPublicIpOnLaunch, "Subnet public IP auto-assign etkin olmalı")
}

// TestVPCIsolation - VPC izolasyonunu test eder
func TestVPCIsolation(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	vpcID := terraform.Output(t, terraformOptions, "vpc_id")
	subnetID := terraform.Output(t, terraformOptions, "subnet_id")

	// Test: VPC ve Subnet ilişkili mi?
	assert.NotEqual(t, vpcID, subnetID, "VPC ve Subnet ID'leri farklı olmalı")
	assert.Contains(t, vpcID, "vpc-", "VPC ID 'vpc-' ile başlamalı")
	assert.Contains(t, subnetID, "subnet-", "Subnet ID 'subnet-' ile başlamalı")
}
