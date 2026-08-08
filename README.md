# GuroDesk — Phase 3.5 + BYOK AI

GuroDesk is a mobile-friendly web workspace for DepEd teachers. Its core rule is: **verified curriculum/policy data first, teacher-verified real-world context, and AI used to reduce repetitive drafting—not to fabricate official content or classroom facts.**

## Current status

Implemented and retained:

- React + TypeScript + Vite responsive application
- Supabase Auth + strict teacher-owned RLS
- local demo mode for AI Studio preview
- teacher onboarding, profile, school year, and teaching assignments
- verified Curriculum Navigator
- Grade 7 Mathematics MATATAG dataset: 52 verified competencies with source provenance
- curriculum-guide periods separate from school grading terms
- instructional pacing / Budget of Work foundation
- ILAW Lesson Planning workspace aligned to the current lesson-planning architecture
- lesson saving + document versions + verified competency snapshots
- teacher BYOK Gemini support through Supabase Edge Functions
- encrypted per-teacher Gemini credentials; no shared app Gemini key
- Gemini 3.5 Flash-Lite default + Gemini 3.1 Flash-Lite Lite-only fallback, both explicit high thinking
- Gemini 3.6 Flash and Gemini 3.5 Flash remain manually selectable

## Phase 3.5 lesson workflow

Teachers no longer have to start every ILAW field from a blank box.

GuroDesk now offers:

- **Quick Draft** — one Gemini call prepares a coherent set of suggestions for currently empty planning fields
- 3-option suggestions for objectives, openings, lesson flow, contextualization, inclusion supports, formative assessment, evidence of learning, next steps, and extended learning
- teacher selection/editing before suggestions become final instructional text
- Quick Draft review tracking; unreviewed Quick Draft text blocks finalization
- reusable **My teaching setup** defaults for duration, language, class-level context, available technology, preferred approaches, and teacher-listed resources
- class-level privacy warnings
- AI-use declaration and audit events

### Resource accuracy boundary

AI **does not fill the Learning resources or References fields**.

Saved resources in **My teaching setup** are only a reusable library. AI may name a specific book, module, website, material, device, or equipment item only after the teacher adds it to the current lesson and verifies that it is actually being used. Available-technology settings are feasibility context only and never permission for AI to require or name a device. Page numbers and citations are never invented.

Post-lesson reflection also remains teacher-authored because it describes what actually happened; AI may polish that text after the teacher writes it.

## Supabase migration order

1. `202608080001_phase1_foundation.sql`
2. `202608080002_phase2_curriculum_engine.sql`
3. `202608080003_seed_g7_mathematics.sql`
4. `202608080004_phase2_pacing_foundation.sql`
5. `202608080005_phase3_lesson_planning.sql`
6. `202608080006_seed_lesson_planning_policy_metadata.sql`
7. `202608080007_phase3_byok_ai.sql`
8. `202608080008_phase35_lesson_suggestions.sql`

Migration 008 adds `teacher_lesson_preferences` and expands the lesson-AI audit allowlist for suggestion tasks.

The production browser uses only the Supabase project URL and publishable key. Never expose a service-role key or Gemini key in browser variables.

## Gemini BYOK

Each signed-in teacher connects a personal key in **Settings → AI Assistant**. The key is tested, encrypted server-side, and never returned to the browser.

Model behavior:

- `gemini-3.5-flash-lite` — default, explicit high thinking
- `gemini-3.1-flash-lite` — automatic Lite fallback, explicit high thinking
- `gemini-3.6-flash` — manually selectable
- `gemini-3.5-flash` — manually selectable

Automatic fallback never switches into the two limited-call Flash models.

## Validation

```bash
npm run curriculum:validate
npm run validate:phase2
npm run validate:phase3
npm run validate:byok
npm run validate:phase35
npm run typecheck
npm run build
```

The packaging environment may not contain `@supabase/supabase-js`; run the dependency-backed build in AI Studio if the local mirror cannot install it.

See `docs/PHASE_3_LESSON_PLANNING.md`, `docs/PHASE_3_5_LESSON_SUGGESTIONS.md`, `docs/PHASE_3_BYOK_AI.md`, and `CODEX_HANDOVER.md`.
