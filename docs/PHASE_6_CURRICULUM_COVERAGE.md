# Phase 6 — National Curriculum Catalog and Verified-Pack Pipeline

## Purpose

Phase 6 separates **national curriculum catalog coverage** from **source-verified competency coverage**.

GuroDesk may know that DepEd officially publishes a curriculum guide or offering without pretending that every competency from that guide has already been transcribed and verified. This distinction protects lesson plans, TOS records, assessments, and remediation from invented curriculum content.

## Coverage states

- `verified_competencies` — an exact, source-reviewed competency manifest is bundled/importable and may drive downstream teacher workflows.
- `official_guide_catalogued` — an official DepEd guide/offering is catalogued, but exact competency transcription is still pending.
- `official_family_catalogued` — an official curriculum family is registered without enough source detail to expose competencies.
- `transitional` — a legacy/pilot transition offering remains relevant for a particular school year or implementation condition.

Only `verified_competencies` is equivalent to an executable curriculum pack.

## Current verified pack

The existing Grade 7 Mathematics MATATAG manifest remains the canonical verified pack. It is not replaced or diluted by Phase 6 catalog records.

## Current national catalog

The catalog now supports grade-aware assignment choices for the current Revised K to 10 / MATATAG rollout and the Strengthened Senior High School program, including current Grade 11 core/elective offerings and the separately published new Grade 12 pilot guides. Historical pre-rollout K to 10 assignment choices are retained as transitional catalog records where needed.

The current Grade 12 transition is deliberately explicit: non-pilot Grade 12 schools in SY 2026-2027 remain under the existing SHS curriculum, while Strengthened SHS Grade 12 is a pilot path with separately published new Grade 12 guides.

## Teacher workflow

1. My Classes and onboarding resolve learning-area options from the national catalog for the selected grade and school year.
2. Curriculum Navigator can browse catalogued DepEd offerings even when the teacher has no assignment yet.
3. For a teaching assignment, the repository first resolves an applicable curriculum version from Supabase.
4. Subject aliases are normalized so older assignment labels can map to the canonical subject row.
5. If there are no verified competency rows, the navigator returns `available: false` with a source-gated coverage note. It never exposes an empty subject as if it were ready for TOS/lesson generation.
6. Grade 7 Mathematics keeps its verified local-manifest fallback for temporary Supabase query gaps.

## Import pipeline

Verified competency manifests remain in `data/curriculum/*.json` and must pass `scripts/validate-curriculum.mjs`.

Generate one seed:

```bash
npm run curriculum:generate:g7math
```

Generate SQL for every verified manifest currently present:

```bash
npm run curriculum:generate:all
```

The batch generator skips manifests that are not explicitly marked verified. This makes future national expansion additive: new source-reviewed manifests can be added without rewriting the curriculum engine.

## Source integrity

A catalog entry is not an endorsement claim and is not executable policy. GuroDesk records the source family and status, and links teachers to the official DepEd source. Exact competency text must come from reviewed official material with provenance/page data before import.

Do not use Gemini or model memory to populate official competencies.

## Deliberately not done in this phase

- No synthetic competency generation.
- No silent migration of historical assignments to a different curriculum version.
- No database migration solely for catalog metadata; the catalog is application metadata while exact curriculum packs continue through the existing normalized curriculum tables.
- No claim that every catalogued curriculum already has competency-level coverage.
