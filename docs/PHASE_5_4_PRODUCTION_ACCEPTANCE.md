# Phase 5.4 — results compatibility and production acceptance

Phase 5.4 updates the existing roster/results/analysis/remediation pipeline for multi-point assessments and prepares the current product for a controlled production deployment. It adds no new major teacher workflow.

## Results scoring

Every result item retains immutable `pointsPossible`; every outcome records bounded `earnedPoints`. Objective types use deterministic structured-answer scoring where safe. Fill and Matching can award deterministic component credit; Multiple Select is all-or-nothing. Problem Solving, Constructed Response, Essay, and manual-mode Short Answer remain teacher-scored. The database rejects values outside `0..pointsPossible` and recomputes objective results from the immutable session snapshot.

The learner’s main score is the sum of points earned divided by the assessment point sum. Fully-correct items remain a separate count. Missing points on legacy snapshots fall back to the legacy `points` mirror and then one point.

## Analysis and remediation

Binary one-point objective items retain clearly labelled correctness facility. Multi-point items expose mean earned/possible points and normalized point achievement; they are not flattened into a binary-only claim. Competency and cognitive summaries expose item counts and point-weighted performance separately.

New remediation signals default to point facility. Saved Phase 5.3 plans using percentage correct remain readable and retain their original basis. The optional remediation function server-loads the teacher-owned result, reduces bounded pages to aggregate counts/point sums, discards raw answers before prompt construction, and never sends learner names, IDs, raw responses, or per-learner scores to Gemini.

## Production architecture

- Frontend: Vite static build on Render (`npm ci && npm run build`, publish `dist`).
- Routing: `render.yaml` rewrites `/*` to `/index.html` so nested React routes survive refresh.
- Backend: Supabase Auth, Postgres/RLS, private Storage, migrations, and authenticated Edge Functions.
- AI: teacher BYOK through authenticated Supabase functions; no Gemini key or privileged Supabase value is exposed as `VITE_*`.

Migration `019` is additive/corrective. It preserves Phase 5 tables and select-only owner RLS, bounds typed learner payloads, validates answer references against immutable snapshots, recomputes objective scores, and restricts internal helper execution. Security-definer functions use a fixed empty search path and derive ownership from `auth.uid()`.

## Acceptance boundary

Local gates cover TypeScript, production build, historical validators, export contracts, SPA configuration, source-level secret scanning, and static RLS/RPC review. The release still requires staging application of migrations `017`–`019`, two-account adversarial RLS tests, deployed Edge/BYOK calls, Render route-refresh checks, and physical Android/export visual acceptance. See `PRODUCTION_DEPLOYMENT.md` and `PRODUCTION_SMOKE_TEST.md`.

Phase 5.4 stops before class records, grading sheets, report cards, attendance, student portals, or another major document/workflow domain.

