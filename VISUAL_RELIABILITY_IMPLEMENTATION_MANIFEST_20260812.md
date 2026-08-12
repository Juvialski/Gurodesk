# GuroDesk Visual Reliability Release — Implementation Manifest

Date: 2026-08-12

## Release boundary

This is a focused visual reliability, TikZ quality, persistence, and export hardening checkpoint. It does not begin another GuroDesk product phase. Existing Phase 1–6 workflows, TOS mapping, scoring/results/remediation, curriculum data, Gemini BYOK, raw JSON question generation, all eleven question types, and teacher finalization boundaries are preserved.

## Implemented

### 1. Automatic visual selection

- Added assessment setting `visualPolicy`: `off`, `balanced` (default), or `more_visuals` inside existing structured settings; no settings migration is required.
- Automatic visual reservation is gated by verified Mathematics learning area and conservative diagram-dependent competency patterns.
- English/language terms such as reflection and translation no longer trigger mathematical visuals.
- Definition-style Mathematics stems such as “What is a circle?” remain text-only.
- Explicit teacher/manual visuals and learner prompts that genuinely depend on a diagram remain preserved in any subject, including when automatic visuals are Off.
- Balanced automatic budget uses floor(itemCount / 4): 1→0, 2→0, 3→0, 5→1, 10→2, 20→5, 40→10.
- Selected automatic visuals are distributed around evenly spaced paper positions and diversified by competency instead of taking the first eligible items.
- Finalized/archived records are returned unchanged and are never re-planned on reopen/navigation.

### 2. Finished TikZ verification boundary

- The assessment visual Edge operation now verifies the actual generated TikZ after TikZ safety validation.
- Finished verification is checked against the learner prompt, structured answer, visual intent, and immutable competency/cognitive/question mapping.
- The verifier contract checks shape/count correctness, labels, stated values, required relationships, graph facts, essential diagram-only givens, and answer leakage.
- The opposite Lite model is used for the independent verification boundary.
- At most one finished-diagram semantic correction is allowed. The question, answer, mapping, and visual intent remain immutable during that repair.
- Required visual failure remains a blocker; optional visual failure preserves the underlying question through the existing batch policy.
- Provider/quota/transport errors continue to bubble to the existing resumable pause boundary.

### 3. TikZ answer-leak detection and safety

- Replaced fragile node-label regex extraction with bounded brace-aware parsing for learner-visible TikZ node bodies.
- Normalizes harmless nested TeX formatting, including text/font wrappers and fractions, before semantic answer comparison.
- Client and Edge boundaries now apply the same learner-visible answer-label rule to identification, short answer, fill in the blank, multiple choice, multiple select, numerical answer, and problem solving.
- Drawing coordinates are not treated as learner-visible labels; a numerical unit alone is not treated as the final answer.
- TikZ validation now uses a bounded allowlist-oriented subset with source, command, node, path, coordinate, nesting, option, and path-complexity limits. Unknown environments/macros/loops/package loading/file-network access/external images/URLs/low-level PGF/browser markup are rejected.

### 4. SVG/render/export hardening

- Rendered TikZ SVG is accepted only after DOM-based element/attribute/style allowlist sanitization.
- Scripts, event handlers, `foreignObject`, external references, remote URLs/fonts/images, CSS imports, unsafe data URLs, unsupported namespaces/elements, and processing instructions are rejected.
- The sandboxed iframe remains `sandbox="allow-scripts"` without `allow-same-origin` and has a restrictive renderer document CSP.
- Rendering remains bounded by the existing timeout/stability window, with the deterministic fallback kept visible until stable TikZ is ready.
- Target-specific readiness is enforced:
  - Print: sanitized stable SVG.
  - DOCX: sanitized stable SVG; DOCX embeds SVG with PNG compatibility fallback.
  - PDF: high-resolution cached PNG.
- Browser printing now hides the live iframe and prints only the sanitized cached SVG for direct TikZ.

### 5. Teacher review

- Added a compact visual-review gallery before finalization in Simple and Advanced assessment review surfaces, with direct item navigation.

### 6. Persistence and concurrency

- Added migration `202608120027_visual_checkpoint_concurrency_guard.sql`.
- Added narrow authenticated RPC `save_assessment_item_visual_checkpoint(...)` for generated visual checkpoints.
- The RPC:
  - permits only the owning authenticated teacher;
  - permits draft assessment documents only;
  - rejects locked items;
  - compares current question type, prompt, and base answer to the expected source before writing;
  - updates only reserved `_visual` / `_visualPlan` answer keys;
  - rebuilds only the structured-content item mirror from current relational rows, preserving newer title/settings/teacher edits;
  - prevents a delayed/stale visual checkpoint from overwriting newer question/answer changes.
- Visual enrichment persists every completed visual result before the next provider request.
- Migration harness expectation is updated from 26 to 27 migrations and fresh/upgrade assertions require the new RPC.

### 7. Repository packaging

- Restored `.github/workflows/ci.yml` and `.gitignore` from current `Juvialski/Gurodesk` GitHub files without replacing newer source code.
- Local Git-blob hashes match the GitHub blob SHAs:
  - `.github/workflows/ci.yml`: `8c7368998175dc74a70ab9f02c1fea35c648d758`
  - `.gitignore`: `cfe931f770c8d4e0d5749fd4624464f27378d3a4`

## Added/updated regression coverage

- Balanced budgets for 1, 2, 3, 5, 10, 20, 40 items.
- Mathematics diagram-dependent competency, English reflection, language translation, and bare geometry-definition cases.
- Off/Balanced/More visuals, paper distribution, manual visual preservation, final/archived immutability.
- Nested/plain/math-mode/Unicode/case/punctuation/multiword TikZ labels and answer leaks across supported concise answer types.
- TikZ allowlist rejection and DOM SVG sanitizer rejection cases.
- Finished visual verifier fixtures for wrong side count, wrong angle/value, missing label, relationship error, wrong graph fact, missing diagram-only given, answer leak, correct diagram, and malformed verifier response.
- Visual persistence/concurrency integration path, duplicate mirror synchronization, stale source rejection, and preservation of earlier successful visuals after later failure.
- Print/DOCX SVG readiness versus PDF PNG readiness.

## Deployment

1. Apply all migrations through `202608120027_visual_checkpoint_concurrency_guard.sql` to the target Supabase project using the normal migration pipeline.
2. Deploy `supabase/functions/assessment-question-generator` together with the changed `_shared` modules from this exact source tree.
3. Deploy the frontend from the same release tree.
4. Run the full CI/local-Supabase/browser/export matrix in an environment with npm registry access, Deno, PostgreSQL client/Supabase CLI, and Playwright dependencies before production promotion.

No new production secret or Gemini-key architecture is introduced.

## Important unresolved P0 item

**The runtime TikZJax CDN dependency is not removed in this checkpoint.** The uploaded source did not contain the licensed TikZJax runtime binary/font assets, and this execution environment could not materialize those binary assets from the pinned upstream source. Placeholder or unverified runtime files were deliberately not added. `AssessmentTikzDiagram.tsx` therefore still references `https://tikzjax.com/v1/tikzjax.js` and `https://tikzjax.com/v1/fonts.css` at runtime.

Before calling this release fully offline-hardened, vendor a licensed, commit-pinned TikZJax distribution (runtime JavaScript, WebAssembly/core assets, and required fonts) under the app's own static assets, update the iframe CSP/paths to same-origin local files, record upstream license/commit/hash metadata, and rerun the complete visual fixture/export matrix.

## Prioritized remaining limitations

1. **P0 — Local TikZJax runtime still missing.** Runtime CDN references remain and offline/blocked-school rendering is not yet guaranteed.
2. **P0 validation gate — full clean CI/database/browser/export matrix not executed here.** Production promotion must wait for the exact skipped checks in `VISUAL_RELIABILITY_VALIDATION_REPORT_20260812.md`.
3. **Rendered-fixture compatibility needs inspection after local vendoring.** The stricter SVG/TikZ allowlists should be exercised against all required real TikZ fixtures (regular/irregular/convex/concave polygons, angles, equal-side/parallel/perpendicular marks, Cartesian graph, fraction/algebra labels, multiple diagrams, phone, print, PDF, DOCX) before release sign-off.
