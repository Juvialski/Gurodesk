# Phase 5 merge instructions

This ZIP is a complete GuroDesk project. Its files belong at the project root; do not create a nested wrapper folder. Preserve all Phase 1–4.3 files and validators while merging.

## Phone-first merge

1. Back up the current project.
2. Extract this ZIP directly into the existing project root through AI Studio.
3. Run `npm install` and keep `package-lock.json` in sync.
4. Run the Phase 5 release checklist in `docs/PHASE_5_RELEASE_CHECKLIST.md`.
5. Run every previous validator, `npm run validate:phase50`, `npm run validate:phase51`, `npm run validate:phase52`, `npm run validate:phase53`, `npm run typecheck`, and `npm run build`.

## Supabase deployment

Apply migrations in filename order. A deployment already through Phase 4.3 needs the two new migrations:

- `supabase/migrations/202608080015_phase50_results_foundation.sql`
- `supabase/migrations/202608080016_phase53_remediation.sql`

Deploy the authenticated `remediation-suggester` Edge Function along with existing functions. It accepts only a result-session/competency request plus allowlisted teacher constraints and server-derived aggregate context. Keep Supabase service-role, credential-encryption, and teacher Gemini secrets server-side. Do not add a `VITE_GEMINI_API_KEY` or service-role browser variable.

Before production, perform a staging cross-teacher RLS test: Teacher A must not read, mutate, reference, or export Teacher B's learners, assessments, result sessions, outcomes, remediation plans, or templates. Verify security-definer functions derive ownership from `auth.uid()`, verify all related owners, and use a safe `search_path`.

## Result workflow acceptance

In demo or staging mode, verify a teacher can:

1. Add/edit/deactivate a minimal learner roster and preview a CSV/XLSX import.
2. Start a result session only from a finalized owned assessment.
3. Encode MCQ/True-False/short-answer/constructed-response outcomes in answer-sheet and item modes, with score-only mode visibly marked as unable to produce item analysis.
4. Close and reopen a draft without losing responses; confirm persistence is batched, not one request per cell.
5. View deterministic class, learner, item, option, competency, cognitive, and curriculum-period analysis with explicit insufficient-data states for small classes.
6. Create, edit, override, archive, and (for drafts where safe) delete a neutral remediation plan.
7. Review optional aggregate-only Gemini suggestions without learner names, IDs, or raw answer sheets; accept/edit text explicitly if desired.
8. Open and export Results Summary, Item Analysis, Competency Performance, and Remediation Plan reports. Inspect long PDF/DOCX/Print tables and all seven XLSX sheets.

## Boundaries

Custom result/item-analysis XLSX template upload, mapping confirmation, persistent template storage, and deterministic future filling are architecture-only and must not be presented as working compatibility. Built-in exports remain supported. Learner/result retention is governed by the school's approved policy; this package does not invent a statutory period.

Stop after Phase 5.3. The exact next recommendation is **Phase 5.4 Production Acceptance & Deployment Validation**. Do not start the full grading/class-record system, report-card computation, awards/ranking, portals, or AI grading without separate explicit authorization.
