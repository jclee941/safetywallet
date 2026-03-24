# AGENTS: JOBS

## PURPOSE

Scheduler job definitions and implementations consumed by `JobScheduler`.
Owns cron metadata, dispatch registry, and job helper side effects.

## INVENTORY

- Runtime job files (5): `daily-jobs.ts`, `helpers.ts`, `monthly-jobs.ts`, `registry.ts`, `sync-jobs.ts`.
- Registry job names (10): `fas-sync`, `publish-scheduled-announcements`, `metrics-alert-check`, `fas-full-sync-daily`, `overdue-action-check`, `pii-lifecycle-cleanup`, `vote-reward-distribution`, `data-retention`, `month-end-snapshot`, `auto-nomination`.
- Test files (6): `daily-jobs.test.ts`, `helpers.test.ts`, `monthly-jobs.test.ts`, `orchestrator.test.ts`, `registry.test.ts`, `sync-jobs.test.ts` in `__tests__/`.

## CONVENTIONS

- Keep schedule metadata centralized in `registry.ts`.
- Keep sync-critical flows lock-protected and idempotent.
- Keep retry strategy explicit at call sites, not implicit in helper defaults.
- Keep operational side effects (`KV` status, alerts, failure records) through shared helpers.

## ANTI-PATTERNS

- Do not add ad-hoc scheduler dispatch paths outside registry + DO flow.
- Do not rename registry `name` values without updating trigger callers.
- Do not bypass sync failure persistence on FAS-related errors.
- Do not duplicate alert dispatch logic between job modules.

## DRIFT GUARDS

- Check `registry.ts` `name:` list before inventory update.
- Check new job files have registry entries and test coverage updates.
- Check helper API changes against all job call sites.
- Check `JobScheduler` action dispatch compatibility after registry changes.
