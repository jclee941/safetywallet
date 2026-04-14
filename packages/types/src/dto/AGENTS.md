# DTO

## PURPOSE

- Domain DTO contract layer under `@safetywallet/types`.
- Split by feature file; no runtime logic.

## INVENTORY

- Directory total: 17 files = 16 TypeScript files + `AGENTS.md`.
- `index.ts` — DTO barrel re-exporting every module.
- `action.dto.ts` — action create/detail/list/update payloads.
- `analytics.dto.ts` — dashboard trend/distribution payloads.
- `announcement.dto.ts` — announcement CRUD/list payloads.
- `auth.dto.ts` — login/session/refresh/register payloads.
- `education-ai.dto.ts` — AI recommendation and analysis payloads.
- `education-content.dto.ts` — education content metadata and delivery payloads.
- `education-quiz.dto.ts` — quiz/question/attempt payloads.
- `education-training.dto.ts` — statutory training and TBM payloads.
- `education.dto.ts` — shared education aggregate payloads.
- `points.dto.ts` — ledger/history/balance/policy payloads.
- `post.dto.ts` — post list/detail/create/filter/media payloads.
- `review.dto.ts` — moderation review command/result payloads.
- `site.dto.ts` — site/member/admin dashboard payloads.
- `user.dto.ts` — user profile/update payloads.
- `vote.dto.ts` — vote period/candidate/result/export payloads.

## CONVENTIONS

- Keep each domain in its matching `*.dto.ts` file.
- Import shared enums from `../enums` for enum-backed fields.
- Preserve optional (`?`) vs nullable (`| null`) semantics exactly.
- Add/remove DTO files only with synchronized `index.ts` export updates.
- Prefer explicit domain-prefixed interface/type names.

## ANTI-PATTERNS

- Cross-domain dumping into unrelated DTO modules.
- Inline enum string unions duplicating canonical enums.
- Contract widening via `any`, broad `Record<string, unknown>`, cast escapes.
- Dead DTO exports not referenced by API/apps/tests.

## DRIFT GUARDS

- Confirm directory still has 17 files before doc edits.
- Confirm barrel exports all 15 DTO modules exactly once.
- Confirm new DTO fields preserve backward-compatibility expectations.
- Confirm parent `packages/types/AGENTS.md` counts stay aligned.
