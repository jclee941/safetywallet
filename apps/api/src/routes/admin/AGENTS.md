# AGENTS: ROUTES ADMIN

## OVERVIEW

Admin-only route surface; top-level handlers plus `fas/`, `posts/`, and `users/` feature routers.

## FILES

- Top-level route files (20): `access-policies.ts`, `alerting.ts`, `audit.ts`, `distributions.ts`, `education.ts`, `export.ts`, `helpers.ts`, `images.ts`, `index.ts`, `monitoring.ts`, `points.ts`, `recommendations.ts`, `settlements.ts`, `stats.ts`, `sync-errors.ts`, `trends.ts`, `votes-candidates.ts`, `votes-export.ts`, `votes-periods.ts`, `votes.ts`.
- Feature subdirs (5): `__tests__/`, `attendance/`, `fas/`, `posts/`, `users/`.
- `fas/` files (6): `helpers.ts`, `hyperdrive-routes.ts`, `index.ts`, `query-routes.ts`, `sync-workers-routes.ts`, `types.ts`.
- `posts/` files (5): `delete-handlers.ts`, `index.ts`, `list-routes.ts`, `moderation-routes.ts`, `review-handlers.ts`.
- `users/` files (5): `index.ts`, `routes.ts`, `user-lock.ts`, `user-management.ts`, `user-purge.ts`.
- Tests dir: `__tests__/`.

## WHERE TO LOOK

- `index.ts` - admin mount order and auth-gated composition.
- `helpers.ts` - cross-admin parsing and shared helpers.
- `fas/` - FAS sync/query split.
- `posts/` - moderation and review handlers.
- `users/` - user admin lifecycle handlers.

## CONVENTIONS

- Keep `index.ts` mount-only; handler logic stays in domain files or child routers.
- Keep vote admin surfaces split by concern: periods, candidates, export, core votes.
- Keep `users/` mutations split from router assembly; do not fold lock/purge flows into `routes.ts`.
- Keep feature-local helpers inside `fas/` or top-level `helpers.ts`; no cross-copying.

## ANTI-PATTERNS

- Listing inferred files from mounts instead of on-disk files.
- Re-introducing removed top-level names like `attendance.ts`.
- Hiding `users/` operational handlers behind a partial inventory.
- Mixing non-admin route handlers into this directory.
