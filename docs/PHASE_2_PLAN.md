# Phase 2 status — Curriculum Engine

## Completed

- verified-source curriculum manifest format
- curriculum manifest validation tooling
- deterministic SQL generator
- version/grade/school-year applicability model
- separate school grading calendar model
- Budget of Work / instructional-pacing schema kept separate from both curriculum quarters and grading terms
- subject-scoped curriculum periods
- source provenance in UI
- real Curriculum Navigator
- Grade 7 Mathematics full verified competency dataset
- Supabase seed migration
- demo-mode curriculum data sourced from the same manifest
- phone-responsive Curriculum Navigator

## Coverage still to add

The engine is ready for additional reviewed manifests. Recommended expansion order before/alongside Phase 3:

1. other Grade 7 learning areas
2. Grade 4 and Grade 1 Phase 1 learning areas
3. grades introduced in later Revised K to 10 rollout phases
4. current Strengthened SHS subjects and transitional Grade 12 handling
5. historical/legacy curricula only where teachers genuinely need past-school-year documents

Do not delay Phase 3 until every curriculum is imported; the engine can expand incrementally while the lesson-planning workflow is built against verified records.
