# DepEd source register

Verified/reviewed: 2026-08-08.

This file records source provenance and implementation decisions. It is not itself the curriculum database; canonical structured data lives in verified manifests and Supabase.

## Active source used in Phase 2

### MATATAG / Revised K to 10 — Mathematics Grades 1, 4 and 7

- Publisher: Department of Education, Philippines
- Source type: Curriculum Guide
- Official landing page: `https://www.deped.gov.ph/matatagcurriculumk147/`
- Official PDF stored in manifest: `https://www.deped.gov.ph/wp-content/uploads/MATATAG-Mathematics-CG-Grades1-4-and-7.pdf`
- Phase 2 imported coverage: Grade 7 Mathematics, curriculum-guide pages 30-33
- Verified records: 52 competencies
- GuroDesk decision: preserve the guide's Quarter 1-4 sequence.

## School-year grading calendar

### DO 009, s. 2026

- Title: Guidelines on the Implementation of the Three-Term School Calendar in Basic Education
- Issued: 2026-04-16
- Applicable school year foundation: SY 2026-2027
- GuroDesk decision: store three grading terms in `school_year_calendars` / `grading_periods`; do **not** rewrite curriculum-guide quarters into terms.
- Current implementation materials also expect teachers to use a Three-Term Budget of Work (BoW), so GuroDesk has a separate `instructional_pacing_plans` / `instructional_pacing_entries` layer for verified BoW mappings.
- Exact term boundary dates and competency-to-term mappings are intentionally not guessed or seeded until directly transcribed from reviewed official materials.

## Current policies queued for later phases

### DO 015, s. 2026

- Category: classroom assessment / grading
- Use in GuroDesk: Phase 4+ assessment and grading rules
- Status in Phase 2: source-register only; policy details not yet transformed into application rules

### DO 016, s. 2026

- Category: lesson planning and learning design
- Use in GuroDesk: Phase 3 lesson-plan schema and validation
- Status in Phase 2: queued for detailed policy extraction before lesson generation is enabled

## Source-integrity rule

A DepEd webpage, curriculum guide, order, memorandum, or advisory may be registered as a source without immediately becoming executable application logic. Policy/curriculum facts must be reviewed and transformed deliberately before the app treats them as authoritative structured rules.
