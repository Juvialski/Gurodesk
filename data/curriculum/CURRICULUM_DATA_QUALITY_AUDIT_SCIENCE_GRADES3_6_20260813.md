# Curriculum Data Quality Audit — Science Grades 3–6

Date: 2026-08-13

## Scope

Pinned source family: `FINAL MATATAG Science CG 2023 Grades 3-10.pdf` (Department of Education, August 2023). This batch covers source pages 29–44 for Grades 3–6.

## Result

- Content Standards recovered: **70**
- Performance Standards recovered: **16**
- Total standards recovered: **86**
- Existing competencies preserved unchanged: **144**
- No competency codes were invented.
- Existing competency IDs, quarter/domain assignments, wording, sequence, and source pages were not rewritten.

Science uses explicit quarter-level Content Standards and Performance Standards. Standards are represented separately and linked deterministically through the existing quarter/domain records. Suggested Performance Tasks are intentionally not stored as standards in this pass.

## Verification note

The manifest remains pinned to the official DepEd source URL and SHA-256 already recorded in the repository. The official DepEd Learning Resources portal confirms the exact guide filename. A public reproduction of the same August 2023 guide was used only as a transcription/page-layout cross-check where the SharePoint viewer was not directly downloadable.

## Database safety

Migration `202608130036_science_grades3_6_verified_standards.sql` only inserts missing standard records using `NOT EXISTS`. It performs no competency update/delete and does not rewrite historical TOS or assessment snapshots.

## Next batch

Science Grades 7–10, source pages 46–67.
