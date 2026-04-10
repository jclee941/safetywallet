# AGENTS: LIB

## PURPOSE

Shared runtime service layer for API internals.
Owns adapters, transforms, queue/sync helpers, and reusable contracts.

## INVENTORY

- Top-level `.ts` runtime modules (24): `alerting.ts`, `audit.ts`, `crypto.ts`, `csp.ts`, `device-registrations.ts`, `face-blur.ts`, `fas-sync.ts`, `gemini-ai.ts`, `image-privacy.ts`, `jwt.ts`, `key-manager.ts`, `logger.ts`, `notification-queue.ts`, `observability.ts`, `phash.ts`, `points-engine.ts`, `rate-limit.ts`, `response.ts`, `session-cache.ts`, `sms.ts`, `state-machine.ts`, `sync-lock.ts`, `web-push.ts`, `workers-ai.ts`.
- Type declarations (2): `piexifjs.d.ts`, `sql-js.d.ts`.
- `fas/` query/mapper package (10 files): attendance queries/helpers, connection, employee queries, mappers, types.
- `fas-mariadb/` adapter package (1 file): `index.ts`.
- Child tests dir: `__tests__/` with 30 module suites.

## CONVENTIONS

- Keep env/binding access isolated from pure transforms.
- Keep cross-module contracts explicit (`response`, `jwt`, queue payloads, sync locks).
- Keep heavy-side-effect modules (`fas-sync`, `notification-queue`, `workers-ai`) idempotent at boundaries.
- Keep file names capability-scoped; avoid generic catch-all helper files.

## ANTI-PATTERNS

- Do not move route-specific middleware/handler logic into `src/lib`.
- Do not mutate response envelope shape without updating dependent tests.
- Do not break producer/consumer payload compatibility in queue or sync flows.
- Do not introduce route-layer imports into lib internals.

## DRIFT GUARDS

- Check `src/lib` top-level file list before updating module inventory.
- Check `fas/` and `fas-mariadb/` subdir entries for adapter/query additions.
- Check one-to-one parity between top-level runtime modules and test suites in `src/lib/__tests__`.
- Check high fan-in modules (`response.ts`, `jwt.ts`, `logger.ts`) for signature changes.
