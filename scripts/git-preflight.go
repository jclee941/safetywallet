//go:build ignore

package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func main() {
	if err := runPreflight(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runPreflight() error {
	// Step 1: Verify git remote configuration
	fmt.Println("[1/6] Verify git remote configuration")
	if err := runCmd("git", "remote", "-v"); err != nil {
		return fmt.Errorf("step 1 failed: %w", err)
	}

	// Step 2: Verify remote reachability
	fmt.Println("\n[2/6] Verify remote reachability")
	if err := runCmd("git", "ls-remote", "--symref", "origin", "HEAD"); err != nil {
		return fmt.Errorf("step 2 failed: %w", err)
	}
	if err := runCmd("git", "ls-remote", "--heads", "origin"); err != nil {
		return fmt.Errorf("step 2 failed: %w", err)
	}
	fmt.Println("origin reachable")

	// Step 3: Verify authentication (GitLab)
	fmt.Println("\n[3/6] Verify authentication")
	// Try glab (GitLab CLI) first, fall back to git credential check
	if err := runCmd("glab", "auth", "status"); err != nil {
		// glab not available, try git credential check
		fmt.Println("glab not available, checking git credentials...")
		if err := runCmd("git", "credential", "fill"); err != nil {
			// Fallback: just check if we can fetch
			fmt.Println("Note: Manual credential verification skipped. Ensure GitLab token is configured.")
		}
	} else {
		fmt.Println("glab auth ok")
	}

	// Step 4: Refresh remote tracking refs
	fmt.Println("\n[4/6] Refresh remote tracking refs")
	if err := runCmd("git", "fetch", "--prune", "origin"); err != nil {
		return fmt.Errorf("step 4 failed: %w", err)
	}
	fmt.Println("fetch/prune ok")

	// Step 5: Verify upstream tracking
	fmt.Println("\n[5/6] Verify upstream tracking")
	currentBranch, err := getCurrentBranch()
	if err != nil {
		return fmt.Errorf("step 5 failed: %w", err)
	}
	if err := runCmd("git", "rev-parse", "--abbrev-ref", "@{upstream}"); err != nil {
		return fmt.Errorf("no upstream for %s.\nSet upstream with: git push -u origin %s", currentBranch, currentBranch)
	}
	if err := runCmd("git", "status", "-sb"); err != nil {
		return fmt.Errorf("step 5 failed: %w", err)
	}

	// Step 6: Dry-run push
	fmt.Println("\n[6/6] Dry-run push")
	if err := runCmd("git", "push", "--dry-run", "origin", currentBranch); err != nil {
		return fmt.Errorf("step 6 failed: %w", err)
	}

	fmt.Println("\ngit preflight passed")
	return nil
}

func runCmd(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func getCurrentBranch() (string, error) {
	cmd := exec.Command("git", "branch", "--show-current")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
