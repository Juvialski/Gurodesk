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

## Active assessment policy reviewed for Phases 4.1–4.3

### DO 015, s. 2026

- Title: Revised Guidelines on Classroom Assessment, Grading System, and Awards and Recognition for the K to 12 Basic Education Program
- Publisher: Department of Education, Philippines
- Official PDF: `https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf`
- Issued: 2026-06-04
- GuroDesk scope in Phases 4.1–4.3: teacher assessment design only. Results encoding, grading, item analysis, learner analytics, and remediation remain outside the implemented boundary.
- Official rules applied to this phase: teacher-made examinations remain competency-aligned and based on lessons actually covered; a TOS guides item coverage; teacher use of AI may include drafting test items/prompts and alternative versions but remains subject to professional judgment, curriculum alignment, validation, review, assessment integrity, transparency, equity, and data privacy. Learner personally identifiable information is not sent to Gemini.
- Explicitly prohibited product behavior: AI does not determine grades, replace professional judgment, alter the finalized TOS allocation, invent curriculum identity, or evaluate learner work without teacher validation.
- Product good-practice rules, not represented as nationwide mandates: deterministic one-slot-per-TOS-item architecture, a supported two-to-six-choice range for multiple-choice items, structured JSON validation, bounded provider concurrency, and teacher acceptance states.
- School/division-specific conventions: exact paper headers, signatories, preferred item-type mix, number of choices within the supported range, and local document templates remain teacher- or school-configured rather than hard-coded as national requirements.

The assessment implementation deliberately does not convert the Order's grading, awards, results, or analytics provisions into Phase 4.3 functionality.

## Other current policies

### DO 016, s. 2026

- Category: lesson planning and learning design
- Use in GuroDesk: Phase 3 lesson-plan schema and validation
- Status: reviewed and implemented through the teacher-led ILAW workflow and constrained text/suggestion support described in the Phase 3 documentation

## Source-integrity rule

A DepEd webpage, curriculum guide, order, memorandum, or advisory may be registered as a source without immediately becoming executable application logic. Policy/curriculum facts must be reviewed and transformed deliberately before the app treats them as authoritative structured rules.
