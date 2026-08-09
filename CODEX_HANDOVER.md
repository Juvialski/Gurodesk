# GuroDesk handover — complete through Phase 5.4

## Release boundary

This release preserves Phases 1–5.3 and completes, in order:

1. **Phase 4.4 — Assessment Type Expansion, Scoring Model, and Accuracy-First Adaptive QA**
2. **Phase 5.4 — Results/Analysis Compatibility, Production Acceptance, and Deployment Readiness**

**Stop here.** Do not begin class records, grading sheets, report cards, attendance, a student portal, a curriculum expansion, or another major teacher workflow without explicit authorization.

The uploaded Phase 5.3 ZIP was inspected first and used as the implementation source. GitHub `Juvialski/Gurodesk` was used only for comparison and did not contain a newer implementation. The previously observed connector write failure was HTTP 403, so no repeated write/authentication attempts were made. This complete root-level project is the merge artifact.

## Phase 4.4 assessment architecture

The finalized TOS remains the allocation authority. Item number, source TOS/version, verified competency, cognitive category, and allocation range are immutable assessment-slot data. Question type and scoring are independent assessment attributes and cannot rewrite that allocation.

One shared `AssessmentItem` architecture now supports eleven discriminated, structured answer payloads:

- Multiple Choice
- True / False
- Short Answer
- Constructed Response
- Identification
- Fill in the Blank
- Numerical Answer
- Problem Solving / Show Your Solution
- Matching Type
- Multiple Select / Select All That Apply
- Essay / Extended Response

The extension points and validators live primarily in `src/types/assessment.ts`, `src/lib/assessmentValidation.ts`, and `src/lib/assessmentScoring.ts`. Objective answers, accepted terms, independent fill blanks, numerical value/tolerance/unit, problem subparts, matching groups/mappings, multiple-select sets, expected elements, and rubrics remain structured data. No answer key is reconstructed by Gemini.

### Item count and point count

Every TOS slot remains one assessment item. Every scored item has a positive `pointsPossible`; total possible points is derived from the item sum. It is not a separately authoritative total. Legacy records without explicit points normalize to one point.

Supported scoring structures include:

- editable type defaults and per-item points;
- optional target points with an explicit remaining/over-target delta and no silent redistribution;
- problem-solving subparts whose explicit point sum must equal the item total;
- per-blank fill scoring whose explicit point sum must equal the item total;
- matching per-response or group scoring with deterministic reconciliation;
- all-or-nothing Multiple Select with no negative marking;
- explicit rubric criteria for Essay/Constructed Response whose point sum must equal the item total; and
- bounded teacher-awarded partial credit from zero through `pointsPossible`.

`src/lib/assessmentDistribution.ts` handles Auto/Balanced, fixed counts, percentages, and manual per-item type assignment. Distribution reconciles deterministically to the immutable slot count; disabled types cannot be assigned or generated. Item percentages and point weights are labelled separately.

### Mobile editor and item lifecycle

`src/pages/AssessmentEditorPage.tsx` renders one active type-specific editor rather than every item editor. It provides Previous/Next, direct numbered navigation, completion state, immutable competency/cognitive badges, type and point controls, structured answer editors, notes, and simple QA states.

The editor includes mobile controls for choices, blanks, numerical tolerance/unit, subparts, matching columns/mappings/distractors/reordering/reuse, multiple-select correct sets, expected responses, key points, and rubrics. It also supports single-item Generate/Replace/Alternative/Check Accuracy actions, bounded version history with restore, lock/unlock, and Generate Missing behavior that skips completed, teacher-edited, accepted, and locked items unless the teacher explicitly targets them.

Material edits preserve a previous version and mark the item teacher-edited. Answer-sensitive edits require recheck without spending an immediate AI request. Locked items cannot be silently changed by batch generation, verification repair, or restore.

### Adaptive Gemini QA

`src/lib/assessmentGeneration.ts`, `src/lib/assessmentQa.ts`, `src/lib/assessmentRequestScheduler.ts`, and the authenticated `assessment-question-generator` Edge Function implement the adaptive flow:

1. Run deterministic structural, answer, scoring, allowed-type, and immutable-mapping validation.
2. Stop after generation for valid low-risk items.
3. Route higher-risk or explicitly requested items to independent verification, preferring the other Lite model.
4. Stop on verifier pass.
5. Repair only the affected item when verification fails, validate again, and stop at a conservative ceiling with teacher review if unresolved.

Default Gemini behavior remains `gemini-3.5-flash-lite` with high thinking and Lite-only automatic fallback to `gemini-3.1-flash-lite`. The scheduler uses a per-model queue, bounded concurrency, a default ten requests/minute safety target (configurable only up to twelve), cancellation, `Retry-After`/backoff handling, and finite retries. Successful items are persisted even if a later batch item fails or quota pauses generation. Local daily counts are explicitly approximate and never treated as Google quota authority.

The verifier receives only the completed question, immutable mapping context, points, structured proposed answer, and teacher-authorized context. Learner data is excluded. A failed repair never changes item number, competency, cognitive category, type, points, or source TOS mapping.

### Final review and exports

`src/lib/assessmentFinalReview.ts` separates blocking hard errors from teacher-overridable quality warnings. It checks slot coverage, duplicate numbers, immutable mapping, type payloads, points/component totals, answer-recheck states, matching integrity, exact/near duplicates, duplicate choices, suspicious answer patterns, notation/language warnings, and item/point distributions across types, competencies, and cognitive categories.

Student Copy, Teacher Copy, and Answer Key/Scoring Guide are produced from stored structured data. Student output omits answers, mappings, competency/cognitive metadata, AI/QA state, internal IDs, and technical provenance. Teacher/key output includes type-aware answers, points, solution guidance, per-match/per-blank detail, subparts, key points, and rubric criteria where applicable. Built-in Print, PDF, and DOCX paths are retained.

## Phase 5.4 results compatibility

Results now store and validate `earnedPoints` against the item's snapshotted `possiblePoints`. Main learner scores are derived as total earned points over total possible points; fully-correct item count is a separate statistic. Deterministically auto-scorable types use the saved structured answers. Problem Solving, Constructed Response, and Essay remain teacher-scored, with partial credit supported. Fill and Matching can earn component partial credit; Multiple Select follows its saved all-or-nothing policy.

`src/lib/itemAnalysis.ts` retains binary correctness facility for genuinely binary items and labels it separately. Multi-point/component or observed partial-credit work uses mean points and normalized point achievement; it is not misrepresented as binary facility. Competency and cognitive summaries expose item counts while using point-earned/point-possible denominators for score-based achievement, so a one-point item is not weighted like a ten-point essay.

Remediation defaults to point-weighted evidence for new plans and preserves the saved basis for legacy plans. Threshold denominators use valid possible points. Optional Gemini remediation remains aggregate-only: verified competency, cognitive categories, counts, and aggregate score distributions are allowed; learner names, IDs, local references, raw answers, per-learner scores, and histories are not sent.

Draft result entry remains local/debounced and batch-persisted rather than saving every keystroke or issuing one network request per cell. Existing one-point assessments, result sessions, item analysis, remediation plans, reports, demo records, and snapshots remain compatible.

## Database changes and security review

Apply all migrations in filename order. New additive/corrective migrations are:

17. `supabase/migrations/202608090017_phase44_question_type_enum.sql`
18. `supabase/migrations/202608090018_phase44_assessment_scoring_qa.sql`
19. `supabase/migrations/202608090019_phase54_results_compatibility.sql`

Migration 017 extends the database question-type enum. Migration 018 adds assessment settings, target points, points, QA/lifecycle metadata, bounded per-item history, strict typed payload validation, and owner-authoritative save/finalize rules. Migration 019 hardens multi-point result snapshots/outcomes, answer shapes, score bounds, batch save relationships, and compatibility defaults.

The static adversarial review covered migrations 013–019, foreign-key ownership paths, grants, owner-only RLS, immutable finalized records, service-role-only AI audit inserts, private template Storage paths, and `SECURITY DEFINER` functions with explicit safe `search_path` and `auth.uid()` ownership derivation. Browser configuration contains only publishable Supabase values. A repository scan found no committed Gemini key, service-role key, database URL/password, access token, JWT, encryption secret, or private key value.

Live two-teacher RLS and migration execution remain staging acceptance requirements because this environment did not provide a PostgreSQL/Supabase migration runner.

## Production deployment

The Vite frontend remains a Render Static Site; Supabase remains the backend. `render.yaml` uses `npm ci && npm run build`, publishes `dist`, and rewrites `/*` to `/index.html`. `public/_redirects` supplies the same SPA fallback for direct refreshes under lessons, TOS, assessments, results, analysis, and remediation routes.

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in Render browser variables. Supabase service-role material, database credentials, Gemini keys, credential-encryption keys, and privileged tokens must never be exposed through `VITE_*`.

Phone-friendly deployment and acceptance instructions are in:

- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/PRODUCTION_SMOKE_TEST.md`
- `docs/PHASE_5_4_SECURITY_REVIEW.md`
- `docs/PHASE_5_4_PRODUCTION_ACCEPTANCE.md`

## Validation result

On 2026-08-09, one complete retained run passed:

- all 23 project validators: curriculum, Phase 2, Phase 3/BYOK/3.5–3.7, Phase 4/4.1–4.4, and Phase 5.0–5.4;
- all eleven valid typed question fixtures plus invalid-answer/component cases;
- 32-item/60-point, target-point, partial-credit, legacy one-point, adaptive-QA, scheduler, structured-export, normalized-analysis, remediation-denominator, and production-contract checks;
- `npm run typecheck`; and
- `npm run build` with 2,027 modules transformed successfully.

The only build diagnostic was Vite's non-fatal existing large-chunk advisory. No validator was removed or weakened.

## Known limitations

- Live Supabase migration application, cross-teacher RLS probes, deployed Auth redirects, Storage isolation, and real Edge Function/BYOK calls require the staging/production projects.
- Android route-refresh, slow-network/reconnect, real provider 429/quota behavior, and physical PDF/DOCX/print inspection for every new question type require the production smoke test.
- The local Gemini request estimate counts GuroDesk-observed requests and cannot know provider-wide usage; an Edge Function's internal Lite fallback can add provider usage not visible as a separate browser invocation. Provider responses remain authoritative.
- Subjective responses are not automatically graded by AI. Teachers award final partial credit.
- Arbitrary repeating-question blocks in uploaded custom assessment DOCX masters and full custom result-analysis XLSX filling remain explicit future extension points, not claimed features.
- The production JavaScript bundle still triggers Vite's large-chunk advisory. It is safe to deploy but route-level code splitting is a later performance improvement.

## Exact recommended next phase

Request explicit approval for **Phase 5.5 — Controlled Production Rollout and Live Acceptance**. That phase should add no major product domain: apply migrations 017–019 in staging, deploy Edge Functions, run two-teacher adversarial RLS/Storage tests, exercise real teacher BYOK and provider failures, validate Supabase Auth redirects and Render nested-route reloads, inspect every export on Android, then promote the same reviewed commit to production.

Do not begin class records, grading sheets, report cards, attendance, a student portal, new curriculum subjects, or another document domain as part of that acceptance phase.
