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

The absolute implementation boundary after these checks is Phase 4.3. Learner results, grading, item analysis, distractor statistics, learner analytics, and remediation are not part of this release.
