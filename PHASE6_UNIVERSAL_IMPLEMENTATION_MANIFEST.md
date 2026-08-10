# GuroDesk Phase 6 — Universal Curriculum

Date: 2026-08-10

## Baseline preserved

This build is based on `gurodesk-generation-visual-final.zip` and preserves every file from that assessment-generation/visual checkpoint. It also includes the Phase 6 national curriculum catalog/resolver work.

## Implemented

### Universal curriculum
- National school-year-aware K–12/SHS catalog and source-integrity states.
- Grade/year-aware official curriculum selection in onboarding and My Classes.
- Private custom curriculum creation from upload, paste, or manual entry.
- PDF, DOCX, XLSX, CSV, TXT, and Markdown source support.
- One-time teacher-BYOK curriculum analysis that always produces a review draft.
- Teacher review/approval before normalized curriculum publication.
- Private Storage + owner-only RLS.
- Teacher-owned source/version/provenance metadata.
- Custom/hybrid curriculum revisions and archive behavior.
- Hybrid official-base inheritance with immutable official rows.
- Teaching assignment source kind: official/custom/hybrid.
- Pinned curriculum version for custom/hybrid assignments.
- Curriculum Navigator loads the assignment's pinned private version.
- Lesson Plan and TOS editors use the same pinned curriculum navigator.
- Database trigger prevents cross-source/cross-version competency links in lesson/TOS documents.

### Migration
- `202608100025_phase6_custom_hybrid_curricula.sql`

Migration harness count: 25.

## Deliberate boundaries
- AI cannot publish a curriculum automatically.
- Official DepEd rows cannot be modified by teacher custom/hybrid publication.
- Catalog coverage is not presented as verified competency coverage.
- Custom curricula are private to the teacher; school-wide organization sharing is a later organization/workspace feature.
- No real Gemini API calls are made by automated tests.
- Existing teacher BYOK model policy remains unchanged; this phase does not add model IDs or alter fallback policy.
- The Chromium assessment-flow regression is hardened by scoping the `final` TOS status assertion to the TOS card created by that test.

## Validation handoff

See `PHASE6_UNIVERSAL_VALIDATION_REPORT.txt` for checks completed locally, the npm dependency limitation of this execution environment, and the required GitHub Actions release gate.
