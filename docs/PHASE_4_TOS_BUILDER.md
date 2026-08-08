# Phase 4 — Table of Specifications Builder

## Scope

Phase 4 implements only `Curriculum → TOS`. It does not generate assessment questions, test papers, answer keys, item analysis, result-driven remediation, or AI-written questions.

## Teacher workflow

1. Choose a teacher-owned assignment.
2. Select the school grading term independently from one or more curriculum-guide periods.
3. Select verified competencies through the mobile-safe custom picker.
4. Choose equal, instructional-time, or manual-percentage weighting.
5. Optionally lock individual competency item counts.
6. Configure cognitive-process labels and relative distributions.
7. Review exact totals, warnings, and contiguous item placement.
8. Save drafts, reopen/edit, finalize, duplicate, print, or export PDF/XLSX.

Demo mode stores TOS documents in browser storage. Production mode uses teacher-owned Supabase records and an atomic save/version function.

## Structured model

The authoritative document content stores assignment snapshots, grade/learning area, school year, school grading term, curriculum version/subject, selected curriculum periods, title/assessment title, total items, weighting method, configurable cognitive categories, competency rows, notes, and an allocation-engine record.

`public.tos_competencies` projects every saved verified competency row into relational data with canonical competency foreign keys, source snapshots, source/computed weights, item totals/ranges, and category allocations. The generic `documents`/`document_versions` foundation remains the parent/version store.

## Deterministic allocation

`src/lib/tosAllocation.ts` parses decimal strings into scaled `bigint` coefficients and uses Hamilton's largest-remainder method:

1. Allocate each unlocked row its exact quota from the remaining test items.
2. Take each quota's integer floor.
3. Assign remaining items by descending fractional remainder.
4. Resolve equal remainders by row order, then stable row ID.
5. Apply the same process within each row for cognitive categories.
6. Assign item numbers in row order and category order.

Manual item-count overrides are fixed first. The residual is apportioned only among unlocked rows. Overrides above the selected total, leftover items with every row locked, malformed/negative values, and positive residuals with zero unlocked weight are errors. The invariant is exact: allocated item count equals the selected total, and placements are `1..N` with no gap, duplicate, or overlap.

Displayed computed weights are apportioned deterministically in hundredth-percent units, so they also sum to exactly `100.00%` instead of `99.99%` or `100.01%`. Manual percentage weights must total exactly `100`; decimal string comparison avoids floating-point drift. Finalization additionally rejects any competency with zero items.

## Curriculum safeguards

- Only the verified curriculum navigator populates TOS rows.
- The existing canonical verified-manifest fallback remains supported.
- Non-UUID fallback IDs are never written to curriculum UUID foreign keys; production save resolves an exact verified text/page/version/subject/period match and rejects ambiguity.
- Final validation checks the current verified bundle and marks stale selections.
- Curriculum-guide sequence and school grading periods remain independent fields. No quarter-to-term inference exists.
- Instructional-time weighting uses a verified pacing plan when present; otherwise the teacher enters actual minutes.

## Database and RLS

Migration `202608080012_phase4_tos_builder.sql` adds:

- `public.tos_competencies` with `on delete restrict` competency links, unique row/competency rules, non-negative constraints, range consistency, indexes, and teacher-owned RLS;
- assignment-owner enforcement for generic documents;
- verified source/version/subject/period/snapshot guards;
- final TOS immutability and independent total/range/category reconciliation;
- final JSON-to-relational row identity, canonical curriculum, weighting-source, and grading-calendar reconciliation;
- immutable TOS version history;
- atomic security-definer `save_tos_document(...)` with explicit `auth.uid()` ownership checks, row locking, and version creation;
- supported DOCX/XLSX template-pair, private storage-path, and TOS master-fingerprint constraints. These are `NOT VALID` for safe rollout over existing Phase 3.7 rows but still enforce all new or updated rows; deployments should audit legacy template metadata before later validating them globally.

Final or archived TOS documents cannot be hard-deleted. A final TOS can only be archived. Editing requires duplication into a new draft.

## Export

The built-in export is a plain teacher document with no AI declaration, GuroDesk branding, or technical provenance. It supports browser print, deterministic PDF, and a first-class XLSX workbook.

The checked-in `src/assets/tos-standard.xlsx` master has:

- a 60-row competency capacity;
- configurable cognitive headers (up to eight columns for built-in PDF/XLSX export; the document model and browser print view remain taxonomy-flexible);
- formulas for weight/category/item totals;
- preserved styles, merged metadata cells, widths/heights, freeze panes, landscape orientation, print area/titles, footer, and recalculation-on-open metadata.

## Custom XLSX templates

The custom path uses direct OOXML patching with the existing browser-compatible `pizzip` dependency. Every export starts from fresh, SHA-256-verified master bytes and changes only mapped existing `<c>` values. Unmapped ZIP parts remain byte-identical. A touched worksheet XML part is parsed and serialized, so it is preserved semantically rather than promised to remain byte-identical: formulas, style IDs, merges, widths/heights, sheet names, drawings, print settings, headers, and footers remain intact. Workbook calculation metadata is set to automatic/full recalculation so preserved formulas refresh in Excel or LibreOffice.

Gemini may analyze an extracted text/cell structure once through `tos-template-analyzer`. Raw workbook bytes are not sent. Teachers confirm or replace every mapping and fixed data-row range. Saved exports do not call Gemini and AI never performs TOS arithmetic.

Reliable Phase 4 custom scope:

- `.xlsx` only, maximum 10 MB compressed, 200 MB expanded, 5,000 workbook parts, 25 MB per parsed XML part, and 100 confirmed mappings;
- scalar fields and fixed-capacity existing competency rows;
- text/number writes to existing styled cells;
- merged-cell anchor writes only;
- formula targets remain read-only;
- formula cells and merged non-anchor cells are excluded from manual and AI suggestions;
- duplicate destinations, mixed table ranges, missing/unstyled cells, formulas, and merged non-anchors fail a save/export preflight;
- source hash is required and verified before export;
- unused cells in every mapped fixed-capacity data column are cleared, preventing stale sample/prior-row values from leaking into a shorter export;
- standard Transitional OOXML only; Strict OOXML receives a clear resave-as-standard `.xlsx` instruction.

Explicit limitations:

- no `.xls`, `.xlsm`, encrypted workbook, Strict OOXML workbook, row/column insertion, table expansion, auto-fit, or custom-workbook PDF preview;
- mapped data cells must already exist in the template;
- content in unmapped master cells is intentionally preserved, so teachers should start from a clean reusable master and map every old-value column they expect GuroDesk to clear;
- workbook formulas are preserved and flagged for recalculation by Excel/LibreOffice on open; GuroDesk does not evaluate them;
- Phase 4 PDF/XLSX export supports at most eight cognitive-category columns and fails clearly instead of silently omitting categories.

## Validation

Run:

```bash
npm install
npm run curriculum:validate
npm run validate:phase2
npm run validate:phase3
npm run validate:byok
npm run validate:phase35
npm run validate:phase351
npm run validate:phase352
npm run validate:phase353
npm run validate:phase36
npm run validate:phase361
npm run validate:phase362
npm run validate:phase363
npm run validate:phase37
npm run validate:phase4
npm run build
```

`validate:phase4` executes the allocation edge cases and an actual XLSX round trip against the checked-in master, including hash mismatch, formulas, merges, styles, row/column dimensions, print metadata, freeze panes, formula recalculation, stale mapped-row clearing, duplicate targets, incompatible table ranges, and Strict OOXML rejection.

## Next boundary

Review and deploy the TOS foundation first. A later explicitly approved phase may consume a finalized TOS to create assessment content; it must not be added implicitly to this phase.
