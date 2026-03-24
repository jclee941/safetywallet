# API

## PURPOSE

`apps/api` worker boundary and composition point for API runtime modules.
Owns module wiring, local config, and child ownership boundaries.

## INVENTORY

- `src/index.ts` - API entrypoint; mounts routes; queue consumer; host fallback bridge.
- `src/routes/` - route modules and route tests; includes `admin/` and feature subdirs.
- `src/lib/` - shared runtime services, adapters, helpers, and lib tests.
- `src/middleware/` - auth/permission/attendance/analytics/security request gates.
- `src/db/` - Drizzle schema contract and batch helper wrappers.
- `src/durable-objects/` - `RateLimiter` and `JobScheduler` classes.
- `src/jobs/` - scheduler registry and job implementations.
- `src/validators/` - Zod request validation modules and shared schemas.
- `migrations/` - SQL history (`0000`..`0032`) plus `meta/` snapshots.
- `drizzle.config.ts` - migration generation config.
- `wrangler.toml` - worker deployment/runtime config.
- `worker-configuration.d.ts` - generated bindings/types.
- `seed.sql` - local seed data reference.

## CONVENTIONS

- Keep this file focused on `apps/api` boundary only; delegate details to child AGENTS files.
- Keep inventory synchronized with real directories, not inferred mount/import usage.
- Keep child ownership explicit: edit leaf AGENTS where behavior lives.
- Keep route/module naming aligned with directory responsibilities.

## ANTI-PATTERNS

- Do not duplicate child-level rules from `src/routes/*`, `src/lib/*`, or other leaf docs.
- Do not add root-platform architecture content here.
- Do not track transient build/runtime folders (`dist/`, `.wrangler/`, `coverage/`) as owned inventory.
- Do not describe behavior that belongs to sibling apps.

## DRIFT GUARDS

- Check `src/` top-level directory list before any inventory update.
- Check `migrations/` for newly added SQL or `meta` snapshots.
- Check `src/index.ts` for added/removed mount surfaces affecting child ownership.
- Check that each child AGENTS file exists and maps to an owned module directory.
