# AGENTS: ROUTES ATTENDANCE

## OVERVIEW

Attendance feature router; sync, today, report, and realtime handlers split behind one mount.

## FILES

- `index.ts` - route mount, auth gate, shared exports, small date/idempotency utilities.
- `routes.ts` - re-export hub for attendance handlers.
- `sync-handler.ts` - FAS sync write path.
- `today-handler.ts` - current-user attendance read path.
- `report-handler.ts` - site report reads.
- `realtime-handler.ts` - realtime attendance stats reads.
- Local doc: `AGENTS.md`.

## WHERE TO LOOK

- `index.ts` - public route contract and middleware order.
- `routes.ts` - handler export map.
- `sync-handler.ts` - sync-specific request flow.
- `report-handler.ts` and `realtime-handler.ts` - site/admin-style read surfaces.

## CONVENTIONS

- Keep `index.ts` as the only mount file; endpoint wiring lives there.
- Keep handler files single-purpose by endpoint family.
- Keep shared attendance utilities in `index.ts` or `routes.ts` exports; avoid helper-file sprawl.
- Keep sync flow isolated from read handlers.

## ANTI-PATTERNS

- Folding all four handlers back into `index.ts`.
- Sharing report/realtime query logic by copy-paste.
- Moving auth-gated route registration into individual handler files.
- Treating `routes.ts` as a second mount file.
