# Assessment visual split + Word-first stabilization

Date: 2026-08-10

## Scope

This checkpoint stabilizes the existing assessment workflow without adding a database migration. It preserves the finalized-TOS allocation authority, all 11 question types, scoring/results compatibility, Phase 6 curricula, BYOK model policy, and the safe app-owned TikZ/SVG renderer.

## Implemented

- Fixed the two confirmed GitHub CI regressions: the auto-prepare mock literal type and the hidden Source TOS Playwright locator.
- Enforced contiguous grouped question-type sections for automatic distribution modes at finalization.
- Split assessment generation into a question request and an optional dedicated visual request; a validated question is written to the resumable local generation checkpoint before the visual request begins.
- Kept Gemini at the bounded `AssessmentVisual` JSON boundary; executable TikZ/SVG/HTML/code remains forbidden.
- Added visual-only bounded repair so a broken diagram never rewrites a valid question/answer.
- Preserved successful questions and paused batch work when a later visual/verifier call hits a provider boundary.
- Made Word `.docx` the primary assessment download and rebuilt its layout with native editable Word structures.
- Embedded valid deterministic assessment SVG diagrams in Word with a PNG compatibility fallback.
- Derived Student Copy visual accessibility text from deterministic observable geometry rather than stored/model alt text, and added final QA that blocks learner-facing visual labels or accessibility text that reveal accepted answers.
- Added/updated static and unit regression coverage for these invariants.

## Deployment

No migration. Keep migrations 001–026 unchanged. Redeploy `assessment-question-generator` from this same source revision because it now handles the separate `visual` operation. Frontend-only deployment is insufficient for live visual generation.

## Validation in this workspace

Final sweep: 26 dependency-free `check-*.mjs` validators passed, 4 retained validators could not start only because this execution environment lacks `pizzip`/`esbuild`, and 0 validators failed. Global TypeScript `transpileModule` parsed all 21 modified/targeted TS/TSX files with zero syntax diagnostics, and `git diff --check` passed. The package mirror prevents `npm ci` by returning HTTP 404 for `yallist@3.1.1`, so project dependency-based TypeScript/Vitest/build/Playwright execution cannot be claimed locally; GitHub Actions remains authoritative after import.
