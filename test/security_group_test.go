// Package test - Security Group Terratest
// ----------------------------------------
// Security Group kurallarını doğrular

package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// TestSecurityGroupRules - Security Group kurallarını test eder
func TestSecurityGroupRules(t *testing.T) {
	t.Parallel()

	awsRegion := "us-east-1"

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	// Test sonunda kaynakları temizle
	defer terraform.Destroy(t, terraformOptions)

	// Terraform Apply
	terraform.InitAndApply(t, terraformOptions)

	// Security Group ID'yi al
	securityGroupID := terraform.Output(t, terraformOptions, "security_group_id")
	assert.NotEmpty(t, securityGroupID, "Security Group ID boş olmamalı")

	// Security Group bilgilerini çek
	sg := aws.GetSecurityGroup(t, securityGroupID, awsRegion)

	// Test: SSH portu (22) açık mı?
	sshPortOpen := false
	for _, permission := range sg.IpPermissions {
		if *permission.FromPort == 22 && *permission.ToPort == 22 {
			sshPortOpen = true
			break
		}
	}
	assert.True(t, sshPortOpen, "SSH portu (22) açık olmalı")

	// Test: GraphQL portu (4000) açık mı?
	graphqlPortOpen := false
	for _, permission := range sg.IpPermissions {
		if *permission.FromPort == 4000 && *permission.ToPort == 4000 {
			graphqlPortOpen = true
			break
		}
	}
	assert.True(t, graphqlPortOpen, "GraphQL portu (4000) açık olmalı")

	// Test: Tehlikeli portlar kapalı mı?
	dangerousPorts := []int64{21, 23, 3306, 5432, 27017}
	for _, port := range dangerousPorts {
		portOpen := false
		for _, permission := range sg.IpPermissions {
			if permission.FromPort != nil && *permission.FromPort <= port && *permission.ToPort >= port {
				// 22, 443, 4000 haricinde portlar kapalı olmalı
				if port != 22 && port != 443 && port != 4000 {
					portOpen = true
				}
			}
		}
		assert.False(t, portOpen, "Tehlikeli port %d kapalı olmalı", port)
	}

	// Test: Egress kuralı var mı?
	assert.NotEmpty(t, sg.IpPermissionsEgress, "Egress kuralları tanımlı olmalı")
}

// TestSecurityGroupNames - SG naming convention kontrolü
func TestSecurityGroupNames(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	sgID := terraform.Output(t, terraformOptions, "security_group_id")
	
	// SG ID formatını kontrol et
	assert.Contains(t, sgID, "sg-", "Security Group ID 'sg-' ile başlamalı")
}
