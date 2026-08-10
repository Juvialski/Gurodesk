# TikZ-first math visuals + fill-in-the-blank normalization

Date: 2026-08-10

## What changed

### Generated accepted answers
Generated short-answer, identification, and fill-in-the-blank accepted-answer arrays are normalized before the suggestion reaches the teacher. Case-insensitive duplicates and terminal-punctuation-only variants such as `Hexagon`, `hexagon.`, and `HEXAGON!` collapse to the first valid answer when case sensitivity is disabled. Empty answer sets remain invalid.

The visible blank marker (`_____` or `[blank]`) is not treated as an accepted answer and was not the cause of the production error.

### TikZ-first math visuals
GuroDesk now keeps the model at the safe data boundary:

`Gemini -> bounded visual JSON -> server/client validation -> deterministic GuroDesk TikZ -> sandboxed browser TikZ renderer`

Gemini never supplies executable TikZ. Labels are TeX-escaped and the renderer accepts only the existing bounded visual primitive registry.

The previous deterministic React/SVG renderer remains available as loading/offline/export fallback. This preserves existing preview/print/PDF compatibility even when the browser TikZ runtime is unavailable.

### Cartesian graphs
The safe visual data model now contains:

- `cartesianAxes` — bounded plot rectangle, numeric x/y ranges, ticks, optional grid and axis labels.
- `cartesianPlot` — 2–160 sampled numeric coordinate pairs referencing one `cartesianAxes` ID.

There is intentionally no arbitrary formula/code field. The model supplies bounded points; GuroDesk maps those points to TikZ/SVG/PDF itself.

## Regression protection

`scripts/check-assessment-math-visuals.mjs` verifies:

- accepted-answer dedup remains on both client and server boundaries;
- sampled Cartesian primitives remain in the safe DSL;
- no model formula/eval path is introduced;
- TikZ source is generated inside GuroDesk and labels are escaped;
- TikZ compilation remains sandboxed;
- SVG fallback remains available;
- the Gemini prompt explicitly forbids returning TikZ/SVG/HTML/scripts.

No database migration. Existing migration count remains 26.
