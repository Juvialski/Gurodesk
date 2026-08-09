# GuroDesk handover — completed through Phase 5.3

## Stop boundary

The authorized implementation run is complete through:

1. Phase 4 TOS hotfixes
2. Phase 4.1 Assessment Engine Foundation
3. Phase 4.2 AI Question Generation
4. Phase 4.3 Student Test / Teacher Copy / Answer Key exports
5. Phase 5.0 Learner / Results Foundation
6. Phase 5.1 Results Encoding
7. Phase 5.2 Deterministic Item Analysis
8. Phase 5.3 Remediation and Results/Analysis Reports

**Stop here. Do not begin the full grading/class-record system, report-card computation, awards/ranking, student/parent portals, or automated learner grading by AI without explicit approval.** The next recommended work is Phase 5.4 Production Acceptance & Deployment Validation.

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

The implementation distinguishes official rules, product good practice, and school/division conventions. AI drafts questions and may optionally suggest aggregate remediation activities; it does not determine grades, change curriculum allocation, replace professional judgment, or receive learner identity or raw result evidence.

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

After deployment and phone acceptance testing, request explicit approval for **Phase 5.4 Production Acceptance & Deployment Validation**. Do not infer scores, grading rules, analytics, or remediation behavior from local conventions, and do not start grading/class-record work without a separate explicit authorization.

## Phase 5 implementation summary

The Phase 5 work is intentionally teacher-owned, privacy-minimized, and deterministic:

- A class learner needs only an internal UUID, owning teacher, assignment/section, display name, optional teacher-local reference, and active/inactive state. LRN and unrelated identity, contact, health, guardian, socioeconomic, and authentication fields are not required.
- A result session belongs to one finalized assessment, one teacher-owned assignment/section, and one administration date. It snapshots the assessment title, item order, structured answers, possible points, verified competency/cognitive mappings, and curriculum-period traceability. Finalized history therefore does not silently change when a draft assessment, TOS, or curriculum source changes.
- Objective outcomes are scored by the saved answer key. Exact/normalized matching is conservative and constructed responses remain teacher-scored. Score-only sessions provide totals but explicitly have no item analysis.
- Persistence is draft-first and batched: the client prepares bounded complete outcome payloads and the database replaces them transactionally rather than writing one network request per answer. Analysis reads bounded session/participant/item data rather than issuing N+1 learner/item requests.
- Item facility is `correct / attempted` for correctness-applicable responses, with omitted responses separate. Multiple-choice option percentages use the attempted response denominator. Binary objective item-rest correlation is Pearson correlation between item 0/1 and rest-of-test score; partial-point analysis uses normalized item points and is labelled accordingly. Correlation returns an explicit insufficient-data state when `n < 10` or either variable has zero variance.
- Aggregates are grouped by immutable verified competency, cognitive category, and curriculum period. Class summaries include average, median, high, low, and percentage distribution without public ranking. Learner summaries are available only to the owning teacher.
- Remediation signals use a teacher-configurable threshold and neutral language such as “Needs additional evidence/practice for Competency X.” The teacher selects or overrides the participant scope, target competencies, activity, schedule, follow-up evidence, and notes. Optional Gemini support receives only aggregate competency context and allowlisted teacher constraints; it receives no names, learner IDs, or answer sheets.
- Reports include Results Summary, Item Analysis, Competency Performance, and Remediation Plan modes. Teacher-authorized outputs may include names where appropriate, while PDF/DOCX/print documents contain no GuroDesk branding, prompts, AI metadata, technical audit information, or internal IDs. The combined XLSX contains Summary, Learner Scores, Item Analysis, Option Analysis, Competency Analysis, Cognitive Analysis, and Remediation sheets with deterministic values written directly.

## Phase 5 migrations and deployment boundary

Apply migrations in filename order through:

15. `supabase/migrations/202608080015_phase50_results_foundation.sql`
16. `supabase/migrations/202608080016_phase53_remediation.sql`

Deploy the aggregate-only `remediation-suggester` Edge Function in addition to the existing functions. Security-sensitive SQL must derive ownership from `auth.uid()`, verify the assignment/assessment/result relationship, use safe `search_path` in security-definer functions, and keep learner/result tables under strict teacher-owned RLS. A staging migration runner and live cross-teacher RLS/Edge smoke test were not available in this sandbox; complete them in Phase 5.4.

## Privacy, policy, and deletion boundary

The official policy register is `docs/DEPED_SOURCE_REGISTER.md`. DepEd Order No. 015, s. 2026 is treated as the current official classroom-assessment source. It does not turn GuroDesk's facility labels, correlation minimum, remediation threshold, or spreadsheet layout into national mandates. Those are mathematical definitions or configurable product conventions. Local school/division forms, signatories, and retention practice remain configurable and must be confirmed by the responsible school/division.

Learners referenced by a result session are deactivated rather than destructively removed. Draft result sessions and safe imported drafts may be deleted with their dependent outcomes and draft remediation plans; finalized historical records remain linked and teacher-owned. No statutory retention period is invented by the application; the school must apply its approved privacy, records, and deletion policy.

## Known limitations

- Custom result/item-analysis XLSX template support is architecture-only: the safe worksheet inspector and field catalog exist, but recurring upload → map → confirm → store → fill compatibility is not claimed.
- Live Supabase migration application, production RLS isolation, Edge Function deployment, and real Gemini requests were not exercised in the sandbox.
- Built-in result/report PDF, DOCX, print, and seven-sheet XLSX exports are implemented; arbitrary custom assessment DOCX repeating blocks remain deferred.
- This release does not contain the full grading/class-record system, report-card calculations, awards/ranking, learner/parent portals, or AI-assigned grades.

## Release validation

Run all previous validators plus:

```bash
npm run validate:phase50
npm run validate:phase51
npm run validate:phase52
npm run validate:phase53
npm run typecheck
npm run build
```

The Phase 5 validators cover roster/result/scoring edge cases, small-class and omitted-response analysis, immutable mapping traceability, remediation neutrality, report privacy/branding boundaries, XLSX sheet completeness, long-table pagination helpers, and batch-persistence architecture. See `docs/PHASE_5_RELEASE_CHECKLIST.md` for phone and staging acceptance.

### Phase 5 final regression result

On 2026-08-09, one clean retained release run passed:

- curriculum manifest validation;
- every Phase 2–4.3 validator listed in `README.md`;
- `validate:phase50`, `validate:phase51`, `validate:phase52`, and both Phase 5.3 report/security gates;
- `npm run typecheck`; and
- `npm run build` (2,021 modules transformed successfully).

The only build diagnostic was Vite's non-fatal large-chunk advisory. The Phase 5.1 gate also statically verifies the phone layout, stacked class rows, and 44–46 px primary answer/navigation targets.

Export QA generated a 40-learner × 50-item fixture and verified all four PDF/DOCX report modes. Rendered PDF and Word pages were visually inspected for wrapping, clipping, and long-table pagination; the Word learner summary was verified at two pages and the item analysis at six pages. The combined XLSX opened successfully with all seven expected sheets, 40 learner rows, 50 item rows, complete option/competency/cognitive/remediation data, and no formula dependency. A report-content scan found no GuroDesk/Gemini/AI metadata or internal UUIDs, and a source scan found no committed API key, service-role key, JWT, or private key value.

Live Android/iOS and staging Supabase acceptance remain Phase 5.4 checks; they are not represented as completed by local static/render validation.

The connected GitHub integration was given one authorized write-capability attempt against `Juvialski/Gurodesk` and returned HTTP 403 (`Resource not accessible by integration`). No further GitHub write or authentication troubleshooting was attempted; use the complete root-level ZIP for the phone/AI Studio merge.
