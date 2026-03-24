# App Routes

## PURPOSE

- Contract for App Router tree under `src/app`.
- Keep route inventories and wrapper boundaries current.

## INVENTORY

- Root files (`9` files, `7` TS/TSX):
  - `layout.tsx`
  - `error.tsx`
  - `global-error.tsx`
  - `not-found.tsx`
  - `globals.css`
  - `page.tsx`
  - `page.test.tsx`
  - `not-found.test.tsx`
  - `AGENTS.md`
- Test directory: `__tests__/` (`1` file): `error-boundaries.test.tsx`.
- Top-level route directories (`19`):
  - `actions`, `announcements`, `approvals`, `attendance`, `audit`
  - `ai-insights`, `dashboard`, `education`, `issues`, `login`, `members`
  - `monitoring`, `points`, `posts`, `recommendations`, `rewards`
  - `settings`, `sync-errors`, `votes`
- Page entry count: `32` (`**/page.tsx` under `src/app`).
- Module contracts in subtree:
  - `dashboard/AGENTS.md`
  - `attendance/AGENTS.md`
  - `points/AGENTS.md`
  - `posts/AGENTS.md`
  - `votes/AGENTS.md`
  - `education/AGENTS.md`

## CONVENTIONS

- Root `page.tsx` redirects to `/dashboard`.
- Dynamic wrapper routes stay thin:
  - `posts/[id]/page.tsx`
  - `votes/[id]/page.tsx`
  - `votes/[id]/candidates/new/page.tsx`
  - `members/[id]/page.tsx`
- Keep params extraction + client handoff only in wrapper pages.
- Keep route-local helpers/types beside owning route.
- Keep feature-heavy pages split into local `components/` subfolders.

## ANTI-PATTERNS

- Adding business logic to dynamic wrapper pages.
- Moving route-specific helpers to unrelated global locations.
- Leaving orphan route directories undocumented in this file.
- Mixing cross-feature constants into `src/app/page.tsx` shell logic.

## DRIFT GUARDS

- On new top-level route folder, update top-level list and page count.
- On adding/removing `page.tsx`, re-count `**/page.tsx` before merge.
- On adding nested feature docs, add AGENTS link in `INVENTORY`.
- Ensure dynamic route wrappers still delegate to client component files.
