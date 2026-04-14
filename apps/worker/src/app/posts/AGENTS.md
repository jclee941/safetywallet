# Worker Posts

## PURPOSE

- Route contract for worker hazard-report list/create/detail flow.
- Keep list, create, and detail surfaces split by subtree.

## INVENTORY

- Root files (3): `AGENTS.md`, `page.tsx`, `error.tsx`.
- Root tests (1): `__tests__/page.test.tsx`.
- `new/` — 10 files: `page.tsx`, `new-post-client.tsx`, `constants.ts`, 5 `components/*`, `hooks/use-post-draft.ts`, `__tests__/page.test.tsx`.
- `view/` — 2 files: `page.tsx`, `__tests__/page.test.tsx`.
- Tree total: 16 files.

## CONVENTIONS

- `page.tsx` stays list shell: filters, infinite scroll, CTA into `new/`.
- `new/` owns compose flow internals; helper components/hooks stay inside that subtree.
- `view/` stays thin detail entry; route remains `/posts/view?id=...`.
- Transport/cache behavior stays in hooks/lib, not route-local fetch wrappers.

## ANTI-PATTERNS

- List filtering or infinite-scroll logic reimplemented inside `new/` or `view/`.
- Path-param detail routes added without parent route-contract update.
- Create/detail logic moved into unrelated shared route utilities.
- Hardcoded review-status copy bypassing translation keys or shared enums.

## DRIFT GUARDS

- Recount `new/` and `view/` subtree files before inventory edits.
- Keep list/new/view split explicit when responsibilities move.
- Keep route tests aligned with each entry surface.
- Update parent `src/app/AGENTS.md` if this file moves or new local docs appear.
