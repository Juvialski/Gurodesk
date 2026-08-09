GuroDesk Phase 5.5 Consolidated Hotfix 024

BASE EXPECTATION
- Apply on top of current main commit 73718d7 or newer equivalent Phase 5.5 hotfix state.
- Do not remove migrations 021-023.

FIXES INCLUDED
1. New migration 024 fixes guard_remediation_child_owner so remediation_plan_targets no longer references a missing result_session_id field.
2. Assessment repository validates item numbering before immutable TOS mapping, producing precise contiguous/duplicate errors.
3. Integration existing-draft save fixture now uses the same manual-edit authorship/QA lifecycle as the real AssessmentEditorPage. The prior fixture created an invalid `empty + prompt` combination that production UI never creates.
4. Local disposable test teardown treats owner-only trigger refusals as expected best-effort cleanup failures; RLS behavior assertions themselves are unchanged.
5. Migration harness advances from 23 to 24 migrations.

EXPECTED NEXT CI
- fresh migration: 001-024
- upgrade migration: 001-014 + fixture + 015-024
- integration: should no longer fail on empty-authorship fixture, numbering error mismatch, remediation target trigger field access, or teardown owner guard
- RLS test should receive the remediation fixture instead of cascading from the remediation save failure

DO NOT
- rewrite migrations 001-023
- weaken RLS
- skip tests
- change production features
