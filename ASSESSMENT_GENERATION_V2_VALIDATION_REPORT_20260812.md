# GuroDesk Assessment Generation V2 — Validation Report

Date: 2026-08-12

This report distinguishes checks actually executed in this sandbox from checks blocked by missing package/runtime infrastructure. A blocked check is **not** reported as passed.

## Passed checks

### Source syntax

- TypeScript version available globally: **5.8.3**.
- TypeScript parser gate over `src`, `supabase/functions`, and `tests`: **214 TS/TSX files, 0 parse errors**.

### Isolated strict TypeScript checks

The following isolated strict configurations passed with `--noEmit`, using the globally available TypeScript compiler and only modules that do not require the missing project dependency tree:

- V2 pure core domain (`assessmentGenerationV2` + assessment/TOS/visual types).
- V2 blueprint/final validator/export presentation domain.
- Results export-model/type domain.

These checks catch cross-module type errors in the new deterministic V2 architecture, but they do not replace the normal repository-wide `npm run typecheck*` gates.

### V2 static release contract

`node scripts/check-assessment-generation-v2.mjs` — **PASS**.

The guard verifies, among other things:

- point-first V2 setup and schema markers;
- CPD suitability/feasibility logic;
- exact model order `3.6 Flash → 3.5 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite`;
- high thinking configuration;
- server-side authoritative TOS bucket recomputation;
- frozen master-plan linkage in question generation;
- V2 migration/RPC presence;
- point-range finalization/export paths;
- non-Math and Balanced visual-policy safeguards;
- V2 behavior-test coverage markers.

### Migration inventory/harness syntax

- Migration inventory: **28 SQL migrations**.
- `bash -n scripts/test-db-migrations.sh` — **PASS**.
- Migration harness expected count updated to 28 and contains V2 assertions.

This is shell/static validation only; PostgreSQL/Supabase execution is listed separately as blocked.

### Relative import integrity

A source-relative import audit was run with Vite query suffixes understood. Result: **153 source files scanned, 0 missing relative imports**.

This specifically rules out the missing-module problem encountered while reconciling the interrupted V2 implementation.

### Deterministic V2 runtime behavior

The compiled pure V2 modules were exercised directly outside Vitest. Passed behaviors included:

- selected objective-only types are rejected when the TOS requires higher-order CPD coverage that they cannot strongly satisfy;
- minimum feasible total-point calculation works for mixed lower/higher-order allocations;
- deterministic buckets sum to the teacher-requested total;
- one multi-point question remains one logical question;
- point numbering is contiguous (example fixture produced `1`, then `2–5` for a four-point logical question);
- a plan that moves/misses locked TOS bucket points is rejected;
- V2 final validation accepts a correct logical-question/point-range paper;
- V2 canonical assessment export uses point ranges and omits the misleading legacy item-total presentation.

### Visual-policy regression behavior

Direct V2 behavior checks passed:

- a two-question Balanced paper with one automatically required visual is rejected;
- a non-Mathematics master plan with an automatically required visual is rejected.

This protects the prior visual-reliability release from regression during the new master-planning flow.

### Existing dependency-free validator stage

`node scripts/run-existing-validators.mjs` began successfully and passed its first dependency-free stage:

- **196 official curriculum manifests**;
- **6,181 verified competencies** with source/payload integrity.

The next stage could not start because the local dependency tree is intentionally absent; see Blocked Checks.

### Repository packaging prerequisites

Confirmed present in the working tree:

- `.github/workflows/ci.yml`
- `.gitignore`
- `supabase/config.toml`
- migration `028`
- new `assessment-master-planner` Edge Function.

## Blocked / not claimed as passed

### `npm ci`

A clean `npm ci --no-audit --no-fund` was attempted during this implementation run, including a retry. The container execution boundary failed before npm produced a normal completed install result/log. A partial `node_modules` tree was removed so it will not contaminate the delivered ZIP.

**Status: BLOCKED.**

### Repository-wide TypeScript gates

Because the project dependency tree could not be installed, the following required commands could not be completed normally:

- `npm run typecheck`
- `npm run typecheck:tests`
- `npm run typecheck:e2e`

**Status: BLOCKED.**

The isolated strict checks listed above passed but are not substitutes for these repository gates.

### Full validator suite

`node scripts/run-existing-validators.mjs` passed curriculum manifest integrity, then stopped at official curriculum coverage because package `esbuild` is unavailable:

`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'esbuild' imported from scripts/validate-official-curriculum-coverage.mjs`

Therefore `npm run validate:all` is **not** claimed as passed.

### Unit tests

The V2 Vitest file is present with targeted tests for CPD feasibility, requested totals, multi-point range numbering, frozen bucket integrity, minimum feasible points, V2 final validation, visual-policy safeguards, and export presentation.

Vitest itself is unavailable without the project dependency install.

**`npm run test:unit`: BLOCKED / NOT RUN.**

### Production build

Vite/project dependencies are unavailable.

- `npm run build:bundle`: **BLOCKED / NOT RUN**.

### Production dependency audit

- `npm audit --omit=dev`: **BLOCKED / NOT RUN** because a clean dependency install could not be established in this sandbox.

### Real Deno Edge typechecking

The Deno runtime is unavailable here. The Edge modules passed source parsing/static contract checks, but real Deno typechecking was not executed.

**Status: BLOCKED.**

### Fresh/upgrade migrations and RLS/integration

Supabase CLI/PostgreSQL tooling required by the project migration harness is unavailable in this environment. Therefore the following are not claimed as passed:

- fresh migration execution;
- upgrade migration execution through migration 028;
- V2 RPC behavioral SQL tests;
- two-teacher Supabase integration/RLS tests.

**Status: BLOCKED.**

### Browser/E2E and rendered export inspection

Chromium/Playwright could not be installed/run because the project dependency/runtime setup is blocked. Therefore the following are not claimed as passed:

- Chromium E2E;
- phone viewport E2E;
- full-screen generation visual inspection;
- final assessment review screenshot inspection;
- direct Student/Teacher/Answer Key browser-print inspection;
- real PDF/DOCX render inspection;
- result report/workbook UI inspection.

The underlying point-range presentation models passed deterministic/static checks, but real rendered artifacts must still be inspected in CI/staging.

## Inherited TikZJax limitation

The prior visual-reliability checkpoint could not materialize the licensed/version-pinned TikZJax runtime binaries and fonts in this sandbox. The application therefore still contains the inherited runtime CDN dependency. Assessment Generation V2 preserves the existing direct-TikZ quality path and its visual-selection/verification safeguards but does **not** claim offline/local TikZJax vendoring is complete.

## Production release gate

Before production promotion, run the repository's normal full matrix from a clean environment:

1. `npm ci`
2. `npm run typecheck`
3. `npm run typecheck:tests`
4. `npm run typecheck:e2e`
5. `npm run validate:all`
6. `npm run test:unit`
7. `npm run build:bundle`
8. `npm audit --omit=dev`
9. real Deno typechecking for changed/new Edge modules
10. fresh migration test through 028
11. upgrade migration test through 028
12. two-teacher integration/RLS tests
13. Chromium E2E
14. phone viewport E2E
15. V2 setup/master-plan/progress/review screenshot inspection
16. Student/Teacher/Answer Key export inspection
17. result analysis PDF/DOCX/XLSX/browser-print inspection with point-range questions
18. direct TikZ PDF/DOCX/browser-print inspection.

Until these blocked gates run successfully, this artifact should be treated as a **complete V2 implementation checkpoint**, not a fully environment-validated production release.
