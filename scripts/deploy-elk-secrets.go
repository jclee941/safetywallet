//go:build ignore

package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

const (
	colorRed    = "\033[0;31m"
	colorGreen  = "\033[0;32m"
	colorYellow = "\033[1;33m"
	colorNone   = "\033[0m"
)

func main() {
	auto := flag.Bool("auto", false, "Skip interactive confirmation prompts")
	help := flag.Bool("help", false, "Show usage information")

	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "ELK Production Deployment Script for SafetyWallet\n\n")
		fmt.Fprintf(flag.CommandLine.Output(), "Usage:\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  go run scripts/deploy-elk-secrets.go [--auto] [--help]\n")
		fmt.Fprintf(flag.CommandLine.Output(), "  ./deploy-elk-secrets [--auto] [--help]\n\n")
		fmt.Fprintf(flag.CommandLine.Output(), "Flags:\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	if *help {
		flag.Usage()
		return
	}

	if err := run(*auto); err != nil {
		fmt.Fprintf(os.Stderr, "%sError: %v%s\n", colorRed, err, colorNone)
		os.Exit(1)
	}
}

func run(auto bool) error {
	fmt.Println("==========================================")
	fmt.Println("SafetyWallet ELK Production Deployment")
	fmt.Println("==========================================")
	fmt.Println()

	printStep("Step 1: Verify Cloudflare authentication")
	fmt.Println("Make sure you're logged in to wrangler:")
	fmt.Println("  npx wrangler login")
	fmt.Println()
	if err := waitForEnter(auto); err != nil {
		return err
	}
	fmt.Println()

	printStep("Step 2: Set ELASTICSEARCH_URL secret")
	fmt.Println("This will prompt you to enter the Elasticsearch URL.")
	fmt.Println("Value: http://192.168.50.109:9200")
	fmt.Println()
	if err := runCommand("npx", "wrangler", "secret", "put", "ELASTICSEARCH_URL"); err != nil {
		return err
	}
	fmt.Println()

	printStep("Step 3: Set ELASTICSEARCH_API_KEY secret")
	fmt.Println("This will prompt you to enter the Elasticsearch API Key.")
	fmt.Println("Value from 1Password: [Retrieve from 1Password > 'SafetyWallet ELK' > 'API Key']")
	fmt.Println()
	if err := runCommand("npx", "wrangler", "secret", "put", "ELASTICSEARCH_API_KEY"); err != nil {
		return err
	}
	fmt.Println()

	printStep("Step 4: Verify secrets are set")
	if err := runCommand("npx", "wrangler", "secret", "list"); err != nil {
		return err
	}
	fmt.Println()

	printStep("Step 5: Deploy the Worker")
	fmt.Println("Deploying to production...")
	if err := runCommand("npx", "wrangler", "deploy"); err != nil {
		return err
	}
	fmt.Println()

	fmt.Printf("%s==========================================%s\n", colorGreen, colorNone)
	fmt.Printf("%sDeployment complete!%s\n", colorGreen, colorNone)
	fmt.Printf("%s==========================================%s\n", colorGreen, colorNone)
	fmt.Println()
	fmt.Println("Next steps:")
	fmt.Println("1. Trigger a test warning log to verify ELK connectivity")
	fmt.Println("2. Check Kibana (http://192.168.50.109:5601) for 'safetywallet-logs-*' indices")
	fmt.Println("3. Verify logs are appearing in the Discover tab")
	fmt.Println()
	fmt.Println("To test locally with dev environment:")
	fmt.Println("  cd apps/api")
	fmt.Println("  echo 'ELASTICSEARCH_API_KEY=[Retrieve from 1Password]' >> .dev.vars")
	fmt.Println("  npm run dev")

	return nil
}

func printStep(step string) {
	fmt.Printf("%s%s%s\n", colorYellow, step, colorNone)
}

func waitForEnter(auto bool) error {
	if auto {
		fmt.Println("[--auto enabled] Skipping confirmation prompt.")
		return nil
	}

	fmt.Print("Press Enter when ready to continue...")
	reader := bufio.NewReader(os.Stdin)
	if _, err := reader.ReadString('\n'); err != nil {
		if errors.Is(err, os.ErrClosed) {
			return fmt.Errorf("failed to read confirmation input: stdin closed")
		}
		return fmt.Errorf("failed to read confirmation input: %w", err)
	}
	return nil
}

func runCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("command failed: %s %s: %w", name, strings.Join(args, " "), err)
	}

	return nil
}
