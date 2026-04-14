# AGENTS: ROUTES ADMIN USERS

## OVERVIEW

Admin user-management router; assembly, shared routes, lock, management, and purge flows split by operation.

## FILES

- `index.ts` - nested router mount.
- `routes.ts` - shared user admin route assembly.
- `user-lock.ts` - lock and unlock handlers.
- `user-management.ts` - user management mutations.
- `user-purge.ts` - destructive purge handlers.
- Local doc: `AGENTS.md`.

## WHERE TO LOOK

- `index.ts` - outer mount.
- `routes.ts` - central route assembly.
- `user-lock.ts` - account lock flow.
- `user-management.ts` - standard admin mutations.
- `user-purge.ts` - irreversible purge path.

## CONVENTIONS

- Keep `routes.ts` as assembly/shared routes; heavy mutation logic stays in leaf files.
- Keep lock operations separate from broader management mutations.
- Keep purge handlers isolated because risk profile differs from normal user management.
- Keep `index.ts` mount-only.

## ANTI-PATTERNS

- Hiding purge behavior inside generic management handlers.
- Mixing lock/unlock logic into unrelated user mutations.
- Expanding `index.ts` beyond router wiring.
- Documenting only `index.ts` and `routes.ts` while leaf operational files exist.
