# Docs

## PURPOSE

- Top-level docs index for runbooks, checklists, and redirect stubs.
- Ownership boundary for `docs/*` except `docs/requirements/*` internals.

## INVENTORY

- `AGENTS.md` — local docs governance.
- `README.md` — docs landing map.
- `cloudflare-operations.md` — operations runbook source.
- `FEATURE_CHECKLIST.md` — feature completion checklist.
- `deployment-verification.md` — deployment verification guide.
- `ci-cd-debugging.md` — CI/CD troubleshooting guide.
- `debugging.md` — general debugging guide.
- `deployment.md` — redirect to operations runbook.
- `rollback.md` — redirect to operations runbook.
- `REQUIREMENTS_REVIEW.md` — redirect to requirements checklist.
- `requirements/` — requirements subtree with local `AGENTS.md`.
- `archive/` — archived/deprecated documents.

## CONVENTIONS

- Keep canonical ops procedure text in one file (`cloudflare-operations.md`).
- Keep redirects short; no duplicated normative content inside redirect stubs.
- Keep `README.md` links synchronized with actual docs tree.
- Keep requirement-specific policy text in `docs/requirements/`.
- Use relative links that resolve in GitHub and local editors.

## ANTI-PATTERNS

- Parallel source-of-truth docs for same operational procedure.
- Redirect files accumulating standalone guidance.
- Broken or stale links in docs index files.
- Requirement status trackers outside `docs/requirements/` scope.

## DRIFT GUARDS

- Confirm top-level docs directory remains 12 entries.
- Confirm `requirements/` subtree delegation still explicit here.
- Confirm every inventory entry maps to an existing file/dir.
- Confirm redirects still target active canonical documents.
