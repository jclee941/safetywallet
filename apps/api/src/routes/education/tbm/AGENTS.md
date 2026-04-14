# AGENTS: ROUTES EDUCATION TBM

## OVERVIEW

TBM router; record CRUD, detail reads, attendance, AI jobs, and AI analysis kept as separate handlers.

## FILES

- `index.ts` - nested TBM router composition.
- `crud.ts` - TBM CRUD route surface.
- `crud-detail.ts` - TBM detail reads.
- `attendance.ts` - TBM attendance handlers.
- `ai-analysis.ts` - AI analysis endpoints.
- `ai-jobs.ts` - AI background-job helpers or triggers.
- `shared.ts` - TBM shared helpers/types.
- Local doc: `AGENTS.md`.

## WHERE TO LOOK

- `index.ts` - mount order for CRUD, attendance, and AI analysis routes.
- `crud.ts` and `crud-detail.ts` - record lifecycle vs detail reads.
- `attendance.ts` - attendee-specific flows.
- `ai-analysis.ts` and `ai-jobs.ts` - AI-facing TBM split.
- `shared.ts` - shared TBM helpers.

## CONVENTIONS

- Keep AI route entrypoints separate from AI job orchestration helpers.
- Keep attendance handlers separate from TBM record CRUD.
- Keep reusable TBM helper code in `shared.ts` rather than duplicating across AI and CRUD files.
- Keep `index.ts` composition-only.

## ANTI-PATTERNS

- Mixing AI job orchestration into CRUD or attendance files.
- Treating detail reads as part of generic CRUD without a separate module.
- Copying shared TBM transforms instead of reusing `shared.ts`.
- Expanding `index.ts` into a logic-heavy handler file.
