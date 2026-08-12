# Assessment Generation V2 — checkpoint finalization + E2E regression fix

Date: 2026-08-12

## Production generation failure fixed

Observed mobile failure:

`Existing item content is protected; request an explicit alternative before replacing it.`

### Root cause

AssessmentNewPage correctly checkpointed the provider-valid pass-1 question immediately through `onQuestionReady`, then persisted it. After the bounded verifier/QA pass returned, the page attempted to apply the finalized suggestion to that now-nonempty item using the ordinary blank-item replacement path. The existing-content protection correctly rejected the second application.

### Fix

- Added `applyCheckpointedAssessmentItemSuggestion` in `src/lib/assessmentGeneration.ts`.
- The helper permits final QA application only when the current persisted item is still the exact same AI-owned checkpoint: same item identity, immutable mapping, points, question type, prompt, answer, rationale and snapshots; it must also remain unlocked and AI-owned.
- If a teacher edit, lock, mapping/point change, or unrelated replacement occurred, the operation is rejected and existing content is preserved.
- `AssessmentNewPage` now selects pending questions using the canonical `hasExistingAssessmentContent()` guard, so Retry/Resume skips all already-saved meaningful content instead of attempting to regenerate it.
- The normal overwrite protection remains unchanged and is not weakened.

## Latest CI E2E failures fixed

The prior main run already passed static/type/unit/build, fresh migrations, upgrade migrations and all 12 Supabase integration tests. Two Playwright assertions remained stale:

1. Export preview expected `assessment-document-question-visual` directly on the SVG. The current TikZ reliability renderer places that class on the visual shell while keeping a deterministic `svg.assessment-diagram` fallback inside. The test now verifies the shell and nested SVG/viewBox.
2. `openAssessmentList()` expected the old boundary text `Finalized TOS → teacher-reviewed items`. The production copy is now `Finalized TOS → point plan → teacher review`; the helper now asserts the current contract.

No production UI was changed to satisfy these E2E assertions.

## Regression coverage added

Unit tests now verify that:

- the finalized QA suggestion can replace its exact own pass-1 AI checkpoint; and
- a teacher-edited checkpoint is still protected and rejected.

## Inherited V2 fixes preserved

This package still includes:

- Assessment Generation V2 three-step wizard;
- Gemini master planner JSON-mode HTTP-400 fix (no provider `responseSchema`);
- HIGH thinking and 3.6 → 3.5 → 3.5 Flash-Lite → 3.1 Flash-Lite planner fallback order;
- migration 029 visual checkpoint RPC guard fix;
- CPD/type compatibility and deterministic point buckets;
- frozen master plan and point-range numbering;
- TikZ visual reliability/cache/sanitizer fixes;
- results/export V2 compatibility.

## Validation executed in this sandbox

Passed:

- `node scripts/check-assessment-generation-v2.mjs`
- `node scripts/check-assessment-math-visuals.mjs`
- `bash -n scripts/test-db-migrations.sh`
- TypeScript parser gate across 214 source/test/Edge TS/TSX files: 0 parse errors
- comparison against the previous runtime/E2E hotfix showed only the intended production/test files changed before this manifest/handover update
- inherited `assessment-master-planner` still uses JSON MIME + HIGH thinking and does not send responseSchema
- migration 029 remains present

Full Playwright/Vitest was not rerun in this sandbox because the full npm dependency tree is not installed here. The prior GitHub run established the base package's static, migration and integration health; the next pushed CI run is the authoritative browser-suite confirmation for these changed assertions.
