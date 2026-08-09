# GuroDesk handover — completed through Phase 4.3

## Stop boundary

The authorized overnight run is complete through:

1. Phase 4 TOS hotfixes
2. Phase 4.1 Assessment Engine Foundation
3. Phase 4.2 AI Question Generation
4. Phase 4.3 Student Test / Teacher Copy / Answer Key exports

**Do not begin results encoding, grading, item analysis, distractor statistics, learner analytics, remediation, or any other Phase 5 work without explicit approval.**

## Product state

GuroDesk remains a Vite/React/TypeScript, mobile-first DepEd-teacher workspace with Supabase Auth, strict teacher-owned RLS, a localStorage demo mode, verified curriculum data, ILAW lesson planning, teacher-owned Gemini BYOK, lesson/TOS custom-template support, and deterministic TOS allocation.

The assessment route is now live:

- `/assessments`
- `/assessments/new`
- `/assessments/:id`
- `/assessments/:id/print`

## Phase 4 hotfixes

`src/lib/tosRepository.ts` resolves selected competencies in bounded set queries rather than a subject/version/period query chain per row. It preserves canonical UUID matching, Phase 3.5.1 fallback snapshot matching, verified-only filtering, subject/version/period checks, and ambiguous/stale rejection. The final `save_tos_document` RPC remains authoritative.

`src/lib/tosPdfPagination.ts` and `src/lib/tosExport.ts` use rendered-height budgets, split oversized rows into continuation segments, repeat table headers, paginate notes, and preserve every wrapped line. The previous capped row height and eight-line slice were removed.

## Phase 4.1 architecture

Important files:

- `src/types/assessment.ts`
- `src/lib/assessmentBlueprint.ts`
- `src/lib/assessmentFactory.ts`
- `src/lib/assessmentValidation.ts`
- `src/lib/assessmentRepository.ts`
- `src/pages/AssessmentsPage.tsx`
- `src/pages/AssessmentNewPage.tsx`
- `src/pages/AssessmentEditorPage.tsx`
- `src/pages/assessmentUi.ts`
- `src/assessment.css`
- `supabase/migrations/202608080013_phase41_assessment_engine.sql`

Rules that must not be weakened:

- Creation requires a finalized TOS owned by the same teacher and assignment.
- The server stores the source document ID, exact source version, raw source content, and one immutable canonicalized TOS snapshot.
- Canonicalization resolves Phase 3.5.1 local fallback IDs from the finalized relational TOS projection; it does not permit client-chosen curriculum identity.
- Exactly one item slot exists for every integer item number `1..N`.
- Item number, TOS row, canonical competency, cognitive category, allocation range, and snapshots are immutable.
- Question content is structured, not stored only as formatted document text.
- Supported types are Multiple Choice, True/False, Short Answer, and Constructed Response.
- Drafts may be incomplete. Finalization requires complete type-valid answers, positive points, and teacher-reviewed authorship state.
- Final and archived assessments are immutable; duplication creates a new draft with fresh item IDs.
- Demo and Supabase persistence use the same domain model.

## Phase 4.2 architecture

Important files:

- `src/lib/assessmentGeneration.ts`
- `supabase/functions/assessment-question-generator/index.ts`
- `supabase/migrations/202608080014_phase42_assessment_ai_audit.sql`
- `supabase/functions/_shared/ai-models.ts`
- `supabase/functions/_shared/gemini.ts`

Browser → authenticated `assessment-question-generator` Edge Function → ownership/mapping recheck → decrypt active teacher credential → Gemini → parse/validate JSON → candidate preview.

The endpoint receives an assessment/item identity and server-loads the teacher-owned draft and immutable mapping. It does not trust browser-supplied item number, competency, cognitive category, or curriculum identity. Prompts include the verified competency, assigned cognitive level, teacher-selected question type, language preference, and teacher-supplied context/resources only.

Resource guardrails prohibit invented textbook/module/site/page/device/app/worksheet/school/community details. Learner PII must not be sent. The endpoint returns one validated candidate and never writes it into the assessment automatically.

Model behavior remains:

- default `gemini-3.5-flash-lite`, high thinking;
- fallback `gemini-3.1-flash-lite`, high thinking;
- automatic fallback Lite-only;
- finite retry/backoff for transient failures; and
- bounded client batch concurrency with cancellation and per-item partial success.

Authorship states are `empty`, `ai_suggestion`, `teacher_accepted`, `teacher_edited`, and `manual`. Finalization rejects unaccepted suggestions.

## Phase 4.3 architecture

Important files:

- `src/types/assessmentExport.ts`
- `src/lib/assessmentExportModel.ts`
- `src/lib/assessmentExport.ts`
- `src/components/AssessmentDocumentView.tsx`
- `src/pages/AssessmentPrintPreviewPage.tsx`

All modes are derived from one structured export model:

- Student Copy: answers, mappings, AI state, notes, and internal IDs are absent by construction.
- Teacher Copy: structured answer plus optional competency, cognitive category, and rationale.
- Answer Key: compact item-number-to-answer output derived only from saved structured answers.

Each mode supports browser Print, PDF, and editable Word `.docx`. Long content wraps and paginates; short MCQ blocks are kept together when practical while long/constructed content may flow naturally. Filipino/English labels follow existing export preferences and authored question text is never translated during export. Printable assessment documents contain no GuroDesk branding.

Phase 3.7 custom lesson DOCX and Phase 4 custom TOS XLSX behavior remain intact. Arbitrary custom assessment DOCX repeating blocks are not claimed as supported; the shared export model is the prepared extension point.

## Policy review

Assessment design was reviewed against the current official source registered in `docs/DEPED_SOURCE_REGISTER.md`:

- DepEd Order No. 015, s. 2026
- official PDF: `https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf`

The implementation distinguishes official rules, product good practice, and school/division conventions. AI drafts questions only; it does not determine grades, change curriculum allocation, replace professional judgment, or process learner results.

## Migration order

Apply all migrations in filename order. New migrations are:

13. `202608080013_phase41_assessment_engine.sql`
14. `202608080014_phase42_assessment_ai_audit.sql`

Then deploy `assessment-question-generator`; `supabase/config.toml` requires JWT verification.

RLS/security invariants:

- assessment owner = authenticated teacher;
- assignment owner = same teacher;
- source TOS owner/assignment = same teacher;
- source must have been finalized;
- browser sessions have no direct normalized assessment-item writes;
- final mapping and source snapshots are checked by the security-definer save RPC;
- audit metadata contains no prompt, answer, generated content, learner data, or secret;
- service-role and Gemini secrets remain server-only.

## Validation

Run every command in `README.md`. New gates are:

```bash
npm run validate:phase41
npm run validate:phase42
npm run validate:phase43
```

They cover deterministic 1/37/40/43 blueprints, mapping gaps/duplicates/drift, question-type answer validation, final-TOS enforcement, malformed AI output, resource/language guardrails, partial batch failure, Student/Teacher/Answer Key separation, multilingual preservation, and long-flow pagination.

### Final regression result

The completed project passed, in one retained release run:

- curriculum manifest validation;
- every Phase 2–4 validator listed in `README.md`;
- `validate:phase41`, `validate:phase42`, and `validate:phase43`;
- `npm run typecheck`; and
- `npm run build` (1,996 modules transformed successfully).

The only build diagnostic was Vite's non-fatal existing large-chunk advisory. A source scan found no committed API key, service-role key, JWT, private key, or other credential value. `package.json` and the package-lock root metadata are consistent.

## Known limitations and deployment checks

- Built-in assessment PDF, Word, and Print exports are complete. Arbitrary repeating-question blocks in uploaded custom assessment DOCX masters are deliberately deferred; existing Phase 3.7 lesson DOCX and Phase 4 TOS XLSX templates remain supported.
- This sandbox had no PostgreSQL/Supabase/Deno migration runner, so migrations `013` and `014` received static security/contract validation but still require the normal staging migration application and cross-teacher RLS smoke test before production.
- A live Gemini request was not made because it requires a teacher-owned credential and deployed Edge Function. The local deterministic generator, strict JSON validators, malformed/resource-invention rejection, fallback contract, cancellation, retries, and partial-batch preservation were exercised.
- Final Android/iOS visual acceptance should be completed against the deployed build using the checklist in `docs/PHASE_4_3_RELEASE_CHECKLIST.md`.

## Exact next recommended phase

After deployment and phone acceptance testing, request explicit approval for **Phase 5: teacher-entered assessment results and deterministic item analysis**. Design that phase separately; do not infer scores, grading rules, analytics, or remediation behavior from this implementation.
