# Assessment Generation V2 — Item 14 accepted-answer prompt leak repair hotfix

Date: 2026-08-12

## Production symptom

A resumed Grade 7 Mathematics V2 assessment consistently reached 19/20 saved questions. The remaining slot (Item 14) failed with:

`Question generation failed: The AI response prompt revealed an accepted answer.`

Items 10 and 15 already had saved questions; their bounded visual repair attempts had been exhausted and are teacher-review issues rather than missing-question generation failures.

## Root cause

The Edge question generator already allowed exactly one contract-correction pass after a completed Gemini response failed GuroDesk's strict assessment contract. However, for accepted-answer prompt leaks the correction prompt contained only the generic validator message:

`The AI response prompt revealed an accepted answer.`

It did not identify the accepted-answer strings that the corrected learner prompt must avoid. For `identification`, `short_answer`, and `fill_in_the_blank` questions, a model could therefore repeat the same target term from the competency/master-plan task intent and fail the same semantic check on every Resume attempt.

The answer-leak validator itself is correct and remains enabled. This hotfix repairs the generation instructions rather than allowing answer-revealing questions through.

## Fix

### Stronger first-pass anti-answer-leak instructions

The Edge generation prompt now explicitly requires:

- short-answer prompts to omit every accepted answer from learner-facing wording;
- identification prompts to describe properties/evidence without naming the target term;
- fill-in-the-blank prompts to replace target answers with visible blank markers and never repeat those answers elsewhere; and
- accepted answer text to remain only in the answer object even when the frozen competency/master-plan task intent contains the term.

### Exact bounded correction guidance

When the first completed JSON candidate is rejected specifically because its learner prompt reveals an accepted answer:

1. GuroDesk keeps the existing one-correction limit.
2. It extracts only the bounded accepted-answer strings from the rejected typed answer object.
3. Those strings are supplied to the correction model as explicit **forbidden learner-prompt terms**.
4. Type-specific rewrite guidance is added:
   - identification → infer from properties/relationships without naming the term;
   - fill in the blank → replace target answers with `_____` / `[blank]` markers;
   - short answer → ask for the result/relationship/explanation without stating it.
5. The correction model is told to write a fresh prompt instead of copying the rejected prompt.
6. The corrected JSON still passes the same strict shared assessment contract before anything is saved.

The rejected full provider body is not echoed into the correction prompt. Only the bounded accepted-answer strings needed to describe the semantic defect are included.

## Safety and architecture preserved

- No answer-leak validator was weakened or removed.
- Frozen TOS competency/CPD mappings remain unchanged.
- Frozen master-plan question type, points, point ranges and visual requirement remain unchanged.
- Existing 19 saved questions are not regenerated.
- Teacher-edited/manual/locked content remains protected.
- Required visual failures still block finalization, while they can be handled in teacher review after all question text exists.
- The correction remains bounded to one contract-correction pass; no endless retry loop was added.
- Existing provider fallback and MAX_TOKENS fallback remain separate bounded mechanisms.
- Master-planner model order and V2 persistence are unchanged.

## Diagnostics

The assessment Edge generator contract marker is bumped to:

`2026-08-12-question-contract-retry-v3`

This makes it possible to distinguish the deployed answer-leak repair version from the prior retry-v2 function in Supabase logs/error payloads.

## Validation executed in this sandbox

Passed:

- `node scripts/check-assessment-generation-stability.mjs`
- `node scripts/check-assessment-generation-v2.mjs`
- `node scripts/check-assessment-math-visuals.mjs`
- `bash -n scripts/test-db-migrations.sh`
- TypeScript parser/transpile gate across 213 executable TS/TSX files: 0 syntax diagnostics

Regression source assertions were added to verify that the Edge correction includes exact forbidden-answer guidance, identification/fill-blank rewrite rules, a fresh-prompt instruction, and the retry-v3 contract marker.

Environment limitation: the complete npm/Vitest/Playwright dependency tree is not installed in this sandbox, so the next GitHub CI run remains the authoritative full dependency-backed confirmation.

## Deployment requirement

`supabase/functions/assessment-question-generator/index.ts` changed. The **assessment-question-generator Edge Function must be redeployed**. A Render/frontend-only deployment will not activate this fix.

After deployment, reopen the existing 19/20 assessment and use **Resume generation**. GuroDesk should preserve the 19 completed questions and retry only the blank Item 14 with the corrected semantic-generation contract.
