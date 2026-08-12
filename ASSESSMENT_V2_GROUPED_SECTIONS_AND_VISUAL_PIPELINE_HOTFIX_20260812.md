# Assessment Generation V2 — grouped paper sections + reliable visual pipeline

Date: 2026-08-12

## Production symptoms

1. A generated Grade 7 Mathematics paper had question types interleaved across the paper. Multiple-choice questions were not a contiguous opening block, so the existing export/paper section renderer could not create normal type sections.
2. Several V2 questions were explicitly diagram-dependent but their AI visuals failed. The saved direct-TikZ visual format had no structured fallback primitives, so a failed generation/TikZJax path produced `Diagram preview unavailable` and made the question unusable.

## Root causes

### Paper ordering

The master-planner prompt explicitly told Gemini to spread competencies/CPDs through the paper rather than group one type first, and `validateAndFinalizeMasterPlan()` preserved the provider order verbatim before assigning learner-facing point ranges.

### Visual reliability

V2 used Gemini-authored raw TikZ as the only visual artifact. The strict TikZ subset and finished-diagram verification were intentionally safe, but when that single artifact failed there was no validated geometry fallback. GuroDesk already had a mature bounded visual primitive model and deterministic TikZ serializer, but new V2 visuals were not using it.

## Fixes

### 1. Conventional contiguous question-type sections

`validateAndFinalizeMasterPlan()` now performs a stable deterministic grouping after every TOS/CPD/point constraint has passed and before point ranges are assigned.

Paper order is:

1. Multiple Choice
2. True / False
3. Identification
4. Fill in the Blank
5. Matching
6. Multiple Select
7. Short Answer
8. Numerical Answer
9. Problem Solving
10. Constructed Response
11. Essay

Entries keep the exact same immutable TOS row, competency, CPD bucket, points, task intent, and visual requirement. Only learner-facing paper order changes.

Example: a provider plan `Essay(4), MC(1), MC(1)` finalizes as `MC 1`, `MC 2`, `Essay 3–6`.

The master-planner prompt now requests the same conventional grouped layout, but the client-side deterministic grouping remains authoritative even if Gemini interleaves the response.

The existing export presentation already creates Part I / Part II / ... section headings when types are contiguous, so no duplicate export grouping system was added.

### 2. V2 structured geometry → deterministic TikZ

For V2 required visuals, the Edge Function now requests a bounded structured geometry object instead of raw TikZ:

Gemini → strict geometry primitives → Edge validation + finished semantic verification → browser deterministic TikZ compiler → sandboxed TikZJax

The structured primitives remain persisted alongside the generated TikZ source. Therefore:

- TikZJax is still the primary high-quality visual path;
- a validated SVG/export fallback remains available immediately;
- a TikZ runtime failure no longer makes the diagram disappear;
- no provider SVG/HTML/JS is accepted;
- no arbitrary formula/code execution is introduced.

Supported primitives include polygons, segments, circles, arcs, angle arcs, labels, equal-side/tick/parallel/perpendicular marks, arrows, Cartesian axes, and sampled Cartesian plots.

The structured provider output gets one bounded structural correction and one bounded finished-diagram semantic correction, matching the existing reliability philosophy.

Legacy direct-TikZ visuals remain supported and keep their previous path.

### 3. Deterministic TikZ safety alignment

GuroDesk's own structured canvas can be up to 1600×1200 and the standard V2 canvas is 600×360. The TikZ safety coordinate bound was still ±100 from the old direct-TikZ-only design, which rejected GuroDesk's own deterministic serializer output. The bounded safety limit is now ±2000 and `x`/`y` TikZ unit options are explicitly allowed. The boundary remains finite and excessive coordinates are still rejected.

## Existing assessment behavior

Already-created V2 assessments keep their frozen master-plan order and point ranges. They are not silently renumbered because that would violate the immutable plan contract.

However, failed visuals on an existing V2 draft can be regenerated after deploying this hotfix. The visual-only operation will use the new structured→TikZ path without replacing the saved question.

New V2 assessments use the grouped type order from creation onward.

## Validation performed

Passed in this environment:

- `node scripts/check-assessment-generation-v2.mjs`
- `node scripts/check-assessment-math-visuals.mjs`
- `node scripts/check-assessment-generation-stability.mjs`
- `bash -n scripts/test-db-migrations.sh`
- parser gate: 214 TS/TSX source/test/Edge files, 0 syntax errors
- isolated strict TypeScript compile for V2 planning + visual/TikZ modules
- direct runtime proof that an interleaved Essay/MC/MC plan finalizes MC/MC/Essay with labels `1`, `2`, `3–6`
- direct runtime proof that a structured marks/angles visual compiles into TikZ, passes `validateAssessmentTikzSource`, and remains a valid visual with both TikZ and primitives

Unit regressions added/updated for grouped type ordering and deterministic primitive-to-TikZ safety.

## Deployment requirements

Deploy frontend/static app changes and redeploy both:

- `assessment-master-planner`
- `assessment-question-generator`

No new database migration is required by this hotfix.
