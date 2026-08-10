# GuroDesk assessment export + final QA hardening

Date: 2026-08-10

This pass hardens assessment presentation and deterministic final review after a completed 40-item Grade 7 Mathematics export exposed pagination, raw math-markup, visual consistency, duplication, and generic response-layout defects.

## Scope boundary

This pass intentionally does **not** change:

- Gemini model selection, JSON-MIME generation, thinking level, fallback policy, or provider request count;
- Supabase RLS, schema, or migrations;
- TOS allocation or immutable item mapping;
- scoring/results/remediation behavior;
- the TikZ/structured-visual generation security model; or
- curriculum ingestion.

Migration count remains **26**.

## Export presentation changes

- Student PDF layout is question-aware instead of line-by-line. Short/structured questions are kept together. Long constructed/problem/essay questions keep their item number, stem, diagram, subparts, and choices together and may split only in their response-writing area.
- Type-section headings are emitted only when question types are already contiguous, preserving legacy mixed assessments while giving grouped assessments conventional test-paper sections.
- First-page PDF metadata uses measured two-column rows so the question body cannot overlap the assessment header.
- Section headings are preflighted with the first question core so headings are not orphaned at a page bottom.
- Visuals are placed after the stem and scaled by purpose. Cartesian construction/graph visuals receive a larger paper footprint.
- Student controls are type-specific: explicit True/False boxes, A/B/C/D choice labels, multiple-select checkboxes, two-column Matching, inline Fill-in-the-Blank, numerical Answer/Unit fields, concise one-line answers, and point-aware constructed-response writing space.
- Repeated `Response:` labels on every writing line are removed.
- Print-preview/HTML and DOCX consume the same type/presentation decisions. Print/export keeps deterministic SVG geometry and does not depend on live TikZJax.

## Math text hardening

`src/lib/assessmentMathText.ts` normalizes the bounded TeX-like notation historically emitted in prompts for export/preview without executing TeX. Examples include `\\angle`, degree notation, common operators, simple fractions, square roots, and common superscripts. Unsupported TeX-like markup is surfaced as a Final Review warning.

The saved assessment prompt is never silently rewritten; normalization occurs only in the presentation/export projection.

## Deterministic Final Test Review hardening

Final Review now checks, without additional Gemini calls:

- questions that explicitly depend on a visual but have no valid exportable visual;
- structured polygon side-count, convexity, and regularity contradictions that can be computed safely from GuroDesk's visual DSL;
- named angle/explicit visual labels referenced by a visual-dependent prompt but absent from the structured visual;
- exact and strong semantic duplicates within the same question type/competency;
- near-duplicate prompts as overridable warnings; and
- point concentration in a closely related evidence cluster as an overridable warning.

Only deterministic contradictions become hard blockers. Similarity/evidence concentration remains teacher-reviewable unless the questions are exact or effectively duplicate evidence.

## Regression coverage

Added/updated coverage includes:

- bounded math normalization;
- type-specific response presentation;
- contiguous section detection;
- required visual and polygon semantic checks;
- missing visual-label checks;
- duplicate/evidence-concentration classification;
- student print HTML structure and no repeated generic response labels;
- E2E preview verification that raw TeX delimiters/commands do not leak while the persisted raw prompt remains editable; and
- a static `check-assessment-export-qa.mjs` guard automatically discovered by `validate:all`.

## Visual acceptance check performed in this implementation environment

A synthetic 40-item grouped assessment covering all 11 question types, geometry, Cartesian plotting, long responses, and TeX-like prompt notation was projected through the shared print presentation model for both **A4** and **Letter**. Both produced seven-page acceptance PDFs. Every rendered page was visually inspected. The acceptance renders showed:

- no header/question overlap;
- no orphaned stem/diagram pairs;
- no raw `$...$`, `\\angle`, or `\\circ` text;
- explicit A/B/C/D choice labels;
- usable True/False, Matching, Fill-in-the-Blank, Numerical, and Multiple Select paper controls;
- larger Cartesian graph presentation; and
- long-answer continuation only after the question core.

The original teacher-exported PDF was used locally as a regression reference only and is **not included in this repository/package**.

## Environment limitation / authoritative release gate

This ChatGPT execution environment cannot complete a clean `npm ci` because its internal npm mirror returns 404 for existing lockfile dependencies (first observed `yallist@3.1.1`, then `xml-js@1.6.11`). Therefore the complete Vitest/Vite/Chromium suite must still pass in GitHub Actions before release.

Dependency-independent gates, pure TypeScript semantic checks, TS/TSX transpilation, Phase 4.4 domain validation, BYOK, Phase 6 validators, E2E stability static guard, and migration shell syntax were run locally during this pass.
