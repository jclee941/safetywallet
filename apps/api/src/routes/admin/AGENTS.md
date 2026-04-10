# AGENTS: ROUTES ADMIN

## PURPOSE

Admin route module set under `src/routes/admin`.
Owns admin-only read/write and operational route handlers.

## INVENTORY

- Top-level route files (18): `access-policies.ts`, `alerting.ts`, `attendance.ts`, `audit.ts`, `distributions.ts`, `education.ts`, `export.ts`, `helpers.ts`, `images.ts`, `index.ts`, `monitoring.ts`, `points.ts`, `recommendations.ts`, `settlements.ts`, `stats.ts`, `sync-errors.ts`, `trends.ts`, `votes.ts`.
- Feature subdirs (3): `fas/`, `posts/`, `users/`.
- `fas/` files (6): `helpers.ts`, `hyperdrive-routes.ts`, `index.ts`, `query-routes.ts`, `sync-workers-routes.ts`, `types.ts`.
- `posts/` files (5): `delete-handlers.ts`, `index.ts`, `list-routes.ts`, `moderation-routes.ts`, `review-handlers.ts`.
- `users/` files (2): `index.ts`, `routes.ts`.
- Admin tests dir: `__tests__/` with 21 `*.test.ts` files.

## CONVENTIONS

- Keep `index.ts` as mount-only composition; keep domain logic in per-module files.
- Keep global `authMiddleware` gate first; module permissions remain additive.
- Keep shared admin utilities in `helpers.ts` or feature-local helpers, not duplicated across modules.
- Keep route module names aligned with mounted domain names.

## ANTI-PATTERNS

- Do not add unresolved mounts/imports in `index.ts` without a real file.
- Do not bypass auth gate by direct unguarded app export.
- Do not copy logic between `posts/`, `fas/`, and top-level admin files.
- Do not place non-admin route handlers in this directory.

## DRIFT GUARDS

- Check `ls src/routes/admin` against top-level file inventory.
- Check `index.ts` mount list against existing module files and imports.
- Check `__tests__/` count and file names after new admin route additions.
- Check each feature subdir (`fas`, `posts`, `users`) for added or removed handlers.
