# Worker Route Layer

## PURPOSE

- Route-tree contract for `src/app`.
- Inventory only; subtree detail stays in child `AGENTS.md` files.

## INVENTORY

- Root files (5): `AGENTS.md`, `layout.tsx`, `page.tsx`, `error.tsx`, `globals.css`.
- Root tests (2): `__tests__/page.test.tsx`, `__tests__/segment-errors.test.tsx`.
- `actions/` — 12 files: root list route, segment error, `view/` detail subtree, local tests, local `AGENTS.md`.
- `announcements/` — 3 files: `AGENTS.md`, `page.tsx`, `__tests__/page.test.tsx`.
- `education/` — 21 files: list route, segment error, `view/` subtree, `quiz-take/` subtree, tests, local `AGENTS.md`.
- `home/` — 2 files: `page.tsx`, `__tests__/page.test.tsx`.
- `login/` — 4 files: `page.tsx`, `login-client.tsx`, route tests.
- `points/` — 2 files: `page.tsx`, `__tests__/page.test.tsx`.
- `posts/` — 16 files: list route, segment error, `new/` subtree, `view/` subtree, tests, local `AGENTS.md`.
- `profile/` — 3 files: `page.tsx`, `error.tsx`, `__tests__/page.test.tsx`.
- `register/` — 2 files: `page.tsx`, `__tests__/page.test.tsx`.
- `votes/` — 3 files: `page.tsx`, `error.tsx`, `__tests__/page.test.tsx`.
- Local route docs (4): `actions/AGENTS.md`, `announcements/AGENTS.md`, `education/AGENTS.md`, `posts/AGENTS.md`.

## CONVENTIONS

- Page surfaces: 16 `page.tsx` files across the tree.
- Segment error boundaries: app root + `actions` + `education` + `posts` + `profile` + `votes`.
- Root redirect stays hydration-gated; unauthenticated -> `/login/`, authenticated -> `/home/`.
- Root/login/register redirects stay trailing-slash normalized.
- Detail routes stay query-param based; no path-param split in current tree.
- Route files compose hooks/components; transport/cache logic stays outside `src/app`.

## ANTI-PATTERNS

- Data-fetch duplication inside route pages when domain hooks already exist.
- Registration form logic added under `register/`; route stays redirect-only.
- Hydration gate removal from root redirect flow.
- Segment error boundary removal from volatile route groups.
- Hardcoded UI copy in page surfaces.

## DRIFT GUARDS

- Recount subtree files before editing inventory bullets.
- Recount `**/page.tsx` when route surfaces move.
- Update child-doc list when route groups gain or lose local `AGENTS.md` files.
- Recheck error-boundary placement when new volatile groups land.
- Keep this file route-layer only; subtree internals stay in child docs.
