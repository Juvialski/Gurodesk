# GuroDesk — Phase 3 + BYOK AI checkpoint

GuroDesk is a mobile-friendly web workspace for DepEd teachers. It is designed around one rule: **verified curriculum and policy data first; teacher judgment first; AI only where current DepEd rules allow it.**

## Phase 3 status

Implemented and retained:

- React + TypeScript + Vite responsive application
- Supabase Auth + strict teacher-owned RLS
- local demo mode for AI Studio preview without secrets
- teacher onboarding, profile, school year, and teaching assignments
- verified Curriculum Navigator
- Grade 7 Mathematics MATATAG dataset: 52 verified competencies with source provenance
- curriculum-guide periods separate from school grading terms
- instructional pacing / Budget of Work foundation
- **ILAW Lesson Planning workspace aligned to DO 016, s. 2026**
- start a lesson directly from a selected verified competency
- teacher-authored Intentions, Learning Experience, Assessing Learning, and Ways Forward
- ILAW self-check before finalizing
- lesson saving + document versions
- verified competency linkage/snapshots per saved lesson
- AI-use declaration stored in the lesson
- teacher BYOK Gemini support through Supabase Edge Functions
- encrypted per-teacher Gemini API credentials; no shared application Gemini key
- Gemini 3.5 Flash-Lite default + Gemini 3.1 Flash-Lite Lite-only fallback, both explicitly high-thinking
- Gemini 3.6 Flash and Gemini 3.5 Flash remain manually selectable
- server-side allowlist that limits Gemini to text refinement/organization/grammar/formatting/translation
- AI buttons remain disabled until the teacher has authored the section
- AI audit events for saved lesson documents

## Why there is no one-click AI lesson generator

DO 016, s. 2026 states that AI is an auxiliary tool and that fully AI-generated lesson plans are not allowed. Core instructional decisions—including objectives, unpacking competencies, learning experiences/strategies, assessment decisions, and critical learner-response judgments—remain teacher responsibilities.

GuroDesk therefore automates the repetitive structure, curriculum lookup, reuse, validation, saving, and formatting while keeping those decisions teacher-led. Gemini can refine text after the teacher has made the decision.

## Run locally / AI Studio

```bash
npm install
npm run dev
```

With no Supabase variables, choose **Open sample teacher workspace**. Demo data is stored in localStorage.

## Supabase migration order

Apply in order:

1. `202608080001_phase1_foundation.sql`
2. `202608080002_phase2_curriculum_engine.sql`
3. `202608080003_seed_g7_mathematics.sql`
4. `202608080004_phase2_pacing_foundation.sql`
5. `202608080005_phase3_lesson_planning.sql`
6. `202608080006_seed_lesson_planning_policy_metadata.sql`
7. `202608080007_phase3_byok_ai.sql`

Then set browser-safe variables only:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never expose the service-role key or Gemini key in browser variables.

## Gemini BYOK

GuroDesk does **not** use a shared Gemini API key. Each signed-in teacher connects a personal key from **Settings → AI Assistant**. The key is tested, encrypted server-side, and never returned to the browser.

Default model behavior:

- `gemini-3.5-flash-lite` — primary, explicit high thinking
- `gemini-3.1-flash-lite` — recommended automatic Lite fallback, explicit high thinking
- `gemini-3.6-flash` — manually selectable
- `gemini-3.5-flash` — manually selectable

The UI shows the requested free-tier call guides (500/day for the Lite models and 20/day for the two Flash models) but never enforces them; provider responses remain authoritative.

No `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` is required.

See `docs/PHASE_3_BYOK_AI.md`.

## Validation

```bash
npm run curriculum:validate
npm run validate:phase2
npm run validate:phase3
npm run validate:byok
npm run typecheck
npm run build
```

See `docs/AI_STUDIO_SETUP.md`, `docs/PHASE_3_LESSON_PLANNING.md`, and `CODEX_HANDOVER.md`.


## Phase 3.5.2 — first-run Gemini setup

Signed-in Supabase users must connect their own Gemini API key before entering the normal workspace. This prevents AI suggestion actions from appearing broken because no key was configured. Demo mode remains exempt. The API-key field includes a mobile-friendly one-tap clipboard action, explicit paste handling, and show/hide control.

## Phase 3.6 - printable exports

Saved lesson plans can now be previewed and exported as PDF or editable Word `.docx` files. Settings includes reusable paper-size/signatory/export options backed by `teacher_export_preferences`. The default layout is the plain `ILAW Standard` template and is designed to be extended for TOS, assessments, and future school/division-specific layouts.


## Phase 3.6.3 — Filipino and multilingual lessons

Lesson suggestions now explicitly follow the teacher-selected language instead of relying on model inference. `Auto` matches Filipino subjects/lesson text, while teachers may choose English, Filipino, bilingual English + Filipino, or name a local language. Printable PDF/Word/print labels can be English, Filipino, or automatically match the lesson. Export selection changes headings only and never silently translates teacher-authored content.

Migration: `supabase/migrations/202608080010_phase363_multilingual_lesson_support.sql`.

Validation: `npm run validate:phase363`.
