# AGENTS: MIGRATIONS

## PURPOSE

Append-only SQL lineage for API database changes.
Owns migration files and Drizzle metadata snapshots.

## INVENTORY

- SQL migrations (31): `0000_lovely_jocasta.sql` through `0032_add_posts_client_mutation_id.sql`.
- SQL numbering quirks present: duplicate `0003`; no `0011`.
- Meta files (4): `meta/_journal.json`, `meta/0000_snapshot.json`, `meta/0012_snapshot.json`, `meta/0017_snapshot.json`.
- Local doc: `AGENTS.md`.

## CONVENTIONS

- Keep migration history append-only after merge.
- Keep SQL file and `meta/` snapshot updates committed together when generated.
- Keep migration intent narrow per file; avoid mixed unrelated schema changes.
- Keep naming format `NNNN_description.sql` aligned with existing sequence style.

## ANTI-PATTERNS

- Do not rewrite prior migration SQL to patch already-applied history.
- Do not manually reorder `_journal.json` without controlled conflict resolution.
- Do not embed runtime app logic in migration SQL.
- Do not assume chronological continuity from filename numbers alone.

## DRIFT GUARDS

- Check latest migration filename and count in `migrations/` before edits.
- Check `meta/` snapshot set after `db:generate` runs.
- Check for duplicate/missing sequence numbers and document them explicitly.
- Check `src/db/schema.ts` change set aligns with newly added migration intent.
