# AGENTS: LIB TESTS

## PURPOSE

Unit-level test ownership for `src/lib` modules.
Guards adapter contracts, utility behavior, and failure/retry semantics.

## INVENTORY

- Unit suites (30): `alerting.test.ts`, `audit.test.ts`, `crypto.test.ts`, `csp.test.ts`, `device-registrations.test.ts`, `face-blur.test.ts`, `fas-attendance-helpers.test.ts`, `fas-connection.test.ts`, `fas-index.test.ts`, `fas-mappers.test.ts`, `fas-mariadb.test.ts`, `fas-sync.test.ts`, `gemini-ai.test.ts`, `image-privacy.test.ts`, `jwt.test.ts`, `key-manager.test.ts`, `logger.test.ts`, `notification-queue.test.ts`, `observability.test.ts`, `phash.test.ts`, `points-engine.test.ts`, `rate-limit.test.ts`, `response.test.ts`, `session-cache.test.ts`, `sms.test.ts`, `state-machine.test.ts`, `sync-lock.test.ts`, `types.test.ts`, `web-push.test.ts`, `workers-ai.test.ts`.
- Local doc: `AGENTS.md`.

## CONVENTIONS

- Keep tests module-scoped; avoid route/middleware integration setup in this directory.
- Keep mocks at external boundaries (`DB`, queue, network, crypto providers).
- Keep deterministic fixtures for hash/order/time-sensitive assertions.
- Keep contract tests strict for high fan-in modules (`response`, `jwt`, `notification-queue`).

## ANTI-PATTERNS

- Do not weaken envelope/contract assertions to shallow partial checks.
- Do not share mutable singleton mocks across files.
- Do not skip failure/retry/remove-path assertions for async modules.
- Do not couple tests to private implementation details when public contract suffices.

## DRIFT GUARDS

- Check top-level `src/lib/*.ts` modules against `src/lib/__tests__/*.test.ts` parity.
- Check renamed lib modules trigger corresponding test rename updates.
- Check new lib modules receive coverage or explicit exclusion rationale.
- Check contract-heavy tests (`response`, `jwt`, `notification-queue`) after signature changes.
