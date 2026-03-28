// CI/CD Pipeline Debugger for SafetyWallet
// Simulates CI pipeline stages locally for debugging
package main

import (
	"fmt"
	"os"
	"os/exec"
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

// Print functions
func printHeader(msg string) {
	fmt.Printf("%s========================================%s\n", Blue, NC)
	fmt.Printf("%s%s%s\n", Blue, msg, NC)
	fmt.Printf("%s========================================%s\n", Blue, NC)
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

// RunCommand executes a command and returns success/failure
func RunCommand(name string, args ...string) bool {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run() == nil
}

// Validate stage
func runValidate() bool {
	printHeader("VALIDATE STAGE")

	fmt.Printf("\n%s→ Running linter...%s\n", Blue, NC)
	if RunCommand("npm", "run", "lint") {
		printSuccess("Lint passed")
	} else {
		printError("Lint failed")
		return false
	}

	fmt.Printf("\n%s→ Running typecheck...%s\n", Blue, NC)
	if RunCommand("npm", "run", "typecheck") {
		printSuccess("Typecheck passed")
	} else {
		printError("Typecheck failed")
		return false
	}

	fmt.Printf("\n%s→ Running guards...%s\n", Blue, NC)
	if RunCommand("go", "run", "scripts/check-anti-patterns.go") {
		printSuccess("Anti-pattern checks passed")
	} else {
		printError("Anti-pattern checks failed")
		return false
	}

	if RunCommand("npm", "run", "lint:naming") {
		printSuccess("Naming conventions passed")
	} else {
		printError("Naming conventions failed")
		return false
	}

	if RunCommand("node", "scripts/check-wrangler-sync.js") {
		printSuccess("Wrangler sync passed")
	} else {
		printError("Wrangler sync failed")
		return false
	}

	printSuccess("Validate stage completed")
	return true
}

// Test stage
func runTest() bool {
	printHeader("TEST STAGE")

	fmt.Printf("\n%s→ Running unit tests...%s\n", Blue, NC)
	if RunCommand("npm", "test") {
		printSuccess("Unit tests passed")
	} else {
		printError("Unit tests failed")
		return false
	}

	fmt.Printf("\n%s→ Running security audit...%s\n", Blue, NC)
	if RunCommand("npm", "audit", "--audit-level=critical") {
		printSuccess("Security audit passed")
	} else {
		printWarning("Security audit found issues (check manually)")
	}

	printSuccess("Test stage completed")
	return true
}

// Build stage
func runBuild() bool {
	printHeader("BUILD STAGE")

	fmt.Printf("\n%s→ Running build...%s\n", Blue, NC)
	if RunCommand("npm", "run", "build") {
		printSuccess("Build passed")
	} else {
		printError("Build failed")
		return false
	}

	printSuccess("Build stage completed")
	return true
}

// Full pipeline
func runFull() {
	printHeader("FULL CI PIPELINE (LOCAL SIMULATION)")

	startTime := time.Now()

	if !runValidate() {
		printError("Validate stage failed")
		os.Exit(1)
	}

	if !runTest() {
		printError("Test stage failed")
		os.Exit(1)
	}

	if !runBuild() {
		printError("Build stage failed")
		os.Exit(1)
	}

	duration := time.Since(startTime)

	printHeader("PIPELINE SUCCESS")
	fmt.Printf("%sAll stages completed in %v%s\n", Green, duration.Round(time.Second), NC)
}

// Debug specific job
func debugJob(job string) {
	switch job {
	case "lint":
		printHeader("DEBUGGING: lint")
		RunCommand("npm", "run", "lint", "--", "--debug")
	case "typecheck":
		printHeader("DEBUGGING: typecheck")
		RunCommand("npm", "run", "typecheck")
	case "test":
		printHeader("DEBUGGING: unit-test")
		RunCommand("npm", "test", "--", "--reporter=verbose")
	case "build":
		printHeader("DEBUGGING: build")
		RunCommand("npm", "run", "build")
	case "guards":
		printHeader("DEBUGGING: guards")
		RunCommand("go", "run", "scripts/check-anti-patterns.go", "--verbose")
		RunCommand("npm", "run", "lint:naming")
		RunCommand("node", "scripts/check-wrangler-sync.js")
	default:
		printError("Unknown job: " + job)
		fmt.Println("Available jobs: lint, typecheck, test, build, guards")
		os.Exit(1)
	}
}

// Usage prints help information
func Usage() {
	fmt.Println("CI/CD Pipeline Debugger for SafetyWallet")
	fmt.Println("")
	fmt.Println("Usage: ci-debug [command]")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  validate    Run validate stage (lint, typecheck, guards)")
	fmt.Println("  test        Run test stage (unit tests, security audit)")
	fmt.Println("  build       Run build stage")
	fmt.Println("  full        Run full pipeline (validate + test + build)")
	fmt.Println("  debug JOB   Debug specific job (lint|typecheck|test|build|guards)")
	fmt.Println("  help        Show this help message")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  ci-debug validate          # Run validation checks")
	fmt.Println("  ci-debug debug lint        # Debug lint failures")
	fmt.Println("  ci-debug full              # Run full pipeline")
}

func main() {
	// Check if running in CI
	if os.Getenv("CI") != "" {
		printError("This tool is meant for local debugging, not CI")
		os.Exit(1)
	}

	// Get command
	command := "help"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	switch command {
	case "validate":
		if !runValidate() {
			os.Exit(1)
		}
	case "test":
		if !runTest() {
			os.Exit(1)
		}
	case "build":
		if !runBuild() {
			os.Exit(1)
		}
	case "full":
		runFull()
	case "debug":
		if len(os.Args) < 3 {
			printError("Missing job name")
			fmt.Println("Usage: ci-debug debug JOB")
			fmt.Println("Available jobs: lint, typecheck, test, build, guards")
			os.Exit(1)
		}
		debugJob(os.Args[2])
	case "help", "--help", "-h":
		Usage()
	default:
		printError("Unknown command: " + command)
		Usage()
		os.Exit(1)
	}
}
