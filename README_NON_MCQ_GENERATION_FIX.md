> **Historical note.** Provider-side assessment schemas were later removed from normal generation after further live regressions. Current normal generation uses JSON MIME mode only and authoritative server-side validation; see `README_ASSESSMENT_JSON_MIME_RESTORE.md`.

# GuroDesk non-MCQ generation + CI static validator correction

This correction follows the production retest where Multiple Choice and True/False generated successfully but other formats still failed individually.

## Changes

1. Provider JSON schema is now deliberately shallow for question generation/repair.
   - Gemini still receives `application/json` structured output with the fixed question-type discriminator.
   - The provider is no longer asked to validate a large nested schema for each complex assessment format.
   - Exact per-type shapes remain mandatory in the prompt and are validated server-side by `validateCandidate()` before any suggestion reaches the teacher.
   - This does not add an API call and does not weaken TOS, answer, resource, or type validation.

2. Phase 4.4 static validator updated for the resumable batch architecture.
   - The old validator looked for the obsolete literal variable name `saveAssessmentDocument(merged...)`.
   - The current architecture checkpoints every success and persists `saveAssessmentDocument(latest...)` after the run.
   - The validator now checks those actual resilience invariants instead of a stale implementation detail.

No database migration. No RLS changes. No scoring changes.
