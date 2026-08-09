# Phase 4.4 implementation manifest

## Domain and persistence

- `src/types/assessment.ts`
- `src/lib/assessmentBlueprint.ts`
- `src/lib/assessmentValidation.ts`
- `src/lib/assessmentScoring.ts`
- `src/lib/assessmentDistribution.ts`
- `src/lib/assessmentItemLifecycle.ts`
- `src/lib/assessmentRepository.ts`
- `supabase/migrations/202608090017_phase44_question_type_enum.sql`
- `supabase/migrations/202608090018_phase44_assessment_scoring_qa.sql`

## Generation, QA, editor, and export

- `src/lib/assessmentGeneration.ts`
- `src/lib/assessmentRequestScheduler.ts`
- `src/lib/assessmentFinalReview.ts`
- `src/pages/AssessmentEditorPage.tsx`
- `src/pages/assessmentUi.ts`
- `src/lib/assessmentExportModel.ts`
- `src/lib/assessmentExport.ts`
- `src/components/AssessmentDocumentView.tsx`
- `src/assessment.css`
- `supabase/functions/assessment-question-generator/index.ts`

## Validation and documentation

- `scripts/check-phase44-domain.mjs`
- `scripts/check-phase44-ai-editor.mjs`
- `docs/PHASE_4_4_ASSESSMENT_SCORING_QA.md`
- `package.json` (`validate:phase44`)

The manifest lists the primary Phase 4.4 touch points. Existing Phase 1–5.3 files and validators remain part of the release and are not superseded.

