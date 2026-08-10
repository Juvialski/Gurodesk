# Phase 6 — Universal curriculum engine

## Goal

GuroDesk supports three curriculum sources through one normalized curriculum model:

1. **Official DepEd** — shared, immutable source-reviewed curriculum knowledge.
2. **My / school curriculum** — teacher-owned private curriculum created from an upload, pasted text, or manual entry.
3. **DepEd + school enrichment** — a teacher-owned hybrid version that deterministically inherits an official base and adds school-specific material without modifying the official rows.

The same normalized `curriculum_*` model feeds Curriculum Navigator, lesson plans, TOS, assessments, results, item analysis, and remediation. There is no second private-school assessment architecture.

## Import and approval workflow

Teacher-provided curriculum sources can be PDF, DOCX, XLSX, CSV, TXT, Markdown, pasted text, or manual entry. Supported upload files are bounded to 15 MB. PDF analysis uses the original PDF bytes; other supported formats are safely text-extracted in the browser before analysis.

AI analysis is **draft-only** and uses the teacher's own saved Gemini key. The prompt forbids invented competencies, standards, codes, page numbers, and official status. The teacher reviews periods, domains/strands, standards, competencies/objectives, and provenance before `publish_custom_curriculum` materializes normalized rows.

Manual entry requires no Gemini request.

## Privacy and ownership

- Raw uploaded sources use the private `custom-curricula` Storage bucket.
- Object paths are scoped to `auth.uid()` and the import ID.
- The analyzer re-checks the exact teacher/import path before a service-role download.
- `custom_curriculum_imports` is owner-only under RLS.
- Teacher-owned source documents and curriculum versions carry `owner_user_id`.
- Official curriculum rows keep `owner_user_id = null` and `origin_kind = official`.
- Browser clients have no direct canonical curriculum write grant; publishing and archiving use guarded RPCs.

## Hybrid provenance

A hybrid can inherit only a shared official base curriculum. During publication GuroDesk clones the relevant official periods, domains, standards, and verified competencies into the teacher-owned hybrid version. Inherited competencies retain `base_competency_id` and `provenance_kind = inherited`. School additions use `provenance_kind = custom`.

The official base is never updated by hybrid publication.

## Versioning

Approved curricula are immutable published versions. `New revision` creates another private review draft without a Gemini call. Publishing the revision supersedes the previous teacher-owned version while historical documents remain tied to their saved/pinned curriculum version.

## Downstream integrity

Teaching assignments now store `curriculum_source_kind` and an optional pinned `curriculum_version_id`.

Database guards enforce:

- official assignments may link only shared official curriculum competencies;
- custom/hybrid assignments may link only the exact teacher-owned curriculum version selected on that assignment;
- grade, learning area, school year, applicability, ownership, approval, and verification must agree;
- the same assignment/version guard runs for both lesson-plan and TOS competency links.

This prevents a browser from mixing a private competency into an official assignment merely because grade/subject labels match.

## AI boundary

Custom curriculum analysis uses the existing teacher BYOK model policy and fallback rules. Phase 6 does not introduce new Gemini model IDs, automatic model discovery, or a separate provider contract. AI analysis remains draft-only and never publishes curriculum content without teacher approval.
