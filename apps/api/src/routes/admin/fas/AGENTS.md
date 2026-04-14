# AGENTS: ROUTES ADMIN FAS

## OVERVIEW

Admin FAS router; worker sync, query, and hyperdrive routes composed behind one feature mount.

## FILES

- `index.ts` - nested router composition.
- `sync-workers-routes.ts` - worker sync/admin-triggered sync routes.
- `query-routes.ts` - FAS query routes.
- `hyperdrive-routes.ts` - Hyperdrive connectivity or diagnostics routes.
- `helpers.ts` - FAS helper utilities.
- `types.ts` - FAS-specific bindings and variable types.
- Local doc: `AGENTS.md`.

## WHERE TO LOOK

- `index.ts` - mount order for sync, query, and hyperdrive routes.
- `sync-workers-routes.ts` - sync entrypoints.
- `query-routes.ts` - query-only surfaces.
- `hyperdrive-routes.ts` - connection and runtime checks.
- `types.ts` - local Hono typing contract.

## CONVENTIONS

- Keep route families split by operation mode: sync, query, hyperdrive.
- Keep feature-specific Hono types in `types.ts`; do not re-declare them per route file.
- Keep shared FAS glue in `helpers.ts`, not copied into each route family.
- Keep `index.ts` composition-only.

## ANTI-PATTERNS

- Folding sync and query handlers into one generic FAS route file.
- Inlining feature-specific bindings types into each module.
- Treating hyperdrive diagnostics as part of normal query routes.
- Growing `helpers.ts` into a second route module.
