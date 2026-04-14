# Types

## PURPOSE

- Runtime-free shared contracts package for apps and API.
- Canonical home for enums, DTO barrels, transport types, i18n exports.

## INVENTORY

- `src/index.ts` — root export surface: `enums`, `api`, `dto`, `i18n`.
- `src/enums.ts` — shared enum set.
- `src/api.ts` — transport envelopes: `ApiResponse`, `PaginatedResponse`, `ErrorResponse`.
- `src/dto/` — 17 files total: `AGENTS.md`, 15 domain DTO modules, `index.ts`.
- `src/i18n/` — 3 files total: `AGENTS.md`, `ko.ts`, `index.ts`.
- `src/__tests__/` — 5 contract tests: `enums`, `dto`, `dto-shapes`, `exports`, `i18n`.
- `src/` footprint — 26 TypeScript files in package.
- `package.json` — package metadata, scripts, workspace wiring.
- `tsconfig.json` — TS compiler contract.
- `vitest.config.ts` — unit-test runtime config.

## CONVENTIONS

- Package stays side-effect free; contracts only.
- Consumer imports stay on package root; avoid deep-path imports.
- DTO add/remove stays synchronized with `src/dto/index.ts`.
- Locale add/remove stays synchronized with `src/i18n/index.ts` and `src/index.ts`.
- Enum literal changes are API-contract changes.
- Optional vs nullable semantics stay exact.

## ANTI-PATTERNS

- Runtime helpers, fetchers, validators, app state.
- Duplicate enum unions when canonical enums already exist.
- Hidden exports bypassing `src/index.ts`.
- `any` or widened `unknown` in contract types.

## DRIFT GUARDS

- Verify DTO and i18n counts from actual directories before doc edits.
- Verify root barrel still exports all four contract domains.
- Verify `src/` TypeScript file count when DTO modules split again.
- Verify tests still map to contract domains after moves.
