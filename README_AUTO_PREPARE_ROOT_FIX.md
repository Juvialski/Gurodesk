# Assessment auto-prepare root fix

This hotfix corrects the production blocker-repair loop and the squeezed Source TOS header layout.

## Root cause fixed

The browser previously called `unlockAssessmentItem()` only in memory before asking the hosted `assessment-question-generator` Edge Function for an alternative. The Edge Function reloads the item from Supabase and correctly refuses AI work while the persisted row is locked. Because that 409 was not a provider/quota boundary, the automatic loop swallowed it and continued, making the UI look like blocked items were being regenerated when no replacement request could succeed.

The loop now:

1. identifies machine-owned structural blockers;
2. unlocks those items in the working record;
3. **persists that unlocked checkpoint before any Edge Function regeneration request**;
4. sends the exact deterministic blocker reasons to Gemini as mandatory `AUTOMATIC REPAIR REQUIREMENTS`;
5. reruns deterministic Final Review after each bounded pass;
6. escalates recurring visual blockers on later passes toward a self-contained text-only replacement when the competency can be assessed without a figure;
7. surfaces non-provider repair failures instead of silently swallowing them.

Teacher-authored/teacher-edited items remain protected from automatic replacement. The loop remains capped at three full QA/repair passes.

## UI fix

At tablet/narrow desktop widths the Source TOS summary, progress, and paper-preparation action now stack into a single column. The long action button can no longer squeeze the TOS title into one-character-wide wrapping.

## Regression coverage

The added tests cover persisted-unlock-before-server-repair ordering and non-provider repair failure reporting. A dependency-free runtime simulation also verifies that a persisted locked duplicate and a recurring missing-visual blocker can reach zero structural blockers with the new sequence.
