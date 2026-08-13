# Curriculum Data Quality Audit — Mathematics Grades 5 and 6

Date: 2026-08-13
Scope: Revised K to 10 / MATATAG Mathematics, Grades 5 and 6 only.

## Source trace

Both manifests pin `FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf`, August 2023, SHA-256 `aee8e63e6136e6c4ea7c90649a35e21c824c7db79c279f9f41e324f2e8118eac`.
The DepEd LR Portal independently lists that exact curriculum-guide filename. The pinned SharePoint viewer does not expose downloadable bytes in the current execution environment, so page transcription was checked against multiple complete page reproductions of the same 73-page August 2023 guide and against the already-verified competency rows/page boundaries in the manifests. No standard text was inferred from competency wording.

Grade 5 uses source pages 44–47. Grade 6 uses source pages 48–51.

## Grade 5

Existing competencies: 49 (12 / 12 / 13 / 12 by quarter), unchanged.
Recovered standards: 36 total — 17 Content Standards and 19 Performance Standards.
No competency codes were introduced.
No competency IDs, domains, quarter assignments, sequence values, source pages, or competency text were changed.

## Grade 6

Existing competencies: 52 (14 / 12 / 13 / 13 by quarter), unchanged.
Recovered standards: 30 total — 15 Content Standards and 15 Performance Standards.
No competency codes were introduced.
No competency IDs, domains, quarter assignments, sequence values, source pages, or competency text were changed.

## Data model / compatibility

Standards use the canonical `standards` collection with `type: content|performance`, quarter, domain, sort order, source page, and verification status. Compatibility projections `contentStandards` and `performanceStandards` are retained. Existing competency IDs and historical TOS/assessment snapshots are untouched.

The database migration is additive and idempotent. It inserts only missing standards using exact subject/period/domain/source relationships and `not exists` guards. It does not delete or update competencies or historical snapshots.

## Validation

- All 196 official manifests pass `scripts/validate-curriculum.mjs`.
- Dataset total remains 6,181 verified competencies.
- Grade 5: 17 content + 19 performance = 36 standards.
- Grade 6: 15 content + 15 performance = 30 standards.
- Regression test added for stable competency IDs, null competency codes, standard counts/provenance, compatibility projections, and deterministic quarter/domain applicability.
- Vitest/typecheck/Vite build were unavailable in this extracted workspace because their local executables are not installed; CI should execute them after the patch is pushed.

## Next Mathematics scope

Grades 8–10 remain the next source-audit batch. They use the same pinned Mathematics guide but must be verified page-by-page before standards are added.
