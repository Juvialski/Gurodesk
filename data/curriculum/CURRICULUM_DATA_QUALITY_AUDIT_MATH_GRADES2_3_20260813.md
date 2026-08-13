# Curriculum Data Quality Audit — Mathematics Grades 2 and 3

Date: 2026-08-13
Scope: Revised K–10 / MATATAG Mathematics Grades 2 and 3.

## Source pin

Both manifests reference the same Department of Education curriculum guide used by the verified Grade 1, Grade 4, and Grade 7 passes:

- `FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf`
- August 2023 edition
- pinned SHA-256 `aee8e63e6136e6c4ea7c90649a35e21c824c7db79c279f9f41e324f2e8118eac`
- Grade 2 pages 29–33
- Grade 3 pages 34–38

The verified-standards sidecars are accepted by the manifest builder only when their source SHA matches the manifest source SHA.

## Grade 2 result

The existing manifest contains all 53 competency records and their current IDs. None were rewritten.

Recovered from the source:

- 16 Content Standards
- 19 Performance Standards
- 35 standards total
- quarter/domain relationships and ordering
- source-page provenance and verification status

The source table spells the Quarter 3 content-domain heading as `Number and Algebra`, so the current extraction created domain `D04` in addition to `D02` (`Number and Algebra (NA)`). Because existing Quarter 3 competencies already reference `D04`, this pass preserves that identifier rather than silently remapping historical competency/domain identity.

## Grade 3 result

The existing manifest contains all 51 competency records and their current IDs. None were rewritten.

Recovered from the source:

- 21 Content Standards
- 18 Performance Standards
- 39 standards total
- quarter/domain relationships and ordering
- source-page provenance and verification status

The source uses `Number and Algebra (N/A)` and `Measurement and Geometry (M/G)` in Quarter 4. Existing extraction therefore created `D04` and `D05`; Quarter 4 competencies already reference those IDs. They are retained for compatibility.

## Data-quality notes

No competency codes were invented. Existing null competency codes remain null.

The source wording is retained except for deterministic whitespace normalization. Source-specific punctuation and abbreviations such as `(NA)`, `(N/A)`, `(MG)`, and `(M/G)` are preserved even where inconsistent across pages.

One Grade 2 Quarter 2 Performance Standard associates the money-value statement with `(MG)` in the source reproduction. This pass preserves the source text exactly and scopes the record to the same existing domain used by the related competencies; it is not silently corrected by inference.

## Database safety

Migration `202608130033_math_grades2_3_verified_standards.sql` is additive and idempotent. It inserts standards only when the same source/period/domain/type/text record does not already exist. It contains no competency delete/update statements and does not rewrite TOS, assessment, result, or analysis snapshots.

## Next Mathematics packs

Next recommended source-audit batch: Grades 5 and 6, followed by Grades 8–10. Their manifests should not be mass-regenerated until their exact standards and source-table domain labels are verified.
