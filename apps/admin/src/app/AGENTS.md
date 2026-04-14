# App Routes

## OVERVIEW

- Route-tree contract for `src/app`; keep top-level folders and local AGENTS coverage in sync.

## FILES

- Root files (`9`): `layout.tsx`, `error.tsx`, `global-error.tsx`, `globals.css`, `not-found.tsx`, `not-found.test.tsx`, `page.tsx`, `page.test.tsx`, `AGENTS.md`
- Root test dir: `__tests__/error-boundaries.test.tsx`
- Top-level route dirs (`19`):
  - `actions/`, `ai-insights/`, `announcements/`, `approvals/`, `attendance/`, `audit/`
  - `dashboard/`, `education/`, `issues/`, `login/`, `members/`, `monitoring/`
  - `points/`, `posts/`, `recommendations/`, `rewards/`, `settings/`, `sync-errors/`, `votes/`
- Child AGENTS docs:
  - `actions/AGENTS.md`
  - `announcements/AGENTS.md`
  - `attendance/AGENTS.md`
  - `dashboard/AGENTS.md`
  - `education/AGENTS.md`
  - `issues/AGENTS.md`
  - `members/AGENTS.md`
  - `monitoring/AGENTS.md`
  - `points/AGENTS.md`
  - `posts/AGENTS.md`
  - `rewards/AGENTS.md`
  - `votes/AGENTS.md`

## WHERE TO LOOK

- Thin wrappers: `posts/[id]/page.tsx`, `votes/[id]/page.tsx`, `votes/[id]/candidates/new/page.tsx`, `members/[id]/page.tsx`
- Dense feature trees: `attendance/`, `education/`, `monitoring/`, `rewards/`
- Orphan top-level routes without local AGENTS yet: `ai-insights/`, `approvals/`, `audit/`, `login/`, `recommendations/`, `settings/`, `sync-errors/`

## CONVENTIONS

- Top-level route add/remove: update folder list here in same change.
- New local AGENTS under `src/app/*`: add link here in same change.
- Wrapper routes: params handoff only; client detail stays beside wrapper.
- Keep route-only helpers inside owning folder, not root `src/app/`.
