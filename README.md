# GuroDesk — Phase 6 National Curriculum Catalog and Release-Quality Assessment Platform

GuroDesk is a mobile-first workspace for DepEd teachers. Its operating rule is: **verified curriculum and policy data first, teacher judgment first, and AI only inside an explicit teacher-review workflow.**

## Current implementation

Phases 1–5.5 and the assessment generation/visual reliability work are preserved. Phase 6 adds a source-grounded national curriculum catalog, grade-aware teacher setup, rollout-aware curriculum resolution, and a scalable verified-pack import pipeline while retaining the existing release harness:

- batched, verified TOS curriculum resolution without per-competency Supabase lookups;
- lossless, height-aware pagination for long TOS competency text and notes;
- assessment creation only from a finalized, teacher-owned TOS;
- one deterministic assessment slot for every TOS item number `1..N`;
- immutable competency and cognitive-category mappings with one canonical source snapshot;
- one shared typed item architecture for Multiple Choice, True/False, Short Answer, Constructed Response, Identification, Fill in the Blank, Numerical Answer, Problem Solving, Matching, Multiple Select, and Essay;
- independently configurable question type, cognitive category, and positive `pointsPossible`, with item count kept separate from the deterministically derived point total;
- deterministic fixed-count/percentage/auto-balanced type allocation, manual per-item control, editable defaults, optional target points, and clear item/point coverage summaries;
- mobile item navigator, Previous/Next controls, direct number navigation, mapping badges, and completion state;
- draft, reopen, edit, duplicate, finalize, archive, and local demo persistence;
- authenticated Gemini BYOK question suggestions on top of immutable slots;
- teacher-controlled Generate, Alternative, Regenerate, Accept, and manual-edit flows;
- bounded, cancellable Generate Missing Items with finite retry/backoff, persistent partial success, locked-item protection, and approximate local usage awareness;
- deterministic validation before AI, transparent risk routing, opposite-Lite independent verification when warranted, targeted single-item repair only after failure, and a conservative retry ceiling;
- bounded per-item history, restore/lock/unlock, material-edit answer recheck, and final hard-error versus teacher-overridable warning review;
- type-aware Student Copy, Teacher Copy, and deterministic Answer Key/Scoring Guide through browser Print, PDF, and editable Word `.docx`;
- privacy-minimized teacher-owned class learners attached to an assignment/section, with inactive/archive behavior for historical records;
- finalized assessment result sessions with immutable assessment/item/mapping snapshots and structured learner outcomes;
- fast answer-sheet, item, and score-only encoding modes with draft-safe local state and batched persistence/import architecture;
- deterministic objective scoring plus bounded teacher-awarded partial credit, point-derived learner totals, separate fully-correct item counts, and legacy one-point compatibility;
- clearly labelled binary facility versus normalized multi-point achievement, with item-count and point-based competency/cognitive views;
- configurable, neutral remediation signals and editable plans, with optional aggregate-only Gemini activity suggestions that never receive learner identity or raw answers; and
- Assessment Results Summary, Item Analysis, Competency Performance, and Remediation Plan reports with Print, PDF, DOCX, and combined seven-sheet XLSX output; and
- Render static-site SPA rewrites, browser-safe environment guidance, additive migrations through `022`, production security notes, and a phone-first smoke-test checklist;
- Vitest unit regressions for scoring, locks, error handling, AI orchestration, retry/429 behavior, and Gemini boundaries;
- real fresh and data-bearing upgrade migration paths through migration 022;
- local Supabase Auth/JWT, RLS, RPC, PostgREST relationship, repository round-trip, partial-credit, analysis, and remediation integration tests;
- a focused Playwright suite for login, TOS-to-assessment creation, save/reload/list behavior, and deep routes; and
- GitHub Actions plus a single local-only `npm run test:release` quality gate.

This release **stops after the Phase 6 curriculum coverage foundation**. It does not fabricate unverified curriculum competencies, and it does not implement class records, grading sheets, report cards, attendance, awards/ranking, student/parent portals, or automated subjective grading by AI.

## Phase 6 curriculum coverage

GuroDesk now carries a national, school-year-aware curriculum catalog across Kindergarten through Grade 12. Current Revised K to 10 rollout families and Strengthened Senior High School core/elective offerings are visible in Curriculum Navigator and drive grade-aware learning-area choices in onboarding and My Classes. Transitional records keep historical/legacy selections distinguishable rather than silently remapping them.

Catalog breadth is intentionally separate from executable competency coverage. Only exact source-reviewed manifests may drive lesson plans, TOS, assessment mapping, and downstream analytics. Grade 7 Mathematics remains the currently bundled fully verified competency pack; every other catalog entry clearly reports its coverage state and official DepEd provenance instead of inventing competencies.

The repository curriculum resolver now considers multiple applicable versions for a grade/school year and prefers the catalog-matching version that actually contains the selected subject. This supports phased/pilot/legacy coexistence such as Grade 12 without assuming that the first applicability row is always correct.

Future verified packs are additive: place reviewed manifests in `data/curriculum/`, run `npm run curriculum:validate`, and generate all verified SQL seeds with `npm run curriculum:generate:all`. See `docs/PHASE_6_CURRICULUM_COVERAGE.md`.

See:

- `docs/PHASE_4_TOS_BUILDER.md`
- `docs/PHASE_4_1_ASSESSMENT_ENGINE.md`
- `docs/PHASE_4_2_AI_QUESTION_GENERATION.md`
- `docs/PHASE_4_3_ASSESSMENT_EXPORTS.md`
- `docs/PHASE_4_4_ASSESSMENT_SCORING_QA.md`
- `docs/PHASE_5_ARCHITECTURE.md`
- `docs/PHASE_6_CURRICULUM_COVERAGE.md`
- `docs/PHASE_5_4_PRODUCTION_ACCEPTANCE.md`
- `docs/PHASE_5_RELEASE_CHECKLIST.md`
- `docs/PHASE5_POLICY_PRIVACY_AND_ANALYTICS_BOUNDARIES.md`
- `docs/PHASE5_RESULT_TEMPLATE_ARCHITECTURE.md`
- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/PRODUCTION_SMOKE_TEST.md`
- `docs/TESTING.md`
- `PHASE55_TESTING_MANIFEST.md`
- `CODEX_HANDOVER.md`

## Assessment architecture

The finalized TOS—not Gemini—is the allocation authority. Application and database validation preserve item number, verified competency, cognitive category, allocation range, curriculum identity, source TOS ID, and source version. AI receives one already-mapped slot and may return only a structured candidate question. A candidate remains separate until the teacher accepts or manually edits it.

Correct answers, accepted answers, blank mappings, numerical tolerances, matching mappings, expected solutions, and rubrics are stored as type-specific structured data. Student output is built from an answer-free export model; teacher and answer-key output use the saved structured answer and never ask AI to reconstruct or solve the finished test.

Every TOS slot remains one item even when it carries multiple points or structured subparts. `totalItems` is the immutable TOS slot count; total possible points is always derived from the item point sum. Rubric, subpart, blank, and matching component totals must reconcile before finalization.

Phase 3.7 custom lesson DOCX templates and Phase 4 custom TOS XLSX templates remain intact. Built-in assessment and results exports are complete. Exact repeating-block support for arbitrary custom assessment DOCX masters remains deferred. Custom result/item-analysis XLSX template filling is architecture-only in this release; the shared result export model and explicit worksheet inspector are the safe extension points.

## Policy boundary

Assessment and results decisions were reviewed against the current official DepEd Order No. 015, s. 2026 and official privacy guidance. GuroDesk distinguishes mandatory policy, mathematical/statistical definitions, product defaults, and school/division conventions in `docs/DEPED_SOURCE_REGISTER.md` and `docs/PHASE5_POLICY_PRIVACY_AND_ANALYTICS_BOUNDARIES.md`. Facility, item-rest correlation, and descriptive summaries are deterministic analytical measures—not DepEd grading mandates. AI supports teacher-reviewed drafting only; it does not alter curriculum allocation, assign constructed-response points, determine grades, replace professional judgment, or receive learner personally identifying information.

## Run locally / AI Studio

```bash
npm install
npm run dev
```

Without Supabase browser variables, choose **Open sample teacher workspace**. Demo records are stored in localStorage and use a clearly labelled non-Gemini sample generator.

## Supabase migration order

Apply in order:

1. `202608080001_phase1_foundation.sql`
2. `202608080002_phase2_curriculum_engine.sql`
3. `202608080003_seed_g7_mathematics.sql`
4. `202608080004_phase2_pacing_foundation.sql`
5. `202608080005_phase3_lesson_planning.sql`
6. `202608080006_seed_lesson_planning_policy_metadata.sql`
7. `202608080007_phase3_byok_ai.sql`
8. `202608080008_phase35_lesson_suggestions.sql`
9. `202608080009_phase36_export_preferences.sql`
10. `202608080010_phase363_multilingual_lesson_support.sql`
11. `202608080011_phase37_custom_document_templates.sql`
12. `202608080012_phase4_tos_builder.sql`
13. `202608080013_phase41_assessment_engine.sql`
14. `202608080014_phase42_assessment_ai_audit.sql`
15. `202608080015_phase50_results_foundation.sql`
16. `202608080016_phase53_remediation.sql`
17. `202608090017_phase44_question_type_enum.sql`
18. `202608090018_phase44_assessment_scoring_qa.sql`
19. `202608090019_phase54_results_compatibility.sql`
20. `202608090020_fix_assessment_save_alias_ambiguity.sql`
21. `202608090021_phase55_explicit_data_api_grants.sql`
22. `202608090022_phase55_integration_guard_fixes.sql`

Deploy all functions listed in `supabase/config.toml`, including `assessment-question-generator` and the aggregate-only `remediation-suggester`.

Set browser-safe variables only:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never expose a service-role key, credential-encryption material, or Gemini API key in browser variables.

## Gemini BYOK

Each signed-in teacher connects a personal key through **Settings → AI Assistant**. The encrypted credential is decrypted only inside authenticated Edge Functions and never returned to the browser.

- Primary: `gemini-3.5-flash-lite`, high thinking
- Automatic fallback: `gemini-3.1-flash-lite`, high thinking
- Automatic fallback remains Lite-only
- Flash models remain manual selections and are not automatically consumed
- Provider quota guidance is descriptive, never a hard-coded guarantee

No `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` is required.

## Learner-data and analysis boundary

The initial learner record is deliberately limited to an internal UUID, owning teacher, assignment/section, display name, optional teacher-local reference, and active state. GuroDesk does not require LRN, birth date, address, contact, guardian, health, disability, socioeconomic, or password data. Learner and result rows are owner-scoped by authenticated teacher and historical participants are snapshotted so later roster or assessment edits cannot silently rewrite finalized results.

Objective answers are compared to the saved structured answer key without AI. Problem Solving, Constructed Response, Essay, and manually scored Short Answer points remain teacher-entered. Scores use `sum(pointsEarned) / sum(pointsPossible)`; a fully-correct item count is reported separately. Score-only sessions explicitly return no item analysis. Binary facility remains `correct / attempted` where meaningful; multi-point work is additionally reported as normalized point achievement and is not claimed to be psychometrically identical. Item-rest correlation uses binary or clearly labelled normalized item points, with an explicit insufficient-data result when `n < 10` or either variance is zero. Remediation defaults to point-weighted evidence for new plans while preserving saved legacy correctness-based plans.

## Validation

```bash
npm test
npm run test:ci
npm run test:db:fresh
npm run test:db:upgrade
npm run test:integration
npm run test:e2e
npm run test:release
```

`npm run test:ci` includes `npm run validate:all`, which executes every retained Phase 1–5.4 validator. `npm run test:release` starts only an isolated local Supabase stack and refuses the production project reference or any non-local target. See `docs/TESTING.md` for prerequisites, fixtures, CI behavior, and the distinction between implemented and actually executed gates.
