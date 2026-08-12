# Assessment Generation V2 — Render Build Hotfix

Date: 2026-08-12

## Confirmed Render failure

Render failed during `tsc --noEmit` at `src/lib/assessmentRepository.ts:704` with TS2345 because the canonical master-plan helper was declared with the optional `settings.masterPlan` property type. Even after its runtime null guard, TypeScript therefore still considered its return value to be `AssessmentMasterPlan | undefined` when passed to `createAssessmentBlueprintV2`, which requires `AssessmentMasterPlan`.

## Fix

`src/lib/assessmentRepository.ts` now imports and uses the concrete `AssessmentMasterPlan` type for:

- `canonicalizeV2MasterPlanForTos(masterPlan)` input
- `canonicalizeV2MasterPlanForTos(...)` return type
- `createAssessmentFromMasterPlan(masterPlan)` input

The existing runtime guard is retained defensively.

No runtime behavior, database migration, Edge Function contract, TOS mapping, point-range logic, CPD logic, or master-plan contents were changed by this hotfix.

## Validation executed in this environment

Passed:

- TypeScript parser syntax gate: 214 TS/TSX files, 0 parse errors.
- `scripts/check-assessment-generation-v2.mjs` — passed.
- Official curriculum manifest validation — 196 manifests / 6,181 competencies passed.
- `bash -n scripts/test-db-migrations.sh` — passed.
- Targeted TypeScript check no longer reports the original TS2345 at `assessmentRepository.ts:704`.

Environment limitation:

- A complete `npm ci && npm run build` could not be executed in this sandbox because npm registry access is unavailable and the dependency cache is incomplete. The user-provided Render log confirms the real deployment environment can install the 172 packages successfully; redeploying this hotfix is therefore the authoritative full build check.

## Deployment

No Supabase migration or Edge Function redeployment is required specifically for this hotfix if V2 migration/function deployment from the previous checkpoint has already been completed.

Replace the project code with this hotfixed root-level package and redeploy.
