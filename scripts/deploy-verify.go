// Deployment Verification Tool for SafetyWallet
// Verifies deployment health after CI/CD deployment
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Colors for terminal output
const (
	Red    = "\033[0;31m"
	Green  = "\033[0;32m"
	Yellow = "\033[1;33m"
	Blue   = "\033[0;34m"
	NC     = "\033[0m"
)

// Config holds the verification configuration
type Config struct {
	APIBase         string
	Timeout         time.Duration
	Retries         int
	AdminToken      string
	CloudflareToken string
}

// Print functions
func printHeader(msg string) {
	fmt.Printf("%s=== %s ===%s\n", Blue, msg, NC)
}

func printSuccess(msg string) {
	fmt.Printf("%s✓ %s%s\n", Green, msg, NC)
}

func printError(msg string) {
	fmt.Printf("%s✗ %s%s\n", Red, msg, NC)
}

func printWarning(msg string) {
	fmt.Printf("%s⚠ %s%s\n", Yellow, msg, NC)
}

func printInfo(msg string) {
	fmt.Printf("%sℹ %s%s\n", Blue, msg, NC)
}

// HTTPGet makes an HTTP GET request and returns the response body
func HTTPGet(url string, timeout time.Duration, authToken string) (string, int, error) {
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Accept", "application/json")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, err
	}

	return string(body), resp.StatusCode, nil
}

// CheckAPIHealth verifies the public API health endpoint
func CheckAPIHealth(cfg Config) bool {
	printHeader("API Health Check")

	url := cfg.APIBase + "/api/health"
	printInfo("Checking: " + url)

	for i := 1; i <= cfg.Retries; i++ {
		body, _, err := HTTPGet(url, cfg.Timeout, "")
		if err == nil && strings.Contains(body, `"status":"healthy"`) {
			printSuccess("API is healthy")
			return true
		}

		if err != nil {
			printWarning(fmt.Sprintf("Request failed: %v", err))
		} else {
			printWarning(fmt.Sprintf("API returned unexpected response: %s", body))
		}

		if i < cfg.Retries {
			printInfo(fmt.Sprintf("Retry %d/%d...", i, cfg.Retries))
			time.Sleep(2 * time.Second)
		}
	}

	printError(fmt.Sprintf("API health check failed after %d attempts", cfg.Retries))
	return false
}

// CheckDeploymentHealth verifies the detailed health endpoint (requires auth)
func CheckDeploymentHealth(cfg Config) bool {
	printHeader("Deployment Health Check")

	url := cfg.APIBase + "/api/admin/monitoring/health"
	printInfo("Checking: " + url)

	if cfg.AdminToken == "" {
		printError("ADMIN_TOKEN not set - detailed health check required for deployment verification")
		printInfo("Set ADMIN_TOKEN environment variable to verify binding health")
		return false
	}

	failed := false
	for i := 1; i <= cfg.Retries; i++ {
		body, statusCode, err := HTTPGet(url, cfg.Timeout, cfg.AdminToken)
		if err == nil && statusCode == http.StatusOK {
			printSuccess("Deployment health endpoint accessible")
			lines := strings.Split(body, "\n")
			if len(lines) > 100 {
				lines = lines[:100]
			}
			fmt.Println(strings.Join(lines, "\n"))

			if strings.Contains(body, `"status":"healthy"`) {
				printSuccess("All bindings are healthy")
				return true
			}
			printError("Some bindings are unhealthy")
			fmt.Println(body)
			failed = true
			break
		}

		if i < cfg.Retries {
			printInfo(fmt.Sprintf("Retry %d/%d...", i, cfg.Retries))
			time.Sleep(2 * time.Second)
		}
	}

	if failed {
		return false
	}

	printError(fmt.Sprintf("Deployment health check failed after %d attempts", cfg.Retries))
	return false
}

// CheckSystemStatus verifies the system status endpoint
func CheckSystemStatus(cfg Config) bool {
	printHeader("System Status Check")

	url := cfg.APIBase + "/api/system/status"
	printInfo("Checking: " + url)

	body, _, err := HTTPGet(url, cfg.Timeout, "")
	if err != nil {
		printError("System status check failed: " + err.Error())
		return false
	}

	printSuccess("System status endpoint accessible")

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(body), &result); err == nil {
		if data, ok := result["data"].(map[string]interface{}); ok {
			if hasIssues, ok := data["hasIssues"].(bool); ok && hasIssues {
				printWarning("System has active issues")
				if notices, ok := data["notices"].([]interface{}); ok {
					for _, notice := range notices {
						fmt.Printf("  - %v\n", notice)
					}
				}
			} else {
				printSuccess("No system issues detected")
			}
		}
	}

	return true
}

// RunSmokeTests performs smoke tests on critical endpoints
func RunSmokeTests(cfg Config) bool {
	printHeader("Smoke Tests")

	failed := false

	// Test auth endpoint
	printInfo("Testing auth endpoint...")
	authURL := cfg.APIBase + "/api/auth/me"
	_, statusCode, _ := HTTPGet(authURL, cfg.Timeout, "")

	if statusCode == http.StatusUnauthorized {
		printSuccess("Auth endpoint responding correctly (401 as expected)")
	} else if statusCode == http.StatusOK {
		printWarning("Auth endpoint returned 200 (unexpected but not critical)")
	} else {
		printWarning(fmt.Sprintf("Auth endpoint response: HTTP %d", statusCode))
	}

	// Test public health
	printInfo("Testing public health...")
	_, _, err := HTTPGet(cfg.APIBase+"/api/health", cfg.Timeout, "")
	if err == nil {
		printSuccess("Public health endpoint OK")
	} else {
		printError("Public health endpoint failed: " + err.Error())
		failed = true
	}

	return !failed
}

// getCloudflareToken retrieves the Cloudflare API token with fallback chain
func getCloudflareToken() string {
	token := os.Getenv("CLOUDFLARE_API_TOKEN")
	if token != "" {
		return token
	}

	token = os.Getenv("CLOUDFLARE_API_TOKEN_API")
	if token != "" {
		return token
	}

	token = os.Getenv("CLOUDFLARE_API_TOKEN_WORKER")
	if token != "" {
		return token
	}

	token = os.Getenv("CLOUDFLARE_API_TOKEN_ADMIN")
	if token != "" {
		return token
	}

	token = os.Getenv("CLOUDFLARE_API_TOKEN_PURGE")
	if token != "" {
		return token
	}

	return os.Getenv("CF_API_TOKEN")
}

// CheckD1Migrations verifies D1 migration status using wrangler CLI
func CheckD1Migrations(cfg Config) bool {
	printHeader("D1 Migration Verification")
	printInfo("Note: D1 migration verification requires wrangler CLI access")

	token := getCloudflareToken()
	if token == "" {
		printError("CLOUDFLARE_API_TOKEN not set - D1 verification required")
		printInfo("Checked: CLOUDFLARE_API_TOKEN, CLOUDFLARE_API_TOKEN_API, CLOUDFLARE_API_TOKEN_WORKER,")
		printInfo("         CLOUDFLARE_API_TOKEN_ADMIN, CLOUDFLARE_API_TOKEN_PURGE, CF_API_TOKEN")
		return false
	}

	printInfo("Checking applied migrations...")

	// Find the project root
	exePath, err := os.Executable()
	if err != nil {
		printError("Could not determine executable path")
		return false
	}
	scriptsDir := filepath.Dir(exePath)
	projectRoot := filepath.Dir(scriptsDir)
	apiDir := filepath.Join(projectRoot, "apps", "api")

	cmd := exec.Command("npx", "wrangler", "d1", "migrations", "list", "safetywallet-db", "--remote", "--env=", "--config", "wrangler.toml")
	cmd.Dir = apiDir
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "CLOUDFLARE_API_TOKEN="+token)

	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	// Output first 20 lines
	lines := strings.Split(outputStr, "\n")
	if len(lines) > 20 {
		lines = lines[:20]
	}
	fmt.Println(strings.Join(lines, "\n"))

	if err != nil {
		printError("Could not verify D1 migrations:")
		if len(lines) > 10 {
			lines = lines[:10]
		}
		fmt.Println(strings.Join(lines, "\n"))
		return false
	}

	printSuccess("D1 migrations accessible")
	return true
}

// VerifyStaticAssets checks that static assets are accessible
func VerifyStaticAssets(cfg Config) bool {
	printHeader("Static Assets Verification")

	failed := false

	// Check Worker app
	printInfo("Checking Worker app...")
	_, statusCode, err := HTTPGet(cfg.APIBase+"/", cfg.Timeout, "")
	if err == nil && statusCode == http.StatusOK {
		printSuccess("Worker app accessible")
	} else {
		printError("Worker app not accessible")
		failed = true
	}

	// Check Admin app
	printInfo("Checking Admin app...")
	// Derive admin URL from API_BASE
	parsedURL, err := url.Parse(cfg.APIBase)
	if err != nil {
		printWarning("Could not parse API_BASE URL")
	} else {
		adminURL := fmt.Sprintf("https://admin.%s/", parsedURL.Host)
		_, statusCode, err = HTTPGet(adminURL, cfg.Timeout, "")
		if err == nil && statusCode == http.StatusOK {
			printSuccess("Admin app accessible")
		} else {
			printWarning("Admin app may not be accessible (check domain)")
		}
	}

	return !failed
}

// Usage prints help information
func Usage() {
	fmt.Println("Deployment Verification Tool for SafetyWallet")
	fmt.Println()
	fmt.Println("Usage: deploy-verify [options]")
	fmt.Println()
	fmt.Println("Options:")
	fmt.Println("  -a, --api URL      API base URL (default: https://safetywallet.jclee.me)")
	fmt.Println("  -t, --timeout SEC  Request timeout in seconds (default: 30)")
	fmt.Println("  -r, --retries N    Number of retries (default: 3)")
	fmt.Println("  -h, --help         Show this help")
	fmt.Println()
	fmt.Println("Environment Variables:")
	fmt.Println("  API_BASE               API base URL")
	fmt.Println("  TIMEOUT                Request timeout (seconds)")
	fmt.Println("  RETRIES                Number of retries")
	fmt.Println("  ADMIN_TOKEN            Admin JWT token for detailed health endpoint")
	fmt.Println("  CLOUDFLARE_API_TOKEN   For D1 migration verification")
}

func main() {
	// Get configuration from environment with defaults
	apiBase := os.Getenv("API_BASE")
	if apiBase == "" {
		apiBase = "https://safetywallet.jclee.me"
	}

	timeoutSec := 30
	if t := os.Getenv("TIMEOUT"); t != "" {
		if v, err := strconv.Atoi(t); err == nil {
			timeoutSec = v
		}
	}

	retries := 3
	if r := os.Getenv("RETRIES"); r != "" {
		if v, err := strconv.Atoi(r); err == nil {
			retries = v
		}
	}

	adminToken := os.Getenv("ADMIN_TOKEN")
	cloudflareToken := getCloudflareToken()

	// Parse flags
	flag.StringVar(&apiBase, "a", apiBase, "API base URL")
	flag.StringVar(&apiBase, "api", apiBase, "API base URL")
	timeoutFlag := flag.Int("t", timeoutSec, "Request timeout in seconds")
	timeoutLongFlag := flag.Int("timeout", timeoutSec, "Request timeout in seconds")
	retriesFlag := flag.Int("r", retries, "Number of retries")
	retriesLongFlag := flag.Int("retries", retries, "Number of retries")
	showHelp := flag.Bool("h", false, "Show help")
	helpLong := flag.Bool("help", false, "Show help")

	flag.Parse()

	if *showHelp || *helpLong {
		Usage()
		os.Exit(0)
	}

	// Use the long flag values if they were set (override short flags)
	if *timeoutLongFlag != timeoutSec {
		timeoutSec = *timeoutLongFlag
	}
	if *timeoutFlag != timeoutSec && *timeoutFlag != 30 {
		timeoutSec = *timeoutFlag
	}
	if *retriesLongFlag != retries {
		retries = *retriesLongFlag
	}
	if *retriesFlag != retries && *retriesFlag != 3 {
		retries = *retriesFlag
	}

	cfg := Config{
		APIBase:         apiBase,
		Timeout:         time.Duration(timeoutSec) * time.Second,
		Retries:         retries,
		AdminToken:      adminToken,
		CloudflareToken: cloudflareToken,
	}

	// Print configuration
	printHeader("SafetyWallet Deployment Verification")
	printInfo("API Base: " + cfg.APIBase)
	printInfo(fmt.Sprintf("Timeout: %ds", timeoutSec))
	printInfo(fmt.Sprintf("Retries: %d", retries))
	if cfg.AdminToken != "" {
		printInfo("Admin token: configured")
	} else {
		printInfo("Admin token: not configured")
	}
	fmt.Println()

	// Run checks
	failed := false

	if !CheckAPIHealth(cfg) {
		failed = true
	}
	fmt.Println()

	if !CheckSystemStatus(cfg) {
		failed = true
	}
	fmt.Println()

	if !RunSmokeTests(cfg) {
		failed = true
	}
	fmt.Println()

	if !VerifyStaticAssets(cfg) {
		failed = true
	}
	fmt.Println()

	if !CheckDeploymentHealth(cfg) {
		failed = true
	}
	fmt.Println()

	if !CheckD1Migrations(cfg) {
		failed = true
	}
	fmt.Println()

	// Summary
	printHeader("Verification Summary")
	if !failed {
		printSuccess("All critical checks passed ✓")
		printSuccess("Deployment is healthy and ready for traffic")
		os.Exit(0)
	} else {
		printError("Some checks failed ✗")
		printError("Please review the output above and investigate issues")
		os.Exit(1)
	}
}
