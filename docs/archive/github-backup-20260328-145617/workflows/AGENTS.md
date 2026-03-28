# AGENTS: .GITHUB/WORKFLOWS

## PURPOSE

- Workflow-level inventory, coupling notes, and CI automation drift controls.
- Child scope of `.github`; no top-level metadata duplication.

## INVENTORY

- `AGENTS.md` — workflow governance file.
- `ci.yml` — primary CI verification pipeline.
- `automation-health.yml` — repository automation health checks.
- `android-release.yml` — Android release build/publish workflow.
- `ci-notify-failure.yml` — CI failure fan-out notifications.
- `deploy-monitoring.yml` — post-CI deployment monitoring lifecycle.
- `commitlint.yml` — commit/PR title lint policy.
- `labeler.yml` — PR path label sync.
- `issue-label.yml` — issue form label automation.
- `issue-lifecycle.yml` — issue state automation.
- `issue-duplicate.yml` / `issue-project.yml` / `issue-sla.yml` — extended issue automation.
- `release-drafter.yml` — release notes draft automation.
- `stale.yml` / `lock-threads.yml` / `welcome.yml` — community hygiene automation.
- `pr-size.yml` / `branch-cleanup.yml` / `auto-merge.yml` / `auto-approve-runs.yml` — PR lifecycle automation.
- `dependabot-auto-fix.yml` — Dependabot remediation automation.
- `ssl-fix.yml` — manual SSL remediation helper.
- `codex-approve-runs.yml` / `codex-auto-issue.yml` / `codex-issue-timeout.yml` / `codex-pr-normalize.yml` / `codex-pr-review.yml` / `codex-triage.yml` — Codex automation set.
- `opencode-agent-timeout.yml` / `opencode-issue-sync.yml` / `opencode-pr-sync.yml` / `opencode-writeback.yml` — OpenCode integration set.
- `pr-normalize.yml` — PR title normalization.
- Workflow file count: 33 YAML workflows + this `AGENTS.md` = 34 files.

## CONVENTIONS

- SHA-pin every action in `uses:` with version comment.
- Keep workflow `name:` stable when used by `workflow_run`/status checks.
- Keep `ci.yml` as upstream gate for notify/monitoring workflows.
- Keep permissions scoped minimally per workflow.
- Keep YAML file names kebab-case and purpose-specific.

## ANTI-PATTERNS

- Mutable action tags (`@v*`, `@main`) without SHA pinning.
- Renaming workflow `name:` fields without downstream update.
- Stale workflow inventory after add/remove.
- Privileged default token scopes when narrower scopes suffice.

## DRIFT GUARDS

- Confirm directory remains 34 entries with 33 `.yml` workflows.
- Confirm `ci-notify-failure.yml` and `deploy-monitoring.yml` still align to CI trigger contracts.
- Confirm Codex workflow set list matches on-disk filenames.
- Confirm parent `.github/AGENTS.md` counts match this file.
