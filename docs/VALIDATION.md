# Validation — Phase 2

## Curriculum manifest

Run:

```bash
npm run curriculum:validate
```

Expected Grade 7 Mathematics result:

```text
52 verified competencies, 4 periods, 3 domains
```

The validator checks, among other things:

- manifest is explicitly verified
- source is an HTTPS `deped.gov.ph` URL
- curriculum version exists
- periods are valid and unique
- domains referenced by competencies exist
- every competency has a source page
- competency ordering is contiguous within each period
- duplicate competency rows are rejected
- applicability data is present

## Deterministic SQL generation

Run:

```bash
npm run curriculum:generate:g7math
```

Then compare the generated seed with `supabase/migrations/202608080003_seed_g7_mathematics.sql` before changing the migration. Generated SQL should come from the reviewed manifest, never from manual edits to a production seed.

## Security checks

Review that:

- curriculum-applicability and calendar tables have RLS enabled
- normal authenticated users only receive SELECT policies on official knowledge
- curriculum child records remain hidden when their parent curriculum version is draft
- competency reads require `verification_status = verified`
- teacher-owned data remains scoped by `(select auth.uid())`
- browser environment variables contain no Gemini secret or Supabase service-role key

## UI checks

In demo mode:

1. open the Grade 7 Mathematics assignment
2. verify 52 competencies
3. verify four curriculum-quarter tabs
4. verify Term 1 / Term 2 / Term 3 appears only as school-calendar context
5. search a competency and clear the search
6. switch quarters
7. open the official source link
8. switch to Grade 8 Mathematics and confirm the app shows unavailable coverage instead of invented records
9. repeat at a phone viewport

## Build-environment note

Run `npm install`, `npm run typecheck`, and `npm run build` in the delivery environment. Do not remove Supabase or weaken validation because of a transient package-registry failure; record any genuine environment limitation in the handover instead.

## Phase 3 BYOK checks

Run:

```bash
npm run validate:byok
```

This verifies that:

- migration 007 creates encrypted teacher AI credential/settings tables
- browser clients have no direct credential-table CRUD policies
- `ai-settings` is deployed as an authenticated Edge Function
- no shared `GEMINI_API_KEY` remains in lesson AI
- Gemini 3.5 Flash-Lite and 3.1 Flash-Lite are configured with explicit high thinking
- Gemini 3.6 Flash and 3.5 Flash remain selectable
- automatic fallback is limited to the two Flash-Lite models
- browser code never references service-role secrets or credential ciphertext

## Phase 3.5 lesson-suggestion checks

Run:

```bash
npm run validate:phase35
```

This verifies that:

- migration 008 creates the RLS-protected reusable teaching setup
- Quick Draft and field-level suggestion operations are allowlisted/audited
- Quick Draft fills only empty fields and requires teacher review
- Learning resources and References remain teacher-controlled fields
- the Edge Function contains explicit resource hallucination prevention
- finalization requires teacher resource verification and no pending Quick Draft sections
- BYOK Flash-Lite high-thinking configuration remains intact

## Phase 4 TOS checks

Run:

```bash
npm run validate:phase4
```

This executes deterministic allocation cases for zero, one, and many competencies; totals 37 and 43; decimal weights; exact manual-percentage sums; manual item overrides; stable Hamilton tie-breaking; and gap/overlap-free item placements. It also checks the mobile custom picker architecture, grading-term/curriculum-period separation, Phase 4 migration/RLS/RPC guards, bounded batch curriculum resolution, and lossless height-aware PDF row pagination. Its XLSX tests perform a real OOXML round trip against the checked-in master and verify hashes, formula/merge protection, styles, dimensions, print metadata, freeze panes, recalculation flags, stale mapped-row clearing, duplicate/range preflight, and Strict OOXML rejection.

After it passes, run every older validator plus `npm run build`. Old tests must not be weakened to make Phase 4 pass.

## Phase 4.1 assessment foundation

```bash
npm run validate:phase41
```

Checks finalized-TOS enforcement; exact 1/37/40/43 expansion; multiple competency/category traces; gap, duplicate, and mapping-drift rejection; structured question answers; teacher-review gating; duplication; and the assessment persistence/RLS contract.

## Phase 4.2 AI question generation

```bash
npm run validate:phase42
```

Checks authenticated BYOK-only generation, Lite-only fallback, high thinking, server-loaded immutable mapping, structured JSON parsing, question-type validation, resource-invention guardrails, language transmission, bounded retry/concurrency, cancellation, mapping immutability, and partial batch success.

## Phase 4.3 assessment documents

```bash
npm run validate:phase43
```

Checks that Student Copy is answer/mapping/AI/ID/branding-free, Teacher Copy can include structured answers and optional review context, Answer Key is compact and derived from structured answers, Filipino/authored text is preserved, and long content is not silently omitted. It also verifies the built-in PDF, DOCX, and Print entry points.

The Phase 4.3 boundary above is preserved by the Phase 4.4 and Phase 5 checks below. The current implementation boundary is Phase 5.4; class records, grading sheets, report cards, attendance, and student portals remain out of scope.

## Phase 4.4 assessment types, scoring, and QA

```bash
npm run validate:phase44
```

This runs both the domain/persistence and AI/editor/export gates. It covers all eleven structured question types; disabled-type enforcement; deterministic fixed-count/percentage reconciliation; manual type preservation; independent item/point totals; legacy one-point normalization; target-point reporting; rubric, subpart, fill-blank, and matching point reconciliation; lock/history/edit-recheck behavior; low/high-risk adaptive verification; opposite-Lite selection; targeted repair/retry ceilings; bounded per-model scheduling; partial-batch preservation; final hard/warning review; and structured-answer-only export generation.

## Phase 5.0 learner / results foundation

Run:

```bash
npm run validate:phase50
```

The gate checks:

- empty, one-learner, 40-learner, duplicate-display-name, inactive, and safe-deletion roster cases;
- assignment/section and authenticated-teacher ownership architecture;
- finalized-assessment-only result-session creation and immutable assessment/item/mapping traceability;
- objective and constructed-response outcome shapes, teacher-entered points/feedback, and omitted answers; and
- no unnecessary learner fields and no learner identity in remediation AI context.

## Phase 5.1 results encoding

Run:

```bash
npm run validate:phase51
```

The gate checks answer-sheet, item, and score-only workflows; MCQ, True/False, conservative short-answer, constructed-response, partial-point, and omitted outcomes; raw/possible/percentage totals; import preview/validation boundaries; safe draft state; and batch persistence architecture. Score-only mode must be explicit and must not produce item-analysis rows.

## Phase 5.2 deterministic item analysis

Run:

```bash
npm run validate:phase52
```

The engine is deterministic and must not call AI. Its documented formulas are:

- correctness facility: `correct / attempted`, where `attempted = correct + incorrect`; omitted is reported separately;
- point facility: earned points divided by possible points for applicable answered outcomes;
- option percentage: option count divided by attempted responses for that item;
- binary objective item-rest: Pearson correlation between item score `0/1` and each learner's rest-of-test score (the total excluding that item);
- partial-point item-rest: Pearson correlation between normalized item points and rest-of-test score, labelled as normalized item-rest; and
- correlation availability: `n >= 10` and nonzero variance for both variables, otherwise return an explicit insufficient-data state.

The gate exercises all-correct, all-incorrect, mixed, omitted, variable choice-count, small-class, competency, cognitive-category, and curriculum-period cases. No facility label, discrimination cutoff, or remediation threshold is presented as a DepEd mandate. Those are mathematical measures or teacher-configurable GuroDesk conventions.

## Phase 5.3 remediation and reports

Run:

```bash
npm run validate:phase53
```

The gate checks configurable neutral remediation signals, teacher overrides and participant scope, persisted plan fields, optional aggregate-only AI boundary, and all four report modes. It verifies that PDF/DOCX/Print helpers paginate long tables, that submitted documents contain no GuroDesk branding, prompts, AI metadata, technical audit information, or internal IDs, and that learner names appear only in teacher-authorized result output.

Combined XLSX output is checked for complete deterministic values in these sheets:

`Summary`, `Learner Scores`, `Item Analysis`, `Option Analysis`, `Competency Analysis`, `Cognitive Analysis`, and `Remediation`.

## Privacy, performance, and deployment review

Static review must confirm that no code sends learner names, learner UUIDs, school learner references, full answer sheets, or individual raw response history to Gemini. Supabase tables and result-related exports/templates must be teacher-owned and protected by RLS; security-definer functions must derive ownership from `auth.uid()`, verify related ownership, and set a safe `search_path`.

For a 40-learner × 50-item class, persistence must use local draft state and bounded transactional batch replacement, not an explicit network write loop over cells. Analysis must load bounded session data and avoid N+1 learner/item queries.

## Phase 5.4 results and production acceptance

```bash
npm run validate:phase54
```

The gate covers legacy one-point scoring; multi-point and partial-credit outcomes; objective versus teacher scoring; point-derived totals separate from fully-correct item count; point-weighted competency/cognitive analysis; binary versus normalized multi-point labels; remediation denominators; report/export point fields; migration `019` answer-shape/reference/scoring guards; Render static build/SPA rewrite; and browser-safe environment examples.

After all automated gates pass, the release still requires staging migrations, live cross-teacher RLS isolation, deployed Edge Function/BYOK requests, production Auth redirects, Android route refreshes, and physical export inspection. Follow `PRODUCTION_DEPLOYMENT.md` and `PRODUCTION_SMOKE_TEST.md`.

## Release boundary

Run all earlier Phase 1–4.3 validators before the Phase 5 gates, followed by:

```bash
npm run typecheck
npm run build
```

Do not weaken an earlier validator to make Phase 4.4/5.4 pass. Stop after Phase 5.4; do not begin grading/class-record, report-card, attendance, awards/ranking, portal, or AI-grading work without explicit authorization.
