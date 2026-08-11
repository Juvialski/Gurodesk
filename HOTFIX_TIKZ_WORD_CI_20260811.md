# GuroDesk TikZ / Word / CI Hotfix — 2026-08-11

## Scope
Focused hotfix for the uploaded `gurodesk-ci-tikz-visual-balance-hotfix-20260811.zip` source. No database migration was added.

## Fixed

### 1. CI: assessment visual E2E
The preview test still searched for an SVG carrying `assessment-document-question-visual`. After the TikZ-first renderer refactor that class belongs to the TikZ shell and the deterministic SVG is nested underneath it. The E2E now asserts the shell plus the nested `svg.assessment-diagram`, so CI remains independent of the external TikZJax runtime.

### 2. CI: phone Create navigation
The Home page now exposes two links named `Create`. The phone E2E is scoped to the `Primary navigation` landmark to remove the Playwright strict-mode collision.

### 3. Microsoft Word metadata table
The DOCX exporter no longer mixes two-column and three-column rows inside one fixed-layout Word table. Word receives a uniform two-column metadata grid. This prevents the final `Score` field from collapsing into a very narrow vertical cell in desktop Microsoft Word. PDF/browser presentation remains unchanged.

### 4. Missing visuals after question generation
Empty blueprint slots are no longer saved as `none / not_required` visual decisions before a question exists. A visual decision is now made only after the generated question has content.

The paper visual planner now recognizes additional useful geometry relationships including linear pairs and regular/irregular/convex/non-convex polygon work while still avoiding the rule that every polygon mention needs an image.

The visual enrichment pass now uses the resolved balanced paper plan itself, instead of selecting IDs from the balanced plan and then passing older item objects into enrichment. This closes a path where a legacy/saved `none / not_required` state could silently cancel a newly selected optional diagram.

A 20-item geometry-heavy assessment still uses the existing approximately one-in-four optional budget (normally 5 optional diagrams), while required visuals remain outside that optional budget.

If the planner selects visuals but zero requests actually reach visual generation, the run now fails visibly instead of silently reporting a zero-diagram paper as normal. Batch status also reports planned / added / failed counts.

## Production deployment note
The browser visual pass calls `assessment-question-generator` with `operation: "visual"`. If production Supabase still has an older deployed Edge Function, the frontend code alone cannot make the dedicated visual request work. Deploy the `supabase/functions/assessment-question-generator` version included in this ZIP together with the frontend release.

## Validation performed in this workspace
- TypeScript syntax/transpile check on every changed TS/TSX file: PASS.
- `node scripts/check-assessment-math-visuals.mjs`: PASS.
- `node scripts/check-assessment-paper-visual-enrichment.mjs`: PASS.
- Runtime visual-planner smoke check: 20 geometry questions -> optional budget 5 -> 5 selected: PASS.
- Empty pre-generation slot suppression regression smoke check: PASS.
- Actual app-owned TikZ source compiled with local `pdflatex` for all five built-in visual fixtures: PASS.

Full `npm run test:ci` / Playwright could not be executed in this container because package installation was not available completely; GitHub CI should run those with a normal `npm ci` environment.
