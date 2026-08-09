# GuroDesk Assessment Generation Reliability Hotfix

This hotfix addresses production findings from the Assessment Editor batch generator.

## Fixed

- Batch progress now separates processed, generated, failed, cancelled, and remaining items.
- Failed items are no longer displayed as successfully generated.
- Every successful generated item is checkpointed locally immediately so a page refresh can recover it.
- Interrupted active batches automatically resume only never-processed items after refresh.
- Items that already failed are not automatically retried after refresh, avoiding unnecessary Gemini calls.
- Explicit Cancel pauses the checkpoint instead of silently auto-resuming later.
- Failed item reasons are shown in the editor and remain retryable through Generate missing.
- Provider/quota/credential boundary failures pause the remaining batch instead of burning requests on every item.
- Gemini generate/verify/repair responses request JSON output format through responseMimeType without adding API calls.

## Persistence behavior

During a batch, successful items are kept in the in-memory draft and a bounded on-device localStorage checkpoint. The full assessment is saved to Supabase once at the end of the run. On refresh, recovered items are merged into the draft and saved before remaining never-processed items resume.

No API keys or learner data are stored in the generation checkpoint.

## Files

- src/lib/assessmentGenerationResume.ts
- src/lib/assessmentGeneration.ts
- src/pages/AssessmentEditorPage.tsx
- supabase/functions/assessment-question-generator/index.ts
- tests/unit/assessment-generation-resume.test.ts

No database migration is required.
