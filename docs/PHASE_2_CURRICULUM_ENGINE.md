# Phase 2 — Curriculum Engine

## Purpose

Phase 2 turns the curriculum area from a placeholder into a source-grounded knowledge layer that future lesson, assessment, TOS, and paperwork generation can trust.

## Core model

GuroDesk now separates three concepts that must not be conflated:

1. **Curriculum sequence period** — the period labels used inside a curriculum guide, such as Quarter 1 to Quarter 4.
2. **Instructional pacing / Budget of Work** — the reviewed mapping that tells teachers when competencies are delivered in the active school year.
3. **School grading/reporting period** — the active calendar, such as Term 1 to Term 3 for SY 2026-2027.

This lets a teacher work in a three-term school year while still preserving the official curriculum guide as published. Phase 3 must use a verified BoW/pacing layer when one is available; it must never assume Quarter 1 = Term 1.

## Resolution flow

```text
Teacher assignment
  → school year + grade + learning area
  → curriculum_applicability
  → applicable curriculum version
  → matching curriculum subject
  → subject-specific curriculum periods
  → domains + standards + verified competencies
  → official source/provenance
```

The query filters structured metadata first. Semantic/RAG retrieval is not needed for basic competency lookup.

## First verified dataset

`data/curriculum/matatag-grade7-mathematics.json`

Coverage:
- Grade 7
- Mathematics
- Revised K to 10 / MATATAG Curriculum
- Quarter 1 to Quarter 4
- 52 competency records
- source-page provenance: pages 30-33 of the official curriculum guide
- no competency code is asserted when the source does not provide one

The manifest is also used in demo mode, so preview data and production seed data share one source of truth.

## Import pipeline

Canonical source:

```text
data/curriculum/*.json
```

Validation:

```bash
npm run curriculum:validate
```

Generator:

```bash
node scripts/generate-curriculum-sql.mjs <manifest.json> <output.sql>
```

The generator refuses manifests that are not explicitly marked verified.

## Verification requirements

Before a new manifest may be marked `verified`:

- source must be an official DepEd source
- grade and learning area must match the source
- every competency must have a source page
- period references must be valid
- domain references must exist
- competency order must be deterministic within each period
- duplicate competency rows must be resolved
- no inferred competency code may be presented as official
- implementation/applicability claims must be supported by an official source

## Teacher UI

The Curriculum Navigator:

- defaults to the teacher's assignments
- shows school grading-calendar context separately
- shows the applicable curriculum version
- shows verified coverage count
- links to the official source when a URL is stored
- switches across curriculum periods
- searches within the selected period
- groups competencies by domain
- shows source page and verification status
- shows performance-standard context
- leaves lesson/quiz actions disabled until their later phases

## Database changes

Phase 2 adds:

- `curriculum_applicability`
- `school_year_calendars`
- `grading_periods`
- `instructional_pacing_plans`
- `instructional_pacing_entries`
- `academic_periods.subject_id`
- source publisher/retrieval metadata
- curriculum-version implementation notes

The old Phase 1 uniqueness rule for `academic_periods` is replaced so multiple subjects can each have their own `Quarter 1`.

## Phase 3 contract

Lesson generation must receive a selected verified competency object and source metadata from this engine. For SY 2026-2027 it should also resolve a verified Budget of Work / pacing entry when available before assigning term/week context. Gemini must never be asked to determine the official competency or infer a quarter-to-term mapping from memory.
