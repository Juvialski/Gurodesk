# Word + TikZ visual + CI hotfix

Date: 2026-08-11

This hotfix addresses the production/export issues observed in the latest Test 4 run without making diagrams mandatory for every assessment item.

## Fixed

- **Word metadata table:** DOCX no longer mixes two-column rows with a three-column `Items / Total Points / Score` row. Word now receives one stable two-column fixed-layout table, so the Score field cannot collapse into a narrow vertical column. PDF/browser presentation remains unchanged.
- **Missing generated visuals:** empty assessment blueprint slots no longer persist a `none/not_required` visual decision before the question exists. Visual suppression is now source-hash-bound, so a newly generated or edited geometry question is reconsidered correctly.
- **Balanced visual selection:** the optional visual budget remains approximately one diagram per four non-empty questions. The heuristic was expanded for linear-pair and polygon-classification topics while plain questions such as “What is a polygon?” remain text-only.
- **Visual enrichment handoff:** the dedicated visual pass now receives the resolved balanced item plan rather than stale pre-balance item objects, and reports `planned / added / failed` counts.
- **Assessment export E2E:** the test now targets the TikZ shell plus its always-mounted deterministic SVG fallback, rather than an obsolete class combination.
- **Phone E2E:** the `Create` click is scoped to Primary navigation so the new Home CTA no longer causes Playwright strict-mode ambiguity.

## Validation performed in this handoff

- `node scripts/check-assessment-math-visuals.mjs` — PASS
- `node scripts/check-assessment-paper-visual-enrichment.mjs` — PASS
- `node scripts/check-e2e-stability.mjs` — PASS
- TypeScript syntax transpile checks on every changed TS/TSX file — PASS
- Targeted TypeScript typecheck for the visual planner/types — PASS
- Direct planner smoke test: a 20-item geometry-heavy paper selects 5 optional visuals, while empty slots carry no premature visual suppression — PASS

Full `npm`/Playwright execution could not be run in this container because package installation is unavailable here. GitHub CI remains the authoritative full dependency + browser run after upload.

## Deployment note

The `assessment-question-generator` Supabase Edge Function must be deployed from the same revision as the frontend for real AI visual generation. A frontend-only Render deploy cannot update that function.
