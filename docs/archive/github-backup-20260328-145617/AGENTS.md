# AGENTS: .GITHUB

## PURPOSE

- Governance for top-level GitHub repository metadata/configuration files.
- Delegates workflow-level detail to `.github/workflows/AGENTS.md`.

## INVENTORY

- `AGENTS.md` — local `.github` governance.
- `CODEOWNERS` — code ownership routing.
- `dependabot.yml` — dependency update automation policy.
- `FUNDING.yml` — sponsor metadata.
- `labeler.yml` — PR path-based labels.
- `PULL_REQUEST_TEMPLATE.md` — PR template contract.
- `release-drafter.yml` — release notes drafting rules.
- `ISSUE_TEMPLATE/` — 5 issue form files (`bug_report.yml`, `config.yml`, `feature_request.yml`, `issue-form.yml`, `task.yml`).
- `workflows/` — workflow directory (34 files including local `AGENTS.md`).

## CONVENTIONS

- Keep top-level metadata path-driven and secret-free.
- Keep workflow internals documented only in child workflows AGENTS file.
- Keep issue template inventory synchronized with actual directory contents.
- Keep count-sensitive statements updated with add/remove operations.
- Keep config filenames stable to match GitHub conventions.

## ANTI-PATTERNS

- Stale counts for templates/workflows.
- Workflow trigger/coupling details duplicated at this level.
- Runtime artifacts or generated files committed under `.github/`.
- File references in docs that do not match real tree names.

## DRIFT GUARDS

- Confirm `.github/` remains 9 top-level entries.
- Confirm `ISSUE_TEMPLATE/` remains 5 files.
- Confirm workflows count here matches child workflows AGENTS.
- Confirm all inventory items exist after workflow/template churn.
