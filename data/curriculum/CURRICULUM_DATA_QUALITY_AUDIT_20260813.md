# Curriculum Data Quality Audit — Grade 7 Mathematics

Date: 2026-08-13
Scope: Grade 7 Mathematics first; architecture-level review of the remaining official packs.

## Source pin

- Manifest: `data/curriculum/official/revised-k10-grade-7-mathematics.json`
- Official title: `MATATAG Mathematics CG 2023 Grades 1-10`
- Publisher: Department of Education
- Edition: August 2023
- Pinned SHA-256: `aee8e63e6136e6c4ea7c90649a35e21c824c7db79c279f9f41e324f2e8118eac`
- Pinned manifest page mapping for Grade 7: 52–55

The standards recovered in this pass are retained in the source-pinned verified extraction sidecar only when that exact source hash matches. A hash mismatch aborts regeneration rather than applying stale standard text.

## Grade 7 Mathematics discrepancy result

The existing manifest already contained the four quarters, the three official content areas, and all 52 learning competencies. Existing competency `recordId` values were preserved unchanged.

Missing curriculum information recovered:

- 21 Content Standards
- 21 Performance Standards
- period/domain relationships for all 42 standards
- standard ordering
- source-page provenance for all 42 standards
- verification status for all 42 standards

No official learning-competency codes were found for these Grade 7 Mathematics rows; existing `null` codes remain unchanged.

No missing or duplicated Grade 7 Mathematics competencies were identified in the source comparison. Quarter/domain assignment and the existing 14/12/12/14 competency sequence were retained.

## Root cause

The standards loss was deterministic, not a UI problem:

1. `ExtractedDocument` already exposed a `standards` field, but the extraction/build path never populated or consumed it.
2. `make_manifest()` hard-coded `"performanceStandards": []`, so every regenerated manifest discarded standards regardless of source content.
3. The SQL generator only consumed `performanceStandards`, forced every record to type `performance`, did not preserve domain relationships, and used the quarter as standard sort order.
4. The demo navigator likewise loaded only quarter-level Performance Standards and discarded Content Standards/domain scope.
5. The integrity hash excluded standards, so a manifest could silently lose all standards and still pass payload-integrity validation.

## Corrective design

The corrected Grade 7 manifest now has a canonical `standards` collection with explicit `type`, `quarter`, `domain`, `sortOrder`, exact source text, `sourcePage`, and verification status. `contentStandards` and `performanceStandards` are retained as compatibility projections.

Because merged-cell/quarter-level standards do not share the same geometry as competency rows, this pass does not risk a broad unverified PDF auto-regeneration. The verified standards extraction is stored as a separate source-pinned sidecar. The manifest builder verifies the sidecar slug, verified status, and exact source SHA before consuming it. This prevents both silent standards loss and accidental application to a different curriculum-guide revision.

## Database compatibility

The existing `curriculum_standards` schema already supports `content` and `performance`, nullable period/domain relationships, source document, source page, and ordering. No schema migration is required.

A data-only migration adds the 42 current source-pinned records and removes only the four superseded paraphrased Grade 7 Mathematics performance-standard rows tied to the older `MATATAG-Mathematics-CG-Grades1-4-and-7.pdf` source. Historical finalized TOS documents remain snapshots and are not rewritten.

## Remaining curriculum packs

Architecture audit result: the manifest builder previously hard-coded an empty standards collection for all generated packs. Therefore every pack was vulnerable to the same data-loss category.

Priority follow-up:

1. Revised K–10 Mathematics Grades 1–6 and 8–10: same official Mathematics guide family; re-extract CS/PS against each pinned grade section before writing data.
2. Other MATATAG K–10 guides: inspect their official table structures individually. Do not assume every learning area uses the Mathematics hierarchy.
3. Strengthened SHS packs: inspect source structure separately; do not require CS/PS when the official guide uses another hierarchy.
4. Do not mass-regenerate the 196 current manifests until each source family has verified standards extraction fixtures or a source-specific deterministic parser with regression coverage.

## Source-page and retrieval note

The current pinned manifest maps Grade 7 Mathematics to PDF pages 52–55. The pinned SharePoint viewer could not be fetched directly in this runtime. The Department of Education Learning Resources portal independently confirms the exact 73-page Mathematics curriculum-guide filename, and an official DepEd Region V Mathematics 7 resource independently corroborates the Quarter 1 Performance Standard wording. A public reproduction of the same 73-page layout was used only as a transcription/page-layout cross-check; it also places Grade 7 on pages 52–55 and was not treated as the authoritative source. The established source-page provenance was therefore retained. Future source verification should compare the exact bytes against the pinned SHA-256 whenever direct SharePoint retrieval is available.

## Continuation — Phase 1 Mathematics Grades 1 and 4

After the Grade 7 correction was merged, the same source-pinned standards pass was applied to the other Mathematics grades explicitly published in DepEd's Phase 1 K/1/4/7 curriculum release: Grade 1 and Grade 4. Both manifests point to the same pinned 73-page `FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf` with SHA-256 `aee8e63e6136e6c4ea7c90649a35e21c824c7db79c279f9f41e324f2e8118eac`.

### Grade 1 Mathematics

- Existing competencies preserved: 47
- Existing competency IDs changed: 0
- Period sequence preserved: 13 / 10 / 12 / 12
- Content Standards recovered: 15
- Performance Standards recovered: 15
- Standards pages: 25–28
- Existing official competency codes remain `null`

### Grade 4 Mathematics

- Existing competencies preserved: 50
- Existing competency IDs changed: 0
- Period sequence preserved: 13 / 10 / 14 / 13
- Content Standards recovered: 17
- Performance Standards recovered: 19
- Standards pages: 39–43
- Existing official competency codes remain `null`

The different Grade 4 Content/Performance Standard counts are intentional and reflect the source structure. A single Content Standard can correspond to multiple separate Performance Standard statements; the data model therefore does not force one-to-one standard pairing.

### Database handling

Migration `202608130032_phase1_math_verified_standards.sql` is standards-only and idempotent. It inserts the Grade 1 and Grade 4 source-pinned standard rows using the existing curriculum subject, period, domain, and source-document records. It does not rewrite competencies, TOS snapshots, assessments, result sessions, or historical analysis.

### Regression coverage

`tests/unit/mathematics-phase1-standards.test.ts` verifies stable competency identities, expected standards counts, source-page/domain provenance, compatibility projections, and deterministic quarter/domain applicability for both Grade 1 and Grade 4.

### Remaining Mathematics packs

The same standards-loss category still requires source-specific recovery for Grades 2, 3, 5, 6, 8, 9, and 10. They should be handled in bounded batches rather than by a blind regeneration. The next safe batch is Grades 2 and 3, followed by Grades 5 and 6, then Grades 8–10.
