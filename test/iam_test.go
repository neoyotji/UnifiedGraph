// Package test - IAM Policy Terratest
// ------------------------------------
// IAM rol ve politikalarını doğrular

package test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// PolicyDocument - IAM policy yapısı
type PolicyDocument struct {
	Version   string      `json:"Version"`
	Statement []Statement `json:"Statement"`
}

// Statement - IAM policy statement yapısı
type Statement struct {
	Effect   string      `json:"Effect"`
	Action   interface{} `json:"Action"`
	Resource interface{} `json:"Resource"`
}

// TestIAMRoleExists - IAM rolünün var olduğunu test eder
func TestIAMRoleExists(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// IAM Role ARN'yi al
	roleARN := terraform.Output(t, terraformOptions, "iam_role_arn")
	
	// Test: Role ARN boş olmamalı
	assert.NotEmpty(t, roleARN, "IAM Role ARN boş olmamalı")
	
	// Test: ARN formatı doğru mu?
	assert.Contains(t, roleARN, "arn:aws:iam::", "IAM Role ARN doğru formatta olmalı")
	assert.Contains(t, roleARN, "role/", "IAM Role ARN 'role/' içermeli")
}

// TestIAMRoleLeastPrivilege - En az yetki prensibini test eder
func TestIAMRoleLeastPrivilege(t *testing.T) {
	t.Parallel()

	awsRegion := "us-east-1"

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment":            "test",
			"enable_cloudwatch_logs": true,
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	roleARN := terraform.Output(t, terraformOptions, "iam_role_arn")
	
	// Role adını ARN'den çıkar
	parts := strings.Split(roleARN, "/")
	roleName := parts[len(parts)-1]

	// Inline policy'leri al
	policies := aws.GetInlinePoliciesForRole(t, awsRegion, roleName)
	
	// Tehlikeli action'ları kontrol et
	dangerousActions := []string{
		"*",
		"iam:*",
		"s3:*",
		"ec2:*",
		"rds:*",
	}

	for policyName, policyDoc := range policies {
		var doc PolicyDocument
		err := json.Unmarshal([]byte(policyDoc), &doc)
		assert.NoError(t, err, "Policy JSON parse edilebilmeli: %s", policyName)

		for _, stmt := range doc.Statement {
			actions := getActionsAsStringSlice(stmt.Action)
			for _, action := range actions {
				for _, dangerous := range dangerousActions {
					assert.NotEqual(t, dangerous, action, 
						"Policy '%s' tehlikeli action içermemeli: %s", policyName, dangerous)
				}
			}
		}
	}
}

// getActionsAsStringSlice - Action'ları string slice'a çevirir
func getActionsAsStringSlice(action interface{}) []string {
	switch v := action.(type) {
	case string:
		return []string{v}
	case []interface{}:
		result := make([]string, len(v))
		for i, a := range v {
			result[i] = a.(string)
		}
		return result
	default:
		return []string{}
	}
}

// TestIAMRoleOnlyCloudWatchAccess - Sadece CloudWatch erişimi olduğunu test eder  
func TestIAMRoleOnlyCloudWatchAccess(t *testing.T) {
	t.Parallel()

	awsRegion := "us-east-1"

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment":            "test",
			"enable_cloudwatch_logs": true,
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	roleARN := terraform.Output(t, terraformOptions, "iam_role_arn")
	parts := strings.Split(roleARN, "/")
	roleName := parts[len(parts)-1]

	policies := aws.GetInlinePoliciesForRole(t, awsRegion, roleName)
	
	// CloudWatch logs policy var mı kontrol et
	hasCloudWatchPolicy := false
	for policyName, policyDoc := range policies {
		if strings.Contains(policyName, "cloudwatch") || strings.Contains(policyDoc, "logs:") {
			hasCloudWatchPolicy = true
			
			// CloudWatch resource kısıtlı mı?
			assert.Contains(t, policyDoc, "/unified-graph/", 
				"CloudWatch policy sadece /unified-graph/ log group'a erişim vermeli")
		}
	}
	
	assert.True(t, hasCloudWatchPolicy, "CloudWatch logs policy tanımlı olmalı")
}
