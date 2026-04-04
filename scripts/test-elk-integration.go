//go:build ignore

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	colorRed    = "\033[0;31m"
	colorGreen  = "\033[0;32m"
	colorYellow = "\033[1;33m"
	colorReset  = "\033[0m"

	defaultELKHost = "192.168.50.109"
)

func main() {
	help := flag.Bool("help", false, "Show usage information")
	flag.Parse()

	if *help {
		printHelp()
		return
	}

	elkHost := os.Getenv("ELK_HOST")
	if elkHost == "" {
		elkHost = defaultELKHost
	}

	elasticsearchURL := fmt.Sprintf("http://%s:9200", elkHost)
	kibanaURL := fmt.Sprintf("http://%s:5601", elkHost)

	client := &http.Client{Timeout: 10 * time.Second}

	printHeader()

	if code := runTest1(client, elasticsearchURL); code != 0 {
		os.Exit(code)
	}
	runTest2(client, elasticsearchURL)
	runTest3(client, kibanaURL)
	runTest4(client, elasticsearchURL)

	printFooter(kibanaURL)
}

func printHelp() {
	fmt.Println("Usage: go run scripts/test-elk-integration.go [--help]")
	fmt.Println()
	fmt.Println("SafetyWallet ELK integration connectivity checks.")
	fmt.Println()
	fmt.Println("Environment variables:")
	fmt.Printf("  ELK_HOST                 ELK host (default: %s)\n", defaultELKHost)
	fmt.Println("  ELASTICSEARCH_API_KEY    Optional API key for auth validation")
}

func printHeader() {
	fmt.Println("==========================================")
	fmt.Println("SafetyWallet ELK Integration Test")
	fmt.Println("==========================================")
	fmt.Println()
}

func printFooter(kibanaURL string) {
	fmt.Printf("%s==========================================%s\n", colorGreen, colorReset)
	fmt.Printf("%sELK Test Complete%s\n", colorGreen, colorReset)
	fmt.Printf("%s==========================================%s\n", colorGreen, colorReset)
	fmt.Println()
	fmt.Println("Next steps:")
	fmt.Println("1. If all tests passed, trigger a test log from the API")
	fmt.Println("2. Wait 30-60 seconds for log indexing")
	fmt.Println("3. Re-run this script to verify indices appear")
	fmt.Printf("4. Open Kibana at %s and create an index pattern for 'safetywallet-logs-*'\n", kibanaURL)
}

func runTest1(client *http.Client, elasticsearchURL string) int {
	fmt.Printf("%sTest 1: Elasticsearch connectivity%s\n", colorYellow, colorReset)

	body, _, err := doRequest(client, http.MethodGet, elasticsearchURL+"/_cluster/health", "")
	if err != nil {
		fmt.Printf("  %s✗%s Cannot connect to Elasticsearch at %s\n", colorRed, colorReset, elasticsearchURL)
		fmt.Println()
		return 1
	}

	status := "unknown"
	var payload struct {
		Status string `json:"status"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Status != "" {
		status = payload.Status
	}

	fmt.Printf("  %s✓%s Elasticsearch is reachable (status: %s)\n", colorGreen, colorReset, status)
	fmt.Println()
	return 0
}

func runTest2(client *http.Client, elasticsearchURL string) {
	fmt.Printf("%sTest 2: Check for safetywallet indices%s\n", colorYellow, colorReset)

	body, _, err := doRequest(client, http.MethodGet, elasticsearchURL+"/_cat/indices/safetywallet*?h=index,docs.count", "")
	if err != nil {
		fmt.Printf("  %s⚠%s No safetywallet indices found yet (expected before first log)\n", colorYellow, colorReset)
		fmt.Println()
		return
	}

	text := strings.TrimSpace(string(body))
	if text == "" {
		fmt.Printf("  %s⚠%s No safetywallet indices found yet (expected before first log)\n", colorYellow, colorReset)
		fmt.Println()
		return
	}

	fmt.Printf("  %s✓%s Found safetywallet indices:\n", colorGreen, colorReset)
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fmt.Printf("    - %s\n", line)
	}
	fmt.Println()
}

func runTest3(client *http.Client, kibanaURL string) {
	fmt.Printf("%sTest 3: Kibana connectivity%s\n", colorYellow, colorReset)

	body, _, err := doRequest(client, http.MethodGet, kibanaURL+"/api/status", "")
	if err != nil {
		fmt.Printf("  %s✗%s Cannot connect to Kibana at %s\n", colorRed, colorReset, kibanaURL)
		fmt.Println()
		return
	}

	status := "unknown"
	var payload struct {
		Status struct {
			Overall struct {
				State string `json:"state"`
			} `json:"overall"`
		} `json:"status"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Status.Overall.State != "" {
		status = payload.Status.Overall.State
	}

	fmt.Printf("  %s✓%s Kibana is reachable (status: %s)\n", colorGreen, colorReset, status)
	fmt.Println()
}

func runTest4(client *http.Client, elasticsearchURL string) {
	fmt.Printf("%sTest 4: API Key validation%s\n", colorYellow, colorReset)

	apiKey := os.Getenv("ELASTICSEARCH_API_KEY")
	if apiKey == "" {
		fmt.Printf("  %s⚠%s ELASTICSEARCH_API_KEY not set, skipping auth test\n", colorYellow, colorReset)
		fmt.Println("      Set it with: export ELASTICSEARCH_API_KEY=your-api-key")
		fmt.Println()
		return
	}

	_, statusCode, err := doRequest(client, http.MethodGet, elasticsearchURL+"/_cluster/health", apiKey)
	if err != nil {
		fmt.Printf("  %s✗%s API Key validation failed (%v)\n", colorRed, colorReset, err)
		fmt.Println()
		return
	}

	if statusCode == http.StatusOK {
		fmt.Printf("  %s✓%s API Key is valid\n", colorGreen, colorReset)
	} else {
		fmt.Printf("  %s✗%s API Key validation failed (HTTP %d)\n", colorRed, colorReset, statusCode)
	}
	fmt.Println()
}

func doRequest(client *http.Client, method, url, apiKey string) ([]byte, int, error) {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, 0, err
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "ApiKey "+apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	if resp.StatusCode >= 400 {
		return body, resp.StatusCode, fmt.Errorf("http %d", resp.StatusCode)
	}

	return body, resp.StatusCode, nil
}
