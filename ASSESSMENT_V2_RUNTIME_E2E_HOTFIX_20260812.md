# Assessment Generation V2 — Runtime + E2E Hotfix

Date: 2026-08-12

## Scope

This checkpoint keeps the Assessment Generation V2 architecture intact. It contains two narrow fixes discovered after the UI wizard deployment.

### 1. Master planner Gemini HTTP 400

The `assessment-master-planner` Edge Function was still sending the legacy `generationConfig.responseSchema` payload even though GuroDesk's hardened Gemini assessment boundary had already moved away from that provider contract after prior INVALID_ARGUMENT failures.

The planner now uses:

- `responseMimeType: application/json`
- `thinkingConfig.thinkingLevel: HIGH`
- the same model order: Gemini 3.6 Flash → 3.5 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite
- the same `maxOutputTokens` bound
- the existing strict server-side `validateProviderPlan()` validation for bucket IDs, point totals, TOS mappings, CPD/type suitability and visual policy

No TOS point allocation, CPD rules, master-plan structure, question-generation contract, persistence, scoring or fallback ordering was changed.

### 2. Playwright E2E expectations after the UI wizard

GitHub CI run 31562090079 showed:

- static/type/unit/build: PASS
- fresh migrations: PASS
- upgrade migrations: PASS
- local Supabase integration: 12/12 PASS
- Playwright: 3 failures

The failures were stale UI expectations only:

- two tests still expected the removed `New assessment` / `Create draft` flow
- the phone navigation test used an unscoped `Create` locator that matched both the mobile primary nav and Home CTA

The E2E suite now:

- exercises `Create assessment` → `Choose assessment source` → `Assessment setup` → `Choose question formats`
- seeds deterministic manual editor/export fixtures through the real guarded **local** Supabase `save_assessment_document` RPC because E2E intentionally blocks every external AI request
- scopes the phone `Create` action to `Primary navigation`

This does not add a legacy Create Draft button back to production and does not bypass database guards.

## Local validation executed

Passed:

- `node scripts/check-assessment-generation-v2.mjs`
- `node scripts/check-assessment-math-visuals.mjs`
- TypeScript parser/transpile syntax gate: 213 executable TS/TSX files, 0 failures
- `bash -n scripts/test-db-migrations.sh`

Environment-blocked locally:

- `npm ci` could not run in this sandbox, so Playwright was not re-executed here.

The next GitHub Actions run is the authoritative E2E confirmation because that environment successfully installs dependencies, Chromium and local Supabase.

## Deployment note

The Gemini HTTP 400 fix changes `supabase/functions/assessment-master-planner/index.ts`. Updating only the frontend is not enough: deploy the updated `assessment-master-planner` Edge Function through the project's normal Supabase deployment workflow.

Migration 029 from the prior checkpoint remains required for hosted databases that have not yet received it.
