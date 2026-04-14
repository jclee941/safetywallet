# Worker Announcements

## PURPOSE

- Route contract for worker announcement list surface.
- Single-page list; no nested detail route.

## INVENTORY

- Directory total: 3 files.
- `AGENTS.md` — local route contract.
- `page.tsx` — announcement list with loading, empty, expand/collapse states.
- `__tests__/page.test.tsx` — route tests for loading, empty, fallback, expand/collapse.

## CONVENTIONS

- Route stays list-only; item detail expands inline inside the card.
- Data source stays `useAnnouncements(currentSiteId || "")`.
- Header and bottom nav stay present in loading and loaded states.
- Unknown announcement types fall back to `GENERAL` styling/label.
- Empty announcement content falls back to `announcements.noContent` on expand.
- Translation keys stay under `announcements.*`.

## ANTI-PATTERNS

- Nested detail route or modal flow added without parent inventory update.
- Route-local API client or fetch wrapper parallel to shared hooks.
- Type badges hardcoded outside translation-backed mapping.
- Expand/collapse state moved into global store.

## DRIFT GUARDS

- Keep directory count at 3 files unless the route grows deliberately.
- Keep tests covering loading, empty, expand/collapse, unknown-type fallback.
- Recheck `currentSiteId || ""` fallback when auth shape changes.
- Update parent `src/app/AGENTS.md` if subtree count or doc path changes.
