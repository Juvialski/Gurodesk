# GuroDesk handover — complete through Phase 5.5

## Release boundary

This release preserves Phases 1–5.4 and completes:

1. **Phase 5.5 — Automated Integration, Migration, RLS, and Regression Testing**

**Stop here.** Do not begin class records, grading sheets, report cards, attendance, a student portal, a curriculum expansion, or another major teacher workflow without explicit authorization.

GitHub `Juvialski/Gurodesk` `main` at commit `022afc55dd0f43f964f5d56df5111fe3c1e2da5a` was verified as the implementation source. The attached ZIP was byte-for-byte identical to that checkout. All existing migrations 001–021 and production behavior were preserved.

The first attempted GitHub write for Phase 5.5 returned HTTP 403 (`Resource not accessible by integration`), so no further repository writes were attempted. The root-level Phase 5.5 ZIP is the handoff artifact; importing it onto `main` will trigger the included CI workflow.

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

## Phase 5.5 automated regression harness

Phase 5.5 adds no teacher-facing feature and no database migration. It converts the production regressions from Phases 5.0–5.4 into executable behavior gates:

- Vitest unit regressions cover error extraction, Render SPA fallback, assessment AI risk routing and one-item repair, malformed provider JSON, scheduler pacing/retry ceilings/429 handling, lock and replacement behavior, partial-credit totals, and Gemini Lite fallback boundaries.
- The database harness applies the real migrations 001–022 to a fresh database and separately upgrades a data-bearing schema from migration 014 through 022. It asserts final schema behavior, the migration 018 trigger/backfill, preserved IDs/data/points, migration 020 existing-assessment saves, and finalized-assessment immutability.
- Supabase integration tests use two real local Auth users and teacher JWTs for RLS, new/existing assessment RPC saves, duplicate/archive behavior, 40-item round trips, explicit PostgREST foreign-key relationships, tamper rejection, lock/unlock behavior, the required `1/1 + 3/5 + 8/10 = 12/16` result path, analysis, remediation, and cross-teacher denial across the major Phase 2–5.4 teacher-owned domains.
- Playwright covers authenticated dashboard access, finalized-TOS assessment creation, editor save/reload/list/reopen behavior, and representative deep-route refreshes.
- GitHub Actions runs the static/unit/build gate and a single disposable local Supabase stack for fresh/upgrade migration, integration, and Chromium E2E tests. `npm run test:release` provides the equivalent local release gate.

All networked test entry points reject the production project ref `hmeybakjxtzmiebtxonc` and non-loopback Supabase URLs. Gemini calls are mocked or aborted, so automated tests never consume a teacher key or provider quota. Full commands, fixture boundaries, and failure ownership are documented in `docs/TESTING.md` and `PHASE55_TESTING_MANIFEST.md`.

## Database changes and security review

Apply all migrations in filename order. New additive/corrective migrations are:

17. `supabase/migrations/202608090017_phase44_question_type_enum.sql`
18. `supabase/migrations/202608090018_phase44_assessment_scoring_qa.sql`
19. `supabase/migrations/202608090019_phase54_results_compatibility.sql`
20. `supabase/migrations/202608090020_fix_assessment_save_alias_ambiguity.sql`
21. `supabase/migrations/202608090021_phase55_explicit_data_api_grants.sql`
22. `supabase/migrations/202608090022_phase55_integration_guard_fixes.sql`

Migration 017 extends the database question-type enum. Migration 018 adds assessment settings, target points, points, QA/lifecycle metadata, bounded per-item history, strict typed payload validation, and owner-authoritative save/finalize rules. Migration 019 hardens multi-point result snapshots/outcomes, answer shapes, score bounds, batch save relationships, and compatibility defaults. Migration 020 corrects the existing-assessment save alias ambiguity.

The static adversarial review covered migrations 013–020, foreign-key ownership paths, grants, owner-only RLS, immutable finalized records, service-role-only AI audit inserts, private template Storage paths, and `SECURITY DEFINER` functions with explicit safe `search_path` and `auth.uid()` ownership derivation. Browser configuration contains only publishable Supabase values. A repository scan found no committed Gemini key, service-role key, database URL/password, access token, JWT, encryption secret, or private key value.

The Phase 5.5 local-stack gate now executes the previously manual fresh/upgrade migration and two-teacher RLS acceptance paths without using production credentials.

## Production deployment

The Vite frontend remains a Render Static Site; Supabase remains the backend. `render.yaml` uses `npm ci && npm run build`, publishes `dist`, and rewrites `/*` to `/index.html`. `public/_redirects` supplies the same SPA fallback for direct refreshes under lessons, TOS, assessments, results, analysis, and remediation routes.

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in Render browser variables. Supabase service-role material, database credentials, Gemini keys, credential-encryption keys, and privileged tokens must never be exposed through `VITE_*`.

Phone-friendly deployment and acceptance instructions are in:

- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/PRODUCTION_SMOKE_TEST.md`
- `docs/PHASE_5_4_SECURITY_REVIEW.md`
- `docs/PHASE_5_4_PRODUCTION_ACCEPTANCE.md`
- `docs/TESTING.md`
- `PHASE55_TESTING_MANIFEST.md`

## Validation result

On 2026-08-09, the retained local static gate passed:

- application, test, and E2E TypeScript checks;
- every existing project validator from Phases 1–5.4;
- 17 new Vitest regression tests across five files; and
- the production Vite bundle with 2,027 modules transformed successfully.

The Playwright runner also discovered all eight intended setup/browser tests. This workspace did not provide Docker or `psql`, so database, Supabase integration, and browser execution must run through the included GitHub Actions local-stack job after the ZIP is imported. A skipped live gate cannot report green. The only local build diagnostic was Vite's existing non-fatal large-chunk advisory; no validator was removed or weakened.

## Known limitations

- Deployed Auth redirects, Storage isolation, real Edge Function/BYOK behavior, and the production smoke checklist still require the staging/production projects.
- Android route-refresh, slow-network/reconnect, real provider 429/quota behavior, and physical PDF/DOCX/print inspection for every new question type require the production smoke test.
- The local Gemini request estimate counts GuroDesk-observed requests and cannot know provider-wide usage; an Edge Function's internal Lite fallback can add provider usage not visible as a separate browser invocation. Provider responses remain authoritative.
- Subjective responses are not automatically graded by AI. Teachers award final partial credit.
- Arbitrary repeating-question blocks in uploaded custom assessment DOCX masters and full custom result-analysis XLSX filling remain explicit future extension points, not claimed features.
- The production JavaScript bundle still triggers Vite's large-chunk advisory. It is safe to deploy but route-level code splitting is a later performance improvement.

## Release stop

Phase 6 universal curriculum is the current stopping point. Run the normal release gate and production smoke checks before beginning another document domain or major product phase.


## Phase 6 universal curriculum handover — 2026-08-10

The current source of truth extends the assessment-generation/visual checkpoint and Phase 6 national catalog with teacher-owned custom/hybrid curriculum support. Preserve migrations 025 and 026 and all related files. Migration 026 is a database-only hotfix for the Phase 6 publication RPC; it is not the abandoned Gemini model-discovery experiment.

Key invariants:
- `teacher_assignments.curriculum_source_kind` is `official|custom|hybrid`; custom/hybrid assignments pin `curriculum_version_id`.
- Official curriculum rows are shared/immutable (`owner_user_id is null`, `origin_kind=official`).
- Teacher-owned custom/hybrid versions are published only through `publish_custom_curriculum` after review.
- Raw curriculum uploads live in private `custom-curricula` Storage paths scoped by user/import ID.
- Hybrid bases must be official; inherited competencies retain `base_competency_id` and `provenance_kind=inherited`.
- `guard_assignment_curriculum_competency_link()` runs on both lesson-plan and TOS competency links so downstream documents cannot mix assignment curriculum sources/versions.
- Approved revisions supersede earlier teacher-owned versions; historical pinned documents remain readable.
- Curriculum catalog breadth is not equivalent to verified competency coverage; never synthesize official DepEd competency text from model memory.
- Custom curriculum analysis reuses the existing teacher BYOK model policy unchanged. No new provider model IDs or automatic model-discovery behavior were introduced by Phase 6.

Release gate: migrations 001–026, static/unit/build, fresh/upgrade DB assertions, two-teacher integration/RLS, and Chromium E2E must pass in GitHub Actions. The previously failing assessment-flow E2E was hardened by scoping the `final` status assertion to the TOS card created by that test; GitHub Actions remains the authority for confirming the fix.

25. `supabase/migrations/202608100025_phase6_custom_hybrid_curricula.sql`
26. `supabase/migrations/202608100026_phase6_publish_curriculum_subject_id_hotfix.sql`
