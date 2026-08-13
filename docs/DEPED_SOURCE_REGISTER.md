# DepEd source register

Verified/reviewed: 2026-08-13.

This file records source provenance and implementation decisions. It is not itself the curriculum database; canonical structured data lives in verified manifests and Supabase.

## Active official curriculum sources

### Revised K to 10 / MATATAG

- Publisher: Department of Education, Philippines
- Source type: 13 official curriculum-guide PDFs
- Official program page: `https://www.deped.gov.ph/matatagcurriculumk147/`
- Official regional curriculum repository used for the reviewed current files: `https://bukidnon.deped.gov.ph/matatag-curriculum/`
- Imported coverage: 73 catalog entries represented by 80 manifests, 4,277 verified competencies, and 1,950 exact-source content/performance standards across 59 standards-complete manifests. Grade 4–10 MAPEH is intentionally split into Music and Arts and Physical Education and Health source manifests.
- Exact-source hold: 21 Grade 4–10 standards manifests remain unpopulated for Araling Panlipunan, Music and Arts, and Physical Education and Health because currently retrievable public files do not match the three registered source hashes. Competencies remain verified; standards are not substituted or invented.
- GuroDesk decision: preserve official quarters and Kindergarten themes as curriculum-source periods. Do not infer school grading-term mappings.

### Strengthened Senior High School Program

- Publisher: Department of Education, Philippines
- Source type: 116 official curriculum-guide PDFs: 94 Grade 11 and 22 Grade 12
- Official program page: `https://www.deped.gov.ph/strengthened-shs-program/`
- Official learning-resource portal: `https://sites.google.com/deped.gov.ph/deped-lrportal/senior-high-school/strengthened-shs-program-you-are-herecurrentstrengthened-shs-program`
- Imported coverage: all 116 current catalog entries represented by 116 manifests, 1,904 verified competencies, and 888 exact-source content/performance standards.
- GuroDesk decision: preserve Grade 11 source quarters. Grade 12 documents explicitly cover one term, so store one term and do not infer quarter or grading-term mappings.

### Machine-verifiable register

`data/curriculum/sources/official-source-register.json` is authoritative for the 129 reviewed files. It pins the source/landing URLs, official Drive file IDs where applicable, file names, editions, page counts, byte sizes, retrieval date, and SHA-256 hashes. `data/curriculum/sources/official-pack-index.json` maps those sources to 196 manifests, and every competency retains its PDF page.

The reviewed source set totals 74,537,724 bytes. Source PDFs are verification inputs and are not committed to the repository.

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
- GuroDesk scope in Phases 4.1–4.3: teacher assessment design only. Phase 5.0–5.3 now adds teacher-entered results, deterministic analysis, and teacher-reviewed remediation without implementing the full grading/class-record system.
- Official rules applied to this phase: teacher-made examinations remain competency-aligned and based on lessons actually covered; a TOS guides item coverage; teacher use of AI may include drafting test items/prompts and alternative versions but remains subject to professional judgment, curriculum alignment, validation, review, assessment integrity, transparency, equity, and data privacy. Learner personally identifiable information is not sent to Gemini.
- Explicitly prohibited product behavior: AI does not determine grades, replace professional judgment, alter the finalized TOS allocation, invent curriculum identity, or evaluate learner work without teacher validation.
- Product good-practice rules, not represented as nationwide mandates: deterministic one-slot-per-TOS-item architecture, a supported two-to-six-choice range for multiple-choice items, structured JSON validation, bounded provider concurrency, and teacher acceptance states.
- School/division-specific conventions: exact paper headers, signatories, preferred item-type mix, number of choices within the supported range, and local document templates remain teacher- or school-configured rather than hard-coded as national requirements.

The assessment implementation deliberately does not convert the Order's grading, awards, or class-record provisions into automatic application rules. Phase 5 uses the Order as policy context for teacher assessment and privacy boundaries; it does not present analytical thresholds, correlation minimums, remediation cutoffs, or spreadsheet layouts as national requirements.

## Phase 5 results, privacy, and analytics boundary

### Official policy sources reviewed

- DepEd Order No. 015, s. 2026, official PDF: `https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf`
- DepEd official privacy notice example and data-protection guidance: `https://bukidnon.deped.gov.ph/about/data-privacy-notice/`
- National Privacy Commission, Implementing Rules and Regulations of Republic Act No. 10173 (Data Privacy Act of 2012): `https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/`
- National Privacy Commission foundational data-privacy course/reference: `https://privacy.gov.ph/eduprivacy/`

These sources are policy/provenance references. A regional DepEd privacy notice is not treated as a universal school retention schedule, and the application does not invent statutory retention periods.

### Mandatory policy versus analysis and product conventions

The implementation treats applicable official obligations—lawful and transparent processing, data minimization, access control, assessment integrity, teacher validation, curriculum alignment, and protection of learner information—as governing constraints. It does not claim that DepEd Order No. 015 mandates a particular facility label, item-rest cutoff, minimum sample size, remediation threshold, option-count range, workbook sheet layout, or ranking view.

The following are transparent mathematical measures or configurable GuroDesk defaults:

- facility is `correct / attempted` for correctness-applicable responses, with omitted separate;
- point facility is earned points divided by applicable possible points;
- option percentage is option count divided by attempted responses;
- binary objective item-rest is Pearson correlation of item `0/1` with rest-of-test score;
- partial-point item-rest uses normalized item points and is labelled;
- correlation is explicitly insufficient when `n < 10` or either variable has zero variance; and
- remediation thresholds and qualitative instructional signals are teacher-selected conventions.

School/division-specific headers, signatories, templates, calendars, retention rules, and intervention procedures remain local decisions requiring the responsible authority's confirmation. Teachers retain professional judgment; deterministic analysis is evidence for review, not an automatic grade, diagnosis, ability label, or public ranking.

### Learner-data minimization and AI boundary

Phase 5 needs only an internal UUID, owning teacher, assignment/section, display name, optional teacher-local reference, and active state for a basic learner record. It does not require LRN, birth date, address, phone/email, guardian, health/disability, socioeconomic, password, or unrelated profile fields. Result participants snapshot the minimum historical identification and assessment traceability needed by the owning teacher.

Names, learner IDs, local learner references, complete answer sheets, and individual raw response histories must not be sent to Gemini. Optional remediation suggestions may receive only verified competency, aggregate class performance, common incorrect-option counts, cognitive category, number needing additional practice, language preference, and teacher-selected instructional constraints. Application code remains authoritative for scoring and item analysis.

### RLS, deletion, and no-grading boundary

Learner, outcome, result-session, remediation, report, and template data must be strictly teacher-owned. Security-definer routines derive ownership from `auth.uid()`, verify related assignment/assessment/result ownership, set a safe `search_path`, and never trust a client-supplied owner ID. Historical learners with finalized results are deactivated/archived rather than destructively removed; draft result sets and safe dependent outcomes may be deleted. Retention is left to approved school/division policy. This release does not implement full grading/class records, report cards, awards/ranking, portals, or AI-assigned grades.

## Other current policies

### DO 016, s. 2026

- Category: lesson planning and learning design
- Use in GuroDesk: Phase 3 lesson-plan schema and validation
- Status: reviewed and implemented through the teacher-led ILAW workflow and constrained text/suggestion support described in the Phase 3 documentation

## Source-integrity rule

A DepEd webpage, curriculum guide, order, memorandum, or advisory may be registered as a source without immediately becoming executable application logic. Policy/curriculum facts must be reviewed and transformed deliberately before the app treats them as authoritative structured rules.
