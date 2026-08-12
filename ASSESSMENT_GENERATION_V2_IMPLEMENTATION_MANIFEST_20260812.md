# GuroDesk Assessment Generation V2 — Implementation Manifest

Date: 2026-08-12

## Release scope

This checkpoint implements the requested assessment-generation overhaul without beginning another unrelated GuroDesk product phase. Existing legacy, finalized, and archived assessments remain on the original item-numbering contract; new V2 assessments use point-range numbering and a frozen master assessment plan.

## New teacher flow

The new `Create Assessment` route is configuration-first. Before any question is generated, the teacher chooses:

- finalized source TOS;
- total assessment points;
- allowed question types from the existing eleven types;
- visual policy (`Off`, `Balanced`, `More visuals`);
- title and learner directions;
- optional planning guidance.

The page shows live Cognitive Process Dimension (CPD) suitability for each selected question type and blocks generation when the chosen formats cannot cover or compose the required CPD/TOS point buckets.

After **Generate assessment**:

1. GuroDesk deterministically allocates the requested total points across the immutable finalized TOS competency/CPD structure.
2. One successful master-planning response is accepted from the strongest available configured Flash model.
3. The returned plan is validated locally and frozen.
4. A V2 draft is created with every logical question already bound to its immutable competency, CPD, question type, points, learner-facing point range, and visual requirement.
5. Questions are generated sequentially from the frozen plan and checkpointed after each completed question.
6. Required visuals are generated/checkpointed after question generation.
7. During generation, the UI is a dedicated full-screen progress experience; question previews/editors are hidden.
8. The complete paper is shown only after generation reaches review state. Interrupted V2 drafts reopen to a focused **Resume generation** view until planned content is complete.

## Point-first assessment model

V2 makes total points the teacher-facing assessment-size input. Logical question count is derived by the master planner and is not a required setup field.

A multi-point question remains one logical assessment item and one scoring/result object. Its learner-facing number represents the points it occupies. Example:

- a one-point question may display `15`;
- a five-point essay immediately after it may display `16–20`;
- internally, the essay remains one logical question with `pointsPossible = 5`, `pointStart = 16`, and `pointEnd = 20`.

The V2 validator requires point ranges to be positive, whole-number, contiguous, non-overlapping, and to cover exactly `1…totalPoints`.

Legacy assessments continue using the existing `legacy_items` numbering behavior and are not migrated or renumbered.

## CPD-driven question-type selection

`src/lib/assessmentGenerationV2.ts` defines a suitability model across:

- Remembering
- Understanding
- Applying
- Analyzing
- Evaluating
- Creating

Question types are classified as strong, allowed, or unsupported per CPD, with learning-area adjustments. Multiple Choice remains flexible across lower/middle cognitive work. Evaluating and Creating cannot be satisfied only by weak/objective formats; they require at least one genuinely strong higher-order format. Mathematics can strongly prefer Problem Solving for Creating, while language areas can strongly prefer Essay for higher-order writing tasks.

Each question type also has a bounded point range. Setup validation verifies not only CPD coverage but exact integer point composability for every deterministic competency/CPD bucket before any provider request is spent.

`minimumAssessmentV2Points()` computes the smallest feasible point total for the selected formats/TOS. The setup page defaults to at least that minimum rather than presenting an immediately impossible assessment configuration.

## Deterministic point blueprint

The finalized TOS remains authoritative. GuroDesk—not Gemini—allocates points across the existing verified competency and cognitive mappings using deterministic weighted allocation with minimum feasible higher-order reservations.

The AI is not allowed to:

- change competency or CPD allocations;
- choose curriculum mappings;
- move points between TOS buckets;
- change total points;
- create overlapping/gapped learner numbering.

The Edge master planner independently reloads the finalized TOS and recomputes the authoritative buckets before calling Gemini. A modified client cannot silently alter the point blueprint.

## One master assessment plan

New Edge Function: `supabase/functions/assessment-master-planner/index.ts`.

Accepted model order:

1. `gemini-3.6-flash`
2. `gemini-3.5-flash`
3. `gemini-3.5-flash-lite`
4. `gemini-3.1-flash-lite`

The planner uses high thinking. Fallback occurs only for bounded provider/model availability, quota/rate-limit, timeout, and transient server conditions. Authentication/schema/programming errors stop rather than silently consuming more model calls.

Only one successful master-plan response is accepted. Once it passes deterministic validation, the plan is immutable for the generation run.

The provider proposes question chunks within locked buckets: question type, point count, task intent, and visual intent/requirement. GuroDesk reconstructs logical order and learner-facing ranges locally.

## Frozen-plan generation contract

`assessment-question-generator` now detects V2 documents and validates each provider request against the frozen master-plan entry before calling Gemini. For V2, the following cannot drift during question generation:

- plan entry ID;
- logical order;
- `pointStart` / `pointEnd`;
- `pointsPossible`;
- question type;
- verified competency;
- cognitive category;
- TOS source row/allocation mapping;
- visual requirement.

Legacy type-balancing and heuristic visual re-planning are bypassed for V2, preventing old editor logic from mutating the frozen master plan.

## Visual-policy compatibility

Assessment Generation V2 carries forward the visual-reliability rules from the previous checkpoint:

- automatic required visuals remain Mathematics-gated;
- `Off` disallows generated required visuals;
- `Balanced` cannot require a visual for papers under four logical questions and is capped at roughly one required visual per four logical questions;
- `More visuals` still requires genuine diagram dependence and does not authorize decorative visuals;
- the planner cannot put `visualIntent` on a text-only plan entry.

The later visual-generation/verification pipeline remains the existing direct-TikZ path.

## Persistence and database protections

Migration: `supabase/migrations/202608120028_assessment_generation_v2.sql`.

Migration count becomes **28**.

It adds V2 point-range/plan linkage fields to `assessment_items`:

- `point_start`
- `point_end`
- `plan_entry_id`

It also provides V2-only persistence functions:

- `save_assessment_document_v2(...)`
- `duplicate_assessment_document_v2(...)`

The V2 save path verifies the frozen master plan, exact logical-question order, exact point coverage, immutable TOS mappings, stable item identities, allowed types, finalization constraints, and lock protections. The master plan cannot be rewritten alongside item changes to make a tampered question appear valid.

Legacy save/duplicate behavior is retained rather than weakened to accommodate V2.

## Results and analysis compatibility

V2 continues to score one logical question as one result object, even when its learner-facing range spans multiple points.

Point-range labels are propagated through:

- result entry/navigation;
- result snapshots;
- item analysis;
- option analysis;
- competency analysis;
- cognitive/CPD analysis;
- curriculum-period summaries;
- remediation evidence;
- printable report views;
- PDF/DOCX text report data;
- XLSX result workbook rows.

A logical five-point question numbered `16–20` therefore remains `16–20` in later analysis instead of reverting to its internal logical item number.

## Assessment export compatibility

The canonical assessment presentation/export model uses the learner-facing point range for V2. Point-range papers avoid a redundant per-question `(5 points)` label where the range already communicates the value. V2 paper metadata is point-first and does not present the legacy item total as the teacher’s primary assessment size.

Legacy export presentation remains unchanged.

## Main implementation files

Core/new:

- `src/lib/assessmentGenerationV2.ts`
- `src/lib/assessmentMasterPlanner.ts`
- `src/pages/AssessmentNewPage.tsx`
- `supabase/functions/assessment-master-planner/index.ts`
- `supabase/migrations/202608120028_assessment_generation_v2.sql`
- `scripts/check-assessment-generation-v2.mjs`
- `tests/unit/assessment-generation-v2.test.ts`

Major compatibility surfaces updated:

- `src/types/assessment.ts`
- `src/lib/assessmentBlueprint.ts`
- `src/lib/assessmentRepository.ts`
- `src/lib/assessmentValidation.ts`
- `src/lib/assessmentFinalReview.ts`
- `src/pages/AssessmentEditorPage.tsx`
- `supabase/functions/assessment-question-generator/index.ts`
- `src/lib/assessmentExportModel.ts`
- `src/lib/assessmentExportPresentation.ts`
- results/scoring/analysis/report/workbook modules and views.

## Deployment order

1. Preserve/deploy all previous migrations through `027`.
2. Apply migration `202608120028_assessment_generation_v2.sql`.
3. Deploy the new `assessment-master-planner` Edge Function.
4. Deploy the changed `assessment-question-generator` and any changed shared Edge modules from the same source tree.
5. Deploy the frontend.
6. Before production promotion, run the full clean install/type/unit/build, fresh+upgrade migration, two-teacher RLS/integration, Chromium/phone E2E, and assessment/results export inspection matrix.

## Inherited limitation

The previous visual-reliability checkpoint could not vendor the licensed/version-pinned TikZJax runtime binaries/fonts in this sandbox. The renderer still depends on the existing runtime CDN path. Assessment Generation V2 does not pretend that inherited offline-rendering P0 is complete.
