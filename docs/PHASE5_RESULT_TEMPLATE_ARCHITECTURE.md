# Phase 5 results-template architecture

Phase 5.3 defines the boundary for teacher-owned result and item-analysis XLSX templates without claiming that the upload workflow is complete.

## Supported first-class output

The built-in deterministic workbook is the supported export. It creates these sheets on every export:

1. `Summary`
2. `Learner Scores`
3. `Item Analysis`
4. `Option Analysis`
5. `Competency Analysis`
6. `Cognitive Analysis`
7. `Remediation`

Values are written directly from the immutable result-session snapshot and deterministic analysis. Correctness does not depend on spreadsheet formulas.

## Proposed mapping contract

`src/types/resultsTemplate.ts` defines the future field catalog and mapping shapes. Scalar fields include report title, grade level, learning area, school year, grading term, section, and administration date. Repeating table fields cover learner scores, item analysis, option analysis, competency analysis, cognitive analysis, and remediation.

The intended lifecycle is:

`Upload existing XLSX → inspect workbook → show worksheet/header/table candidates → teacher maps fields → validate mapping → confirm → store source hash and mapping → fill future workbooks deterministically`

## Intentionally incomplete in Phase 5.3

The following are not enabled yet:

- uploading or storing a teacher workbook;
- workbook inspection UI and candidate detection;
- teacher confirmation of scalar and repeating-table mappings;
- database/storage records for result-template source hashes and mappings;
- variable-length table insertion while preserving the teacher's styles, merged cells, formulas, and print areas;
- filling a confirmed result template on future exports.

The existing TOS template filler is not reused for these operations: its fixed scalar/column mapping contract cannot safely represent multiple variable-length analysis sheets. The architecture therefore exposes the limitation rather than silently treating an arbitrary workbook as compatible.

