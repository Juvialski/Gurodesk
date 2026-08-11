# Gemini Direct TikZ Hotfix — 2026-08-11

## What changed

New AI-generated assessment diagrams no longer rely on GuroDesk to invent TikZ from a small geometry primitive model.

The live generation path is now:

1. Gemini question call returns the normal structured assessment item and visual-planning metadata only.
2. GuroDesk balances visual candidates across the paper (ordinary optional visuals are capped at roughly 1 per 4 questions).
3. Each selected item gets a separate authenticated `operation: "visual"` Edge Function call.
4. Gemini returns **raw TikZ only** in that separate call. The visual call deliberately does not use Gemini `responseSchema` or JSON MIME mode.
5. GuroDesk validates the raw TikZ against a bounded safe subset. If the first TikZ is invalid, Gemini receives the validator feedback and gets one correction pass; GuroDesk never rewrites the TikZ itself.
6. The browser renders the accepted source inside a sandboxed TikZJax iframe.
7. The exact rendered SVG is cached for Word export; a 4x raster copy is cached for PDF export. Print/PDF/DOCX actions wait for direct TikZ rendering instead of silently exporting missing diagrams.

## Visual balance fix

Provider metadata can no longer mark most of a paper `required` and bypass the normal balance budget. A visual is truly `required` only when the learner prompt explicitly depends on a shown/provided diagram or figure. Otherwise provider `required` metadata is treated as `helpful` and goes through the paper-level optional budget.

For a normal 20-item paper this means up to **5 optional diagram calls**, plus any genuinely required diagram-dependent questions.

## Compatibility and safety

- Previously saved structured/primitive visuals continue to render and export through the legacy compatibility path.
- New AI diagrams use `visual.tikzCode` as the primary source and may have an empty `primitives` array.
- Raw TikZ is bounded in length and blocks packages, libraries, file/network access, macro definitions, loops, low-level PGF commands, shell commands, and HTML/script markup.
- TikZ runs in an iframe with `sandbox="allow-scripts"` and no same-origin permission.
- Learner-visible TikZ node labels are checked against accepted answers before the visual is accepted.

## Deployment

No database migration is required.

This hotfix changes `supabase/functions/assessment-question-generator/index.ts` and shared Edge Function files. With the existing Supabase GitHub production integration enabled for `main`, pushing these files to `main` causes the changed Edge Function to deploy automatically.

The ZIP supplied with this hotfix is a **changed-files overlay**, not a full project replacement. Apply it on top of the current repository state so unrelated newer GuroDesk files are preserved.
