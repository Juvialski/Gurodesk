# Assessment Generation V2 — 19/20 recovery + review handoff hotfix

Date: 2026-08-12

## Production symptoms addressed

A resumed V2 assessment reached 19/20 saved questions but remained trapped behind the generation-only screen. Automatic QA repeatedly reported blockers in Items 10 and 14. Item 10 already had a saved question but its required visual/repair workflow exhausted bounded retries, including a MAX_TOKENS repair failure. One logical question remained blank.

## Root causes

1. V2 completion treated a failed/pending required visual as identical to a missing question. This meant a fully written question could trap the entire assessment behind the generation screen even after bounded visual repair had been exhausted.
2. Missing-question recovery was too dependent on `authorshipState === 'empty'` / `hasExistingAssessmentContent()`. An interrupted AI attempt can leave a blank prompt with machine-owned lifecycle metadata, causing that blank slot to be skipped forever.
3. `autoPrepareAssessmentPaper()` discarded non-provider `generateMissingAssessmentItems().errors`, so a repeatedly failing missing item could remain invisible in the final summary.
4. A MAX_TOKENS response did not receive the normal Lite fallback path, even though truncation is safe to retry once with a more concise instruction.
5. The automatic QA loop could revisit the same blocked question/visual across multiple rounds after its dedicated repair path was already exhausted.

## Fixes

### Recover blank machine-owned slots

Added `assessmentItemNeedsQuestionGeneration()`.

A question is recoverable only when:
- its learner prompt is blank;
- it is not locked;
- it is not teacher-edited;
- it is not teacher-accepted; and
- it is not manual/teacher-authored.

If an interrupted AI attempt left AI lifecycle/default answer metadata on that blank slot, generation performs an explicit machine-draft recovery replacement. The existing strong `hasExistingAssessmentContent()` overwrite guard remains unchanged.

The helper is used by:
- initial/resumed V2 creation;
- editor resume/checkpoint recovery;
- bulk missing-question generation; and
- automatic paper preparation.

### Separate generation completeness from teacher-review blockers

V2 now keeps question previews hidden until every logical question has learner-facing prompt text.

A failed/pending required diagram no longer means "question generation incomplete." Instead, once all question text exists, bounded visual/QA failures move into teacher review.

**Finalization is not weakened.** `reviewAssessmentForFinalization()` still emits the hard `required-visual-not-ready` error and refuses finalization when an essential required diagram is not successful.

### MAX_TOKENS fallback

`assessment-question-generator` now treats a Gemini `MAX_TOKENS` response as eligible for one bounded alternate-Lite-model retry when fallback is enabled.

The retry adds a concise instruction to omit optional rubric/subpart verbosity while preserving all frozen assessment constraints. It does not retry quota 429 boundaries and does not create an endless loop.

This applies to both normal question generation and the existing question-repair path that uses the same bounded Lite fallback helper.

### Bounded repair rounds

Automatic preparation now permits at most:
- one automatic full-question repair per blocked item; and
- one dedicated visual repair per blocked item.

Once those paths are exhausted, the saved question is preserved for teacher review rather than repeating the same provider work over three QA passes.

Duplicate repair-failure messages are collapsed to the latest safe message per item.

### Preserve missing-question diagnostics

Non-provider generation failures from the missing-question batch are now retained in the preparation failure summary with the affected item number, so a future failure cannot silently appear only as `19/20 questions saved`.

## Safety invariants preserved

- Frozen TOS mapping is unchanged.
- Frozen master-plan question type, CPD, points, point ranges and plan-entry identity are unchanged.
- Teacher-edited, teacher-accepted, manual and locked items are not auto-replaced.
- Required visuals remain hard finalization blockers.
- Existing generated questions are not regenerated merely because another item failed.
- Master planner remains Gemini 3.6 Flash → 3.5 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite with HIGH thinking and no provider responseSchema.
- Migration 029 remains present.

## Validation executed here

Passed:
- `node scripts/check-assessment-generation-v2.mjs`
- `node scripts/check-assessment-generation-stability.mjs`
- `node scripts/check-assessment-math-visuals.mjs`
- `bash -n scripts/test-db-migrations.sh`
- parser gate across 214 TS/TSX source/test/Edge files: 0 syntax diagnostics
- required-visual finalization guard confirmed present
- migration 029 confirmed present
- master planner model order confirmed unchanged

Regression tests were added for:
- recovering a blank AI-owned interrupted slot;
- preserving blank teacher-owned/manual slots; and
- preventing repeated automatic question repair across QA rounds.

Environment limitation:
- `npm ci` cannot complete in this sandbox because the npm dependency fetch is unavailable; therefore dependency-backed Vitest/Playwright/build verification must run in GitHub CI after push.
