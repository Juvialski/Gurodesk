---
name: assessment-export-qa
description: >-
  Quality assurance procedure and testing guide for GuroDesk assessment export renderers
  (DOCX, PDF, Web Preview, and Browser Print). Use when modifying assessment typography, layout, or exports.
---

# Assessment Export QA & Geometry Verification Guide

This skill provides step-by-step verification procedures when creating, editing, or refactoring assessment export renderers and document preview layouts.

---

## 1. Export Target Checklist

Whenever assessment layout, typography, or item structures are changed, verify all 4 export/viewing targets:

| Target | Core Files | Key Verification Points |
| :--- | :--- | :--- |
| **Web Preview** | `src/components/AssessmentDocumentView.tsx`, `src/assessment.css` | Grid column width (`minmax(58px, max-content)`), no line breaks between blanks and numbers, no prompt overlap. |
| **Word (.docx)** | `src/lib/assessmentExport.ts` | Paragraph `spacing`, font `size` match between stems (`size: 20`) and choices (`size: 20`), SVG diagrams embedded properly. |
| **PDF** | `src/lib/assessmentExport.ts` (`buildAssessmentPdfBlob`) | `drawPdfQuestionHead` dynamic X-offset calculation, font `size: 9.5` match between stems and choices, page-overflow safety. |
| **Browser Print** | `src/lib/assessmentExport.ts` (`buildPrintHtml`), `@media print` in `src/assessment.css` | Page margins, section headers, choice spacing, break-inside rules. |

---

## 2. Text Normalizer Guardrails

When modifying math normalization in `src/lib/assessmentMathText.ts`:
1. **Blanks & Underscores**: Multi-underscore tokens (`_____ 1.`, `_____ 10.`) must never be transformed by LaTeX subscript rules.
2. **Exponents & Powers**:
   - Variables with single-digit powers: `a3 = b2` &rarr; `a³ = b²`
   - Common measurement units: `50cm3` &rarr; `50cm³`, `10cm2` &rarr; `10cm²`, `100m2` &rarr; `100m²`
   - Roots: `\sqrt[3]{b}` &rarr; `∛(b)`
3. **True/False Statements**:
   - Always run through `cleanTrueFalsePrompt()` to strip boilerplate lead-ins before rendering.

---

## 3. Automated CI Verification

Always execute and confirm the full test suite passes before committing or pushing changes:
```powershell
npm.cmd run test:ci
```
This runs:
- `validate:schools` &mdash; School directory & district candidate validation
- `typecheck`, `typecheck:tests`, `typecheck:e2e` &mdash; Strict TypeScript compiler checks
- `validate:edge-functions` &mdash; Supabase Edge Function source checks
- `validate:all` &mdash; All 42 curriculum, database, and system validator scripts
- `test:unit` &mdash; All 56 Vitest suites
- `build:bundle` &mdash; Full production Vite bundle build
