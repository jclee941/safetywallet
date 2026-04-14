# AGENTS: ROUTES POSTS

## OVERVIEW

Posts feature router; CRUD, media, AI, and delete flows registered from separate modules.

## FILES

- `index.ts` - auth gate plus route registration.
- `crud-routes.ts` - core post CRUD registration.
- `media-routes.ts` - image/video-related routes.
- `post-ai.ts` - AI-specific post routes.
- `post-delete.ts` - delete route registration.
- `helpers.ts` - shared post route helpers.
- `post-helpers.ts` - post-specific helper set used by route modules.
- Local doc: `AGENTS.md`.

## WHERE TO LOOK

- `index.ts` - registration order and shared middleware.
- `crud-routes.ts` and `media-routes.ts` - main route surfaces.
- `post-ai.ts` and `post-delete.ts` - side-path features kept off the CRUD path.
- `helpers.ts` and `post-helpers.ts` - shared helper split.

## CONVENTIONS

- Keep `index.ts` mount/register-only; no route bodies there.
- Keep register-style modules focused on one surface each.
- Keep generic helpers in `helpers.ts`; post-domain transforms in `post-helpers.ts`.
- Keep delete and AI routes out of the core CRUD module.

## ANTI-PATTERNS

- Folding media, AI, and delete flows into `crud-routes.ts`.
- Using `helpers.ts` as a dump for post-only logic that belongs in `post-helpers.ts`.
- Adding direct auth calls inside each register module when `index.ts` already gates the router.
- Hiding new post surfaces behind undocumented helper files.
