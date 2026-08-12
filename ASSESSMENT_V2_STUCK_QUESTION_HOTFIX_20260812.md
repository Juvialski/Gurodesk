# Assessment V2 stuck-question hotfix — 2026-08-12

## Problem

Assessment Generation V2 could repeatedly pause on the same logical question (for example 13/20 completed) while showing only:

> Assessment AI could not complete this request. Your assessment draft remains unchanged.

The completed questions were checkpointed correctly, but a single provider response that failed the strict GuroDesk question contract had no automatic correction pass. Several safe `AssessmentContractError` messages were also collapsed into the generic catch-all, hiding the exact cause and question type.

## Fix

1. Added one bounded question-contract correction pass in `assessment-question-generator`.
   - The first response is still validated by the existing strict per-type contract.
   - If the completed provider response fails that contract — including the frozen required/helpful visual-question dependency contract — GuroDesk requests exactly one fresh JSON candidate.
   - When Lite fallback is enabled, the correction uses the opposite Lite model when possible.
   - The rejected provider body is never echoed into the correction prompt; only bounded GuroDesk validator feedback is supplied.
   - Existing provider HTTP fallback and quota boundaries remain unchanged.

2. Safe contract errors are no longer collapsed into the generic runtime message.
   - `AssessmentContractError` text is authored by GuroDesk validators and may be shown directly.
   - Unknown runtime/provider failures still use the generic safe fallback.

3. Edge error responses now include safe diagnostic metadata:
   - operation
   - logical item number
   - question type
   - provider request count when known
   - generator contract version

4. V2 creation UI now identifies the active question and question type while generating and when paused.
   - Example: `Question 14 · Matching type: Matching mappings must map each prompt exactly once.`
   - Completed checkpointed questions are not regenerated on retry.

5. Extended the assessment generation stability validator to protect the bounded correction and exact failure-targeting behavior.

## Safety / invariants preserved

- No teacher-authored, teacher-edited, accepted, or locked item is overwritten.
- Frozen TOS mapping, CPD, question type, point range, and points remain immutable.
- The correction pass does not synthesize content locally; Gemini authors the replacement candidate.
- No endless retry loop was added: one question-contract correction maximum per generation operation.
- Existing quota/rate-limit handling remains bounded.
- Existing word-first question generation and separate TikZ visual pass remain unchanged.

## Validation performed in the packaged source

- TypeScript/TSX syntax transpilation: 216 files, 0 syntax diagnostics.
- `scripts/check-assessment-generation-v2.mjs`: PASS.
- `scripts/check-assessment-math-visuals.mjs`: PASS.
- `scripts/check-assessment-generation-stability.mjs`: PASS with new stuck-question assertions.
- `scripts/test-db-migrations.sh`: shell syntax PASS.

Full dependency-backed type/unit/build and local Supabase E2E should be allowed to run in GitHub CI because the offline working container does not have the repository npm dependencies cached.
