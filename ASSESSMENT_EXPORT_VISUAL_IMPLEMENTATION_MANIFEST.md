# Assessment export and visual stabilization checkpoint

Date: 2026-08-11

Starting source: `Juvialski/Gurodesk` `main` at `46a912fb0ed0a8571c9820dec596f96ea32697d2`

This checkpoint completes Phase A of the 2026-08-11 implementation handoff. It does not claim that Phase B official curriculum ingestion is complete.

## Canonical assessment-paper architecture

`src/lib/assessmentExportPresentation.ts` is the renderer-neutral semantic source of truth for assessment paper presentation. It owns:

- official/school identity lines;
- document title and assessment metadata rows;
- section order and labels for all eleven question types;
- learner response controls and answer-space policy;
- teacher and answer-key annotations;
- visual sizing intent; and
- continuation-header text.

The React preview, browser print HTML, jsPDF export, and DOCX export all consume that model. Renderer-specific code is limited to layout mechanics such as measurement, page breaks, native Word tables, and image embedding. The shared model prevents each output mode from independently deciding headings, instructions, response space, or question-type semantics.

The canonical Test 4 fixture contains exactly 20 items, 41 total points, all eleven question types, contiguous type sections, and five deterministic visuals. It is used for structural equivalence and export regression tests.

## Visual enrichment pipeline

Question generation and visual generation are separate bounded passes:

1. Generate and validate the question plus structured answer.
2. Persist/checkpoint that paid-for question.
3. Resolve a deterministic visual plan (`none`, `helpful`, or `required`) bound to a source hash of the question and answer.
4. Run eligible visual requests sequentially in stable item order through the existing bounded provider scheduler.
5. Validate the returned visual DSL, checkpoint each success, and persist it without rewriting question text or answer data.

Helpful visual failures keep the completed question and surface a warning. Missing required visuals remain finalization blockers. Provider quota/rate-limit boundaries pause the remaining visual batch. Editing prompt/answer content invalidates an old visual plan/visual by source hash; the editor provides an explicit visual-only Generate/Regenerate action.

The resumable generation checkpoint is version 2 and can load version 1 records. It tracks question and visual phases separately, including bounded attempts and exact question/mapping recovery. A question-stage failure cannot erase a previously checkpointed question.

## Persistence and trust boundary

The existing assessment answer JSON stores bounded `_visual` and `_visualPlan` metadata, so no database migration is required. Save/load and duplicate flows retain valid visual plans, visuals, source hashes, and bounded history. Material content edits mark old visual state stale.

The authenticated `assessment-question-generator` Edge Function now verifies that a visual request's prompt and structured answer match the authoritative saved assessment item before a provider call. Browser-supplied visual geometry remains untrusted. Gemini may return only the existing bounded visual JSON DSL; GuroDesk remains the sole author of SVG/TikZ/export markup.

## Export behavior verified

- The student, teacher, and answer-key modes share one paper hierarchy.
- PDF point values are aligned separately from prompts and cannot overwrite prompt text.
- DOCX uses a native identity block, metadata table, section headings, response controls, continuation header, and embedded visual drawing relationships.
- Matching blocks are wrapped in a non-splitting Word table row so the final choice is not orphaned.
- Word writing areas use visible deterministic rules rather than borders that LibreOffice can collapse.
- PDF and Word visuals were rendered and visually inspected from the canonical Test 4 fixture.
- Filipino true/false, unit, and continuation labels are retained by the shared presentation model.

## Files of note

- `src/lib/assessmentExportPresentation.ts`
- `src/components/AssessmentDocumentView.tsx`
- `src/lib/assessmentExport.ts`
- `src/lib/assessmentVisualPlanning.ts`
- `src/lib/assessmentGeneration.ts`
- `src/lib/assessmentGenerationResume.ts`
- `src/lib/assessmentRepository.ts`
- `src/lib/assessmentFinalQa.ts`
- `src/pages/AssessmentEditorPage.tsx`
- `supabase/functions/assessment-question-generator/index.ts`
- `tests/fixtures/test4Assessment.ts`
- `tests/unit/assessment-paper-canonical.test.tsx`
- `tests/unit/assessment-visual-enrichment.test.ts`
- `scripts/check-assessment-paper-visual-enrichment.mjs`

## Schema and deployment impact

Database migrations added: none. Migration count remains 26.

Deployment requirements for this checkpoint:

1. Merge/deploy the frontend and Edge Function from the same commit.
2. Redeploy `assessment-question-generator`; its visual operation contains the new authoritative saved-item comparison.
3. No curriculum seed/import or database migration is required for Phase A.
4. Keep only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in frontend environment variables.
5. Run the production assessment smoke flow with a teacher BYOK key, including refresh during visual enrichment and student/teacher/key exports.

## Verification result

The CI-equivalent local command `npm run test:ci` passed on 2026-08-11:

- application TypeScript check: passed;
- unit-test TypeScript check: passed;
- E2E TypeScript check: passed;
- static validators: 33/33 passed;
- unit tests: 229/229 passed across 22 files;
- production Vite bundle: passed (2,048 modules transformed).

The only bundle diagnostic was the pre-existing non-fatal large-chunk advisory.

The canonical Test 4 PDF rendered as five A4 pages. The DOCX opened through LibreOffice and rendered as four A4 pages. Both were inspected after correcting prompt/point overlap, response-line collapse, matching pagination, and inter-run spacing.

Docker and `psql` are not available in this workspace, so the disposable Supabase fresh/upgrade migration gate, authenticated integration tests, and Chromium E2E execution remain CI-owned. They must not be reported as locally passed.

