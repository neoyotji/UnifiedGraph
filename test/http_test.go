// Package test - HTTP Endpoint Terratest
// ---------------------------------------
// GraphQL endpoint erişilebilirliğini doğrular

package test

import (
	"fmt"
	"strings"
	"testing"
	"time"

	http_helper "github.com/gruntwork-io/terratest/modules/http-helper"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// TestGraphQLEndpointHealth - Health check endpoint'ini test eder
func TestGraphQLEndpointHealth(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Public IP'yi al
	publicIP := terraform.Output(t, terraformOptions, "server_public_ip")
	assert.NotEmpty(t, publicIP, "Server IP boş olmamalı")

	// Health check URL
	healthURL := fmt.Sprintf("http://%s:4000/health", publicIP)

	// Sunucunun başlaması için bekle ve health check yap
	maxRetries := 30
	timeBetweenRetries := 10 * time.Second

	http_helper.HttpGetWithRetry(
		t,
		healthURL,
		nil,
		200,
		`"status":"healthy"`,
		maxRetries,
		timeBetweenRetries,
	)
}

// TestGraphQLEndpointQuery - GraphQL query'sini test eder
func TestGraphQLEndpointQuery(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	publicIP := terraform.Output(t, terraformOptions, "server_public_ip")
	graphqlURL := fmt.Sprintf("http://%s:4000/graphql", publicIP)

	// Basit bir GraphQL query testi
	query := `{"query": "{ health { status timestamp } }"}`

	maxRetries := 30
	timeBetweenRetries := 10 * time.Second

	// Custom validation function
	validateFunc := func(status int, body string) bool {
		return status == 200 && strings.Contains(body, "healthy")
	}

	http_helper.HttpGetWithRetryWithCustomValidation(
		t,
		graphqlURL,
		nil,
		maxRetries,
		timeBetweenRetries,
		validateFunc,
	)
}

// TestSecurityHeaders - HTTP güvenlik başlıklarını test eder
func TestSecurityHeaders(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	publicIP := terraform.Output(t, terraformOptions, "server_public_ip")
	healthURL := fmt.Sprintf("http://%s:4000/health", publicIP)

	// Sunucunun hazır olmasını bekle
	maxRetries := 30
	timeBetweenRetries := 10 * time.Second

	// İlk olarak sunucunun ayağa kalkmasını bekle
	http_helper.HttpGetWithRetry(t, healthURL, nil, 200, `"status"`, maxRetries, timeBetweenRetries)

	// Helmet başlıklarını kontrol et
	resp, err := http_helper.HTTPDoE(t, "GET", healthURL, nil, nil, nil)
	assert.NoError(t, err, "HTTP isteği başarılı olmalı")
	
	// Security headers kontrolü
	expectedHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "SAMEORIGIN",
	}

	for header, expectedValue := range expectedHeaders {
		actualValue := resp.Header.Get(header)
		assert.Contains(t, actualValue, expectedValue, 
			"Header %s değeri '%s' içermeli, aldık: '%s'", header, expectedValue, actualValue)
	}
}

// TestRateLimiting - Rate limiting'in çalıştığını test eder
func TestRateLimiting(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../infra",
		Vars: map[string]interface{}{
			"environment": "test",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	publicIP := terraform.Output(t, terraformOptions, "server_public_ip")
	graphqlURL := fmt.Sprintf("http://%s:4000/graphql", publicIP)

	// Sunucunun hazır olmasını bekle
	healthURL := fmt.Sprintf("http://%s:4000/health", publicIP)
	http_helper.HttpGetWithRetry(t, healthURL, nil, 200, `"status"`, 30, 10*time.Second)

	// Rate limit tetiklenene kadar istek yap (100+ istek)
	gotRateLimited := false
	for i := 0; i < 150; i++ {
		resp, err := http_helper.HTTPDoE(t, "GET", graphqlURL, nil, nil, nil)
		if err == nil && resp.StatusCode == 429 {
			gotRateLimited = true
			break
		}
	}

	assert.True(t, gotRateLimited, "Rate limiting çalışmalı ve 429 döndürmeli")
}
