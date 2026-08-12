# Create Assessment UI + visual checkpoint CI hotfix

Date: 2026-08-12

## Scope

This checkpoint intentionally limits changes to:

1. Create Assessment V2 presentation/UX.
2. Visual checkpoint RPC authorization bug exposed by the local Supabase integration gate.
3. Migration-harness labels updated for migration 029.

No Assessment Generation V2 planning/generation logic, CPD allocation logic, point-range model, model hierarchy, question-generation contract, visual-generation contract, result scoring, or export architecture was changed.

## Create Assessment UI

`src/pages/AssessmentNewPage.tsx` now presents the same existing setup state and handlers through a three-step wizard:

- Step 1: choose finalized TOS.
- Step 2: total points, title, learner directions, visual policy, collapsed advanced planning guidance.
- Step 3: compact question-format selection, cognitive-coverage summary, final generation summary.

The old always-visible CPD/type matrix has been removed from the presentation. CPD compatibility remains enforced by the existing `validateAssessmentV2Setup` domain logic.

Generation is still entered only through the existing `generateAssessment()` implementation, which is unchanged from the pre-UI checkpoint.

Responsive wizard styling lives in `src/assessment.css` and collapses to one-column controls on small screens.

## Integration/AI Studio checkpoint error

Latest GitHub CI showed one failure in the local Supabase integration test:

`Assessment item writes must use the save RPC`

Migration 027's security-definer `save_assessment_item_visual_checkpoint` RPC performs a narrow legitimate update to `assessment_items`, but it omitted the transaction-local `app.assessment_rpc=1` flag required by the existing write-state trigger.

New migration:

`supabase/migrations/202608120029_visual_checkpoint_rpc_guard_fix.sql`

It replaces only that RPC and sets the transaction-local guard before the item/document update. It does not grant direct table-write access, alter RLS, or bypass stale-write/owner/locked-item checks.

## Executed checks in this environment

Passed:

- TS/TSX parser syntax gate: 214 files, 0 parse errors.
- `AssessmentNewPage.tsx` parser: clean.
- `src/assessment.css` brace integrity: 817 opening / 817 closing.
- `bash -n scripts/test-db-migrations.sh`.
- `node scripts/check-assessment-generation-v2.mjs`.
- `node scripts/check-assessment-math-visuals.mjs`.
- Existing generation functions compared against pre-UI checkpoint: `generateAssessment`, `cancelGeneration`, and `toggleType` unchanged.

Not executed fully here:

- `npm run validate:all` stops when a validator imports `esbuild`, because this sandbox does not currently contain the locked `node_modules` tree. The latest GitHub static job on the pre-UI/current-main base is green; the only CI failure there was the Supabase integration checkpoint guard addressed by migration 029.
- Local Supabase integration itself cannot be rerun here without the Supabase/Docker dependency stack.

