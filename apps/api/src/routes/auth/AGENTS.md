# AGENTS: ROUTES AUTH

## PURPOSE

- Auth route contract for worker/admin login, registration, session, and lockout flows.
- Keeps `src/routes/auth` split by auth surface instead of one branch-heavy module.

## INVENTORY

- Route files (7): `index.ts`, `lockout.ts`, `login-admin.ts`, `login-worker.ts`, `login.ts`, `register.ts`, `session.ts`.
- Test directory: `__tests__/` (4): `lockout.test.ts`, `login-admin.test.ts`, `login-route.test.ts`, `login-worker.test.ts`.
- Local doc: `AGENTS.md`.

## CONVENTIONS

- Keep `index.ts` mount-only; route composition lives there, request logic does not.
- Keep worker/admin login entrypoints separate when request shape or downstream policy differs.
- Keep lockout helpers in `lockout.ts`; rate-limit and audit side effects stay explicit.
- Keep session/refresh semantics in `session.ts` instead of folding them into login handlers.

## ANTI-PATTERNS

- Collapsing worker/admin login paths into one handler without a contract change review.
- Moving lockout behavior into unrelated middleware or generic helpers.
- Adding direct side effects in `index.ts` beyond route registration.
- Mixing registration/session behavior into login-specific modules.

## DRIFT GUARDS

- Check `src/routes/auth` file list before editing this inventory.
- Check `src/routes/auth/index.ts` mounts against on-disk files.
- Check worker/admin login parity when adding new auth entrypoints.
- Check parent `src/routes/AGENTS.md` child-doc list stays aligned.
