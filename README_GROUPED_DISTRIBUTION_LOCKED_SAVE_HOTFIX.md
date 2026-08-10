# Assessment grouped-section + locked-save hotfix

Date: 2026-08-10

- Auto/Balanced distribution now lays out each enabled question type as one contiguous test-paper section in the fixed UI order (MCQ, True/False, Short Answer, ...), not round-robin.
- Completed/edited/accepted/locked items remain protected. Remaining empty slots are reconciled proportionally to the remaining target deficits, then grouped by type.
- Reloading a Matching answer no longer injects `reusableChoices:false` when the canonical stored value omitted it. This prevents an unchanged locked Matching item from becoming JSON-distinct and blocking the next full draft save / Generate missing run.
- Phase 4.4 static validation now checks the persisted `unlockAssessmentItem` lifecycle helper instead of the removed `qaState: unlocking` implementation detail.
- No database migration or RLS change.
