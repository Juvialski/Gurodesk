# GuroDesk — Phase 4.3 Assessment Workflow

GuroDesk is a mobile-first workspace for DepEd teachers. Its operating rule is: **verified curriculum and policy data first, teacher judgment first, and AI only inside an explicit teacher-review workflow.**

## Current implementation

Phases 1–4 are preserved. The current release adds the authorized Phase 4 hotfixes and Phases 4.1–4.3:

- batched, verified TOS curriculum resolution without per-competency Supabase lookups;
- lossless, height-aware pagination for long TOS competency text and notes;
- assessment creation only from a finalized, teacher-owned TOS;
- one deterministic assessment slot for every TOS item number `1..N`;
- immutable competency and cognitive-category mappings with one canonical source snapshot;
- structured Multiple Choice, True/False, Short Answer, and Constructed Response data;
- mobile item navigator, Previous/Next controls, direct number navigation, mapping badges, and completion state;
- draft, reopen, edit, duplicate, finalize, archive, and local demo persistence;
- authenticated Gemini BYOK question suggestions on top of immutable slots;
- teacher-controlled Generate, Alternative, Regenerate, Accept, and manual-edit flows;
- bounded, cancellable Generate Missing Items with finite retry/backoff and partial-success preservation; and
- Student Copy, Teacher Copy, and deterministic Answer Key output through browser Print, PDF, and editable Word `.docx`.

This release **stops after Phase 4.3**. It does not encode learner results, calculate grades, perform item analysis, calculate distractor statistics, produce learner analytics, or generate remediation recommendations.

See:

- `docs/PHASE_4_TOS_BUILDER.md`
- `docs/PHASE_4_1_ASSESSMENT_ENGINE.md`
- `docs/PHASE_4_2_AI_QUESTION_GENERATION.md`
- `docs/PHASE_4_3_ASSESSMENT_EXPORTS.md`
- `CODEX_HANDOVER.md`

## Assessment architecture

The finalized TOS—not Gemini—is the allocation authority. Application and database validation preserve item number, verified competency, cognitive category, allocation range, curriculum identity, source TOS ID, and source version. AI receives one already-mapped slot and may return only a structured candidate question. A candidate remains separate until the teacher accepts or manually edits it.

Correct answers are stored as typed data. Student output is built from an answer-free export model; teacher and answer-key output use the saved structured answer and never ask AI to reconstruct it.

Phase 3.7 custom lesson DOCX templates and Phase 4 custom TOS XLSX templates remain intact. Built-in assessment exports are complete. Exact repeating-block support for arbitrary custom assessment DOCX masters is deliberately deferred; the shared assessment export model is the safe extension point.

## Policy boundary

Assessment-design decisions were reviewed against DepEd Order No. 015, s. 2026. GuroDesk distinguishes official requirements from product good practice and school/division conventions in `docs/DEPED_SOURCE_REGISTER.md`. AI supports drafting only; it does not alter curriculum allocation, replace professional judgment, determine grades, or receive learner personally identifiable information.

## Run locally / AI Studio

```bash
npm install
npm run dev
```

Without Supabase browser variables, choose **Open sample teacher workspace**. Demo records are stored in localStorage and use a clearly labelled non-Gemini sample generator.

## Supabase migration order

Apply in order:

1. `202608080001_phase1_foundation.sql`
2. `202608080002_phase2_curriculum_engine.sql`
3. `202608080003_seed_g7_mathematics.sql`
4. `202608080004_phase2_pacing_foundation.sql`
5. `202608080005_phase3_lesson_planning.sql`
6. `202608080006_seed_lesson_planning_policy_metadata.sql`
7. `202608080007_phase3_byok_ai.sql`
8. `202608080008_phase35_lesson_suggestions.sql`
9. `202608080009_phase36_export_preferences.sql`
10. `202608080010_phase363_multilingual_lesson_support.sql`
11. `202608080011_phase37_custom_document_templates.sql`
12. `202608080012_phase4_tos_builder.sql`
13. `202608080013_phase41_assessment_engine.sql`
14. `202608080014_phase42_assessment_ai_audit.sql`

Deploy all functions listed in `supabase/config.toml`, including `assessment-question-generator`.

Set browser-safe variables only:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never expose a service-role key, credential-encryption material, or Gemini API key in browser variables.

## Gemini BYOK

Each signed-in teacher connects a personal key through **Settings → AI Assistant**. The encrypted credential is decrypted only inside authenticated Edge Functions and never returned to the browser.

- Primary: `gemini-3.5-flash-lite`, high thinking
- Automatic fallback: `gemini-3.1-flash-lite`, high thinking
- Automatic fallback remains Lite-only
- Flash models remain manual selections and are not automatically consumed
- Provider quota guidance is descriptive, never a hard-coded guarantee

No `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` is required.

## Validation

```bash
npm run curriculum:validate
npm run validate:phase2
npm run validate:phase3
npm run validate:byok
npm run validate:phase35
npm run validate:phase351
npm run validate:phase352
npm run validate:phase353
npm run validate:phase36
npm run validate:phase361
npm run validate:phase362
npm run validate:phase363
npm run validate:phase37
npm run validate:phase4
npm run validate:phase41
npm run validate:phase42
npm run validate:phase43
npm run typecheck
npm run build
```

Old validators remain part of the release gate and must not be weakened to make new work pass.
