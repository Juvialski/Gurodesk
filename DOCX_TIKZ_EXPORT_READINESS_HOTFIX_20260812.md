# DOCX / TikZ Export Readiness Hotfix

Date: 2026-08-12

## Production symptom

The assessment preview could visibly show generated diagrams, but Download Word could still fail with:

`One or more TikZ diagrams are not ready for DOCX export yet.`

## Root cause

V2 structured visuals persist both:

- deterministic validated geometry primitives; and
- the app-generated TikZ source compiled from those primitives.

The browser preview already kept the primitive SVG as a fallback while TikZJax rendered. However, export readiness treated every visual containing `tikzCode` as a hard live-TikZ dependency. If even one TikZJax render was slow, failed, or its SVG was rejected by the export sanitizer, the whole DOCX/PDF/print action stayed blocked even though an equivalent validated primitive diagram was already available.

A second consistency bug also existed in the preview state: the iframe was marked `ready` even when the rendered SVG failed the sanitizer and therefore was never inserted into the export cache.

## Fix

### `src/lib/assessmentTikzRenderCache.ts`

- Cache insertion now returns `true/false` and refuses invalid visual/source combinations.
- Structured visuals with a valid primitive fallback are no longer hard-blocking export dependencies.
- Exports still give TikZJax a short grace period so the high-quality cached TikZ result is preferred when available.
- Direct/legacy TikZ visuals with no validated primitives still require a successful sanitized TikZ render and remain protected by the existing timeout/error boundary.

### `src/components/AssessmentTikzDiagram.tsx`

- The preview is marked TikZ-ready only when the rendered SVG actually passes sanitization and is cached.
- If sanitization fails, the deterministic structured fallback remains visible instead of presenting a false ready state.

### `src/lib/assessmentVisualExport.ts`

- DOCX/print SVG export now prefers cached TikZ SVG, then safely falls back to the validated structured primitive SVG.
- PDF now prefers the high-resolution cached TikZ PNG, then draws the validated primitives directly when that cache is unavailable.
- Direct TikZ without primitives still does not silently degrade or disappear.

### Regression coverage

Updated:

- `tests/unit/assessment-visual-reliability-release.test.ts`
- `tests/unit/assessment-visual-export-regressions.test.ts`

Coverage now checks structured TikZ fallback readiness, safe cache rejection, SVG fallback export, and PDF primitive fallback.

## Validation performed in this workspace

Passed:

- TypeScript parser gate across 214 TS/TSX files: 0 syntax errors.
- Transpile diagnostics on all five changed TS/TSX files: 0 errors.
- `node scripts/check-assessment-math-visuals.mjs`
- `node scripts/check-assessment-paper-visual-enrichment.mjs`
- `node scripts/check-assessment-export-qa.mjs`
- `node scripts/check-assessment-generation-v2.mjs`
- `node scripts/check-assessment-generation-stability.mjs`

Not claimed here:

- Full `npm ci`, Vitest, Vite build, or Playwright browser run. The sandbox could not complete dependency installation, so the repository's normal CI should remain the final release gate after upload/push.
