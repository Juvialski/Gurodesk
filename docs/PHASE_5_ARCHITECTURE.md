# Phase 5 architecture — learner results, analysis, remediation, and reports

Phase 5.0–5.3 extends the finalized assessment workflow with a privacy-minimized, teacher-owned evidence workflow. It stops before the full grading/class-record system. The finalized assessment/TOS remains the historical source of item order, verified competency, cognitive category, curriculum period, structured answer, and possible points.

## Domain boundaries

### Learner roster

A class learner is attached to one teacher-owned assignment/section and initially contains:

- internal UUID;
- authenticated teacher/user owner;
- assignment/class and section;
- display name;
- optional teacher-local reference; and
- active/inactive state and timestamps.

No LRN is required. The roster does not require birth date, address, phone, email, guardian, health/disability, socioeconomic, password, or unrelated profile data. Duplicate display names are allowed with a visible teacher-local distinction; import previews reject empty rows and surface obvious duplicates before save.

If a learner has finalized historical results, deactivation/archive is preferred to destructive deletion. Deletion is reserved for safe drafts or records without dependent historical evidence.

### Result session and immutable evidence

A result session belongs to exactly one authenticated teacher, assignment/section, and finalized assessment. It stores administration metadata and snapshots enough of the finalized assessment to make historical results stable:

- assessment ID and version/snapshot;
- title, item count, possible points, administration date, status, and section;
- ordered immutable item snapshots, including original item number;
- structured question type and answer-key data where appropriate;
- verified competency ID/text, cognitive category, curriculum period ID/label, source TOS/version; and
- the teacher-owned learner participant set.

Outcome rows are normalized per participant/item. Objective outcomes include the learner answer, correctness, and earned points. Constructed responses include teacher-awarded points and optional feedback; correctness may be null where it is not meaningful. Finalized history is not recomputed from a later assessment edit, TOS edit, or curriculum refresh.

## Encoding and scoring

Answer-sheet mode optimizes one learner at a time; item mode optimizes one item across the class; score-only mode records an overall score where item evidence is unavailable. Score-only mode is explicitly marked and returns an insufficient/no-item-analysis result.

The saved structured answer key is authoritative. MCQ and True/False comparisons are deterministic. Short Answer matching is allowed only where the configured exact/normalized mode is explicitly enabled and uses conservative normalization; semantic similarity is never inferred by Gemini. Constructed-response points and feedback are entered by the teacher. Percentage is calculated only when possible points are positive, and display formatting avoids floating-point artifacts.

Drafts are local-first and persisted as bounded complete transactional batches. A 40-learner × 50-item session does not issue one explicit Supabase write per cell. Bounded replacement writes and paged reads avoid per-answer and N+1 learner/item query loops.

## Deterministic item analysis

The reusable analysis engine operates only on immutable result-session snapshots and normalized outcomes. It never calls AI.

For an item where correctness is applicable:

```text
attempted = correct + incorrect
omitted   = unanswered/omitted outcomes
facility  = correct / attempted, when attempted > 0
```

Omitted is reported separately and is not silently added to incorrect. For point-scored items, the engine reports applicable earned/possible point statistics and point facility as earned points divided by applicable possible points.

For an MCQ item, each option count is calculated from attempted answers. Option percentage is `option count / attempted`; the correct option is read from the immutable answer key; omitted count remains separate. A low-count distractor is only a signal for teacher review, never an automatic “bad item” conclusion.

Binary objective item-rest correlation is transparent Pearson correlation between the item's 0/1 score and each learner's rest-of-test score (total score excluding that item). For partial-point items the item score is normalized to `[0, 1]` and the output is labelled normalized item-rest correlation. The metric is unavailable with an explicit insufficient-data state when fewer than 10 usable observations exist or either variable has zero variance. No opaque discrimination score or national cutoff is used.

Aggregates group by the immutable verified competency, cognitive category, and curriculum period ID/label. They report mapped item count, attempts, correct responses, percentage correct, and earned/possible points where applicable. Class summaries report learner count, average, median, highest, lowest, and percentage-score distribution without a public rank list. An individual learner summary reports raw score, percentage, missed items, competency performance, and cognitive-category performance only inside the owning teacher's view.

## Neutral remediation

Remediation signals are instructional evidence, not learner labels. The teacher selects a threshold and comparison basis; the engine can identify competencies or items below that teacher-selected criterion and can identify a whole class or explicitly selected participant IDs within the same teacher-owned result session. The UI uses language such as “Needs additional evidence/practice for Competency X.”

A remediation plan records the result session, target competencies, participant scope, threshold/basis/comparison, teacher-selected target, planned activity, schedule/date, follow-up evidence/check, notes, review state, and optional teacher-edited assistant suggestion. The teacher can override signals, targets, scope, and wording. The engine never invents learner facts or labels a learner weak, slow, deficient, disabled, or incapable.

Optional Gemini remediation support is a teacher assistant only. The allowed context is verified competency, aggregate class percentage/correctness, common incorrect-option counts, cognitive category, number needing additional practice, language preference, and allowlisted teacher constraints/resources. Learner names, learner UUIDs, local references, complete answer sheets, and individual raw response histories are prohibited. Suggestions are previewed, edited, and explicitly accepted; they are never auto-applied and never determine scores.

## Privacy and security

All learner, participant, outcome, result-session, remediation, report, and result-template records are teacher-owned. Client operations must not trust a submitted owner ID. Database policies and justified security-definer RPCs derive ownership from `auth.uid()`, verify the assignment/assessment/result relationship, use a safe `search_path`, and prevent cross-teacher reads, writes, references, and exports. Relevant foreign keys and owner-scoped indexes support bounded result queries.

The browser contains no service-role key, encrypted credential material, or Gemini API key. Learner identity never enters an AI prompt or request body. Reports are teacher-authorized; names are included only where a result report requires them. Submitted documents omit GuroDesk branding, prompts, AI metadata, technical audit information, and internal IDs.

Deletion behavior is predictable: deleting a draft result set transactionally removes its dependent outcomes and draft remediation planning records; learners already referenced by any result set are deactivated instead of deleted; finalized result history is not silently orphaned or destructively removed. The application does not claim or invent a statutory retention period. The school/division must apply its approved privacy, records, access, and deletion policy.

## Reports and templates

The shared export model supports four report modes:

1. Assessment Results Summary
2. Item Analysis
3. Competency Performance
4. Remediation Plan

Built-in exports support Print, PDF, DOCX, and a combined deterministic XLSX workbook with these sheets:

`Summary`, `Learner Scores`, `Item Analysis`, `Option Analysis`, `Competency Analysis`, `Cognitive Analysis`, and `Remediation`.

Application-calculated values are written directly; formulas are not required for correctness. Long tables use explicit pagination helpers. The report preview model is teacher-authorized and can include learner names in the appropriate summary/learner sheet, while analysis/remediation views avoid unnecessary names.

Custom result/item-analysis XLSX templates are not falsely advertised as complete. `resultsTemplate.ts`, the field catalog, and the safe PizZip worksheet inspector establish the architecture for upload → inspect → map → teacher-confirm → store → deterministic fill. Recurring compatibility, mapping persistence, and future filling still require a later implementation and acceptance phase. Existing Phase 3.7 lesson DOCX and Phase 4 TOS XLSX behavior remains intact.

## Policy boundary and release status

DepEd Order No. 015, s. 2026 and official privacy guidance are registered in `docs/DEPED_SOURCE_REGISTER.md`. Official policy, mathematical measures, GuroDesk defaults, and school/division conventions are intentionally distinguished. Facility, item-rest minimum `n`, labels, remediation thresholds, workbook sheets, and layouts are not represented as national DepEd mandates.

Phase 5.0–5.3 validators are present alongside all earlier validators. Local deterministic checks and build/type checks belong in the release gate. Live Supabase migration/RLS isolation, Edge Function deployment, and real Gemini requests were not exercised in the sandbox and are required for **Phase 5.4 Production Acceptance & Deployment Validation**. Full grading/class-record computations, report cards, awards/ranking, portals, and AI grading are explicitly outside this release.
