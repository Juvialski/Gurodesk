# GuroDesk assessment unlock + single-blank recovery hotfix

Date: 2026-08-10

## Fixed

- Explicit item unlock is now persisted immediately through `saveAssessmentDocument` instead of being a client-only toggle. A reload or later final-review save can no longer resurrect the stale server-side lock.
- Unlock uses the shared assessment item lifecycle helpers and clears both `locked` and `qaState=locked` consistently.
- A structurally blocked item encountered by **Accept, verify & finalize all** is left unlocked so the teacher can repair it immediately.
- Legacy fill-in-the-blank items with exactly one visible underscore blank marker and a lost `answer.blanks` array can recover their newest valid single-blank answer from bounded item history.
- If no prior accepted answer exists, GuroDesk creates only the missing blank shell. It never guesses an accepted answer from rationale or prompt text.
- Multi-blank prompts remain strict and are never auto-inferred.

## Validation

- `scripts/check-assessment-math-visuals.mjs`: PASS
- BYOK validator: PASS
- E2E stability validator: PASS
- Phase 6 national curriculum validator: PASS
- Phase 6 custom/hybrid validator: PASS
- migration shell syntax: PASS
- migration count: 26
- semantic TypeScript check for lifecycle/scoring/types: PASS
- changed TS/TSX/test transpile diagnostics: PASS

GitHub Actions remains the complete unit/build/Supabase/Chromium release gate.
