# GuroDesk handover for Codex / next coding session

## Product objective

GuroDesk is a DepEd-teacher web workspace. The product should know the applicable curriculum and policy by school year and teaching assignment, then reduce repetitive lesson planning, TOS/test creation, assessment reporting, and paperwork.

Core rule: **structured, versioned DepEd knowledge first; AI generation second**.

The user works from a phone and prefers the workflow:

```text
ChatGPT/Codex edits full project
→ return complete ZIP
→ user uploads ZIP to AI Studio Build
→ user tests
→ AI Studio pushes to GitHub
```

Avoid requiring the user to manually merge many code snippets.

---

## Current state — Phase 2 complete

### Phase 1 retained

- Vite + React + TypeScript
- responsive phone/desktop UI
- Supabase auth mode when browser-safe env vars exist
- local/demo mode when Supabase is not configured
- onboarding, profile, teaching assignments, dashboard, class management
- RLS for teacher-owned data
- document/version foundation
- server-only Gemini secret architecture (`gemini-health` scaffold)

### Phase 2 implemented

- real Curriculum Navigator
- teaching-assignment selector
- school-year + grade + learning-area curriculum resolution
- `curriculum_applicability` for phased/transitional curriculum rollouts
- curriculum periods scoped by subject
- Phase 1 academic-period uniqueness bug corrected so different subjects may each have `Quarter 1`
- database trigger prevents an academic period from referencing a subject from a different curriculum version
- separate `school_year_calendars` / `grading_periods`
- SY 2026-2027 three-term grading metadata foundation
- separate `instructional_pacing_plans` / `instructional_pacing_entries` for verified Three-Term Budget of Work / pacing data
- database trigger prevents pacing entries from crossing subjects or school-year calendars
- official source/provenance display
- source-page display per competency
- competency search and domain grouping
- selectable competency state ready for Phase 3 handoff
- source-grounded performance-standard context
- canonical JSON curriculum-manifest format
- manifest validator
- deterministic manifest → Supabase SQL generator
- Phase 2 integrity checker
- first complete verified curriculum dataset: Grade 7 Mathematics, 52 competencies, Quarter 1-4, source pages 30-33
- demo mode reads the same verified manifest used to generate production seed data

---

## Critical 2026 architecture correction

Do **not** collapse these concepts:

1. **Curriculum-guide sequence** — e.g. Quarter 1, Quarter 2, Quarter 3, Quarter 4 in a published curriculum guide.
2. **Instructional pacing / Budget of Work** — maps competencies into the current school year's instructional sequence.
3. **School grading/reporting calendar** — SY 2026-2027 uses three terms.

DepEd's current implementation expects a Three-Term Budget of Work for lesson planning. Therefore **Quarter 1 must never be assumed to equal Term 1**.

Phase 3 lesson generation should use, in priority order:

```text
verified selected competency
+ verified applicable pacing/BoW entry when available
+ active grading-term context
+ applicable lesson-planning policy
```

If a verified BoW mapping is not loaded, the app should clearly say so and allow a teacher to select context without presenting an inferred quarter→term mapping as official.

---

## Verified curriculum data currently loaded

Canonical manifest:

`data/curriculum/matatag-grade7-mathematics.json`

Source:

- Department of Education
- MATATAG Curriculum: Mathematics Grades 1, 4 and 7
- official DepEd curriculum landing page and PDF recorded in source register/manifest
- Grade 7 records are from guide pages 30-33

Coverage:

- Grade 7 Mathematics
- 4 curriculum-guide quarters
- 3 domains
- 4 performance-standard records
- 52 verified competency records
- no competency code is invented where source does not provide one

Other demo assignments intentionally show **verified curriculum not loaded yet** rather than fake content.

---

## Curriculum import workflow

Do not hand-edit generated seed SQL.

1. create/review `data/curriculum/<manifest>.json`
2. mark it verified only after source review
3. run:

```bash
npm run curriculum:validate
```

4. generate SQL:

```bash
node scripts/generate-curriculum-sql.mjs <manifest.json> <output.sql>
```

5. keep any migration copy synchronized with generated seed
6. run:

```bash
npm run validate:phase2
```

The generator refuses a manifest that is not marked verified.

---

## Supabase migration order

Apply in this exact order on a fresh project:

1. `supabase/migrations/202608080001_phase1_foundation.sql`
2. `supabase/migrations/202608080002_phase2_curriculum_engine.sql`
3. `supabase/migrations/202608080003_seed_g7_mathematics.sql`
4. `supabase/migrations/202608080004_phase2_pacing_foundation.sql`

`202608080003...` is a generated seed migration derived from the reviewed manifest.

---

## Architecture constraints — do not undo

1. Do not hard-code official curriculum competencies in React components.
2. Do not use Gemini's memory as the curriculum database.
3. Do not put `GEMINI_API_KEY` in `VITE_*` variables.
4. Do not put a Supabase service-role key in browser code.
5. Keep demo mode working without secrets.
6. Keep teacher-owned data protected by RLS.
7. Official knowledge is read-only to ordinary authenticated users.
8. Only verified competencies should become teacher-visible.
9. Do not invent official competency codes.
10. Keep curriculum-guide periods separate from school grading terms.
11. Keep instructional pacing/BoW separate from both of those.
12. Do not seed guessed term boundary dates or guessed quarter→term competency mappings.
13. Preserve official source URL/page provenance.
14. GuroDesk is independent; do not use DepEd seal/logo or imply official endorsement.

---

## Files to understand first

- `src/pages/CurriculumPage.tsx` — real Curriculum Navigator + selected competency state
- `src/lib/repository.ts` — demo/Supabase persistence and curriculum resolution
- `src/data/demoCurriculum.ts` — adapter from canonical verified manifest to UI bundle
- `src/types/curriculum.ts` — curriculum/calendar view models
- `data/curriculum/matatag-grade7-mathematics.json` — canonical first dataset
- `scripts/validate-curriculum.mjs` — import integrity validation
- `scripts/generate-curriculum-sql.mjs` — deterministic SQL generation
- `scripts/check-phase2.mjs` — architecture/security/seed-sync assertions
- `supabase/migrations/202608080002_phase2_curriculum_engine.sql`
- `supabase/migrations/202608080004_phase2_pacing_foundation.sql`
- `docs/DEPED_SOURCE_REGISTER.md`
- `docs/PHASE_2_CURRICULUM_ENGINE.md`

---

## Phase 3 target — Lesson Planning Engine

### Research/policy first

Before enabling generation, review **DO 016, s. 2026 — Guidelines on Lesson Planning and Learning Design** and transform only verified policy requirements into structured application rules.

Do not simply recreate an old DLL/DLP template from memory.

### Recommended implementation order

1. Add structured lesson-plan schema/types and database tables.
2. Add lesson creation route/page.
3. Start lesson from a **selected verified competency** in Curriculum Navigator.
4. Resolve current school-year term and verified BoW/pacing entry when available.
5. Add Supabase Edge Function for Gemini generation.
6. Make Gemini return strict structured JSON, not formatted final documents.
7. Validate competency ID/source, required lesson sections, and grounding before save.
8. Add editable section-based lesson UI.
9. Add section-level AI actions: improve activity, simplify, differentiate, formative assessment, remediation, enrichment, localize examples.
10. Add save/version/duplicate support.
11. Keep exports for a later phase unless a minimal print view is needed.

### Proposed lesson generation input

```json
{
  "teacherContext": {},
  "schoolYear": "2026-2027",
  "gradingPeriod": {},
  "curriculumVersion": {},
  "subject": {},
  "competency": {},
  "pacingEntry": {},
  "lessonPlanningPolicy": {},
  "teacherOptions": {}
}
```

Every official object should carry IDs/source metadata. Gemini output should not be allowed to replace the official competency text/code.

### Proposed output shape

Use a schema such as:

```json
{
  "title": "",
  "durationMinutes": 60,
  "objectives": [],
  "content": {},
  "resources": [],
  "learningSequence": [],
  "formativeAssessment": [],
  "differentiation": [],
  "remediation": [],
  "enrichment": [],
  "reflection": {}
}
```

The exact section model must be reconciled against DO 016, s. 2026 before implementation.

---

## Curriculum expansion can continue in parallel

Do not block Phase 3 until every grade/subject is loaded. Add verified manifests incrementally.

Recommended order:

1. remaining Grade 7 MATATAG/Revised K to 10 learning areas
2. Grade 4 and Grade 1 Phase 1 learning areas
3. later rollout grades
4. Strengthened SHS Grade 11
5. Grade 12 transitional/pilot handling

SHS may need assignment-level context for pilot/non-pilot or program variant. Do not force that into the K-10 resolver without modeling the distinction explicitly.

---

## Validation already run in this packaging environment

Passed:

- curriculum manifest validator
- 52-competency count and source-page checks
- deterministic seed generation
- seed/migration synchronization
- Phase 2 architecture checker
- relative import resolution
- TypeScript/TSX syntax transpilation across non-declaration source files
- browser secret scan

Environment limitation:

- the sandbox's internal npm registry returns 404 for `@supabase/supabase-js`
- an explicit public-npm install attempt timed out
- therefore a true `npm install && npm run build` cannot be completed here

Do not remove Supabase to make this sandbox green. AI Studio / a normal npm environment should run the actual dependency install and Vite build. If AI Studio reports a real compiler/build error, patch that specific error without regenerating unrelated architecture.

---

## Phone-first acceptance test in AI Studio

1. upload full Phase 2 ZIP
2. run app in demo mode
3. open sample teacher workspace
4. open Curriculum
5. confirm Grade 7 Mathematics shows 52 competencies
6. switch Quarter 1-4
7. search competency text
8. tap a competency and confirm selection panel updates
9. confirm SY 2026-2027 shows Term 1 · Term 2 · Term 3 as separate grading context
10. switch to Grade 8 Math and confirm no fake curriculum appears
11. test mobile viewport/sidebar
12. then connect/apply Supabase migrations if desired
13. push tested project to GitHub
