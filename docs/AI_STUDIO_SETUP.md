# AI Studio upload checklist — Phase 3

This project is designed for the phone-first **ZIP → AI Studio → GitHub** workflow.

## Fast preview without backend credentials

1. Upload/extract the full ZIP into AI Studio Build.
2. Let AI Studio install dependencies and start the app.
3. Choose **Open sample teacher workspace**.
4. Open **Curriculum** → Grade 7 Mathematics.
5. Select a competency and tap **Create lesson plan**.
6. Confirm the selected verified competency appears in the ILAW editor.
7. Fill a section with at least a sentence, then tap an AI-support button. In demo mode it should clearly identify the result as a local demo preview—not a Gemini call.
8. Save the plan and return to **Lesson Plans**. The plan should remain after reload because demo mode uses localStorage.
9. Switch to Grade 8 Mathematics in Curriculum and confirm missing verified coverage is handled safely instead of fabricated.

## Connect Supabase

Apply migrations in exact order:

1. `supabase/migrations/202608080001_phase1_foundation.sql`
2. `supabase/migrations/202608080002_phase2_curriculum_engine.sql`
3. `supabase/migrations/202608080003_seed_g7_mathematics.sql`
4. `supabase/migrations/202608080004_phase2_pacing_foundation.sql`
5. `supabase/migrations/202608080005_phase3_lesson_planning.sql`
6. `supabase/migrations/202608080006_seed_lesson_planning_policy_metadata.sql`

Set `.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Configure Gemini

The Gemini key must stay in Supabase Edge Function secrets:

```bash
supabase secrets set GEMINI_API_KEY=your-key
supabase secrets set GEMINI_MODEL=your-supported-model
supabase functions deploy lesson-ai-support
```

Do not put `GEMINI_API_KEY` in any `VITE_*` variable.

## Live-mode test

After Supabase is connected:

- sign up/sign in
- create/verify teaching assignment
- open Curriculum → select verified competency → Create lesson plan
- save a draft
- reload and reopen it
- type teacher-authored text into one section and use **Clarity**, **Organize**, or **Grammar**
- confirm an AI revision preview appears before applying
- apply it and confirm the AI declaration appears
- check the acknowledgement box before marking the document final
- verify another account cannot access that lesson/document ID

## Do not ask AI Studio to “fix” these intentional constraints

- Do not add a one-click fully AI-generated ILAW lesson.
- Do not let Gemini generate empty objectives, lesson flows, assessment designs, or ways-forward decisions.
- Do not collapse curriculum quarters into school grading terms.
- Do not invent a Budget of Work mapping.
- Do not invent missing DepEd competencies.
- Do not expose Gemini/service-role credentials in browser code.
- Do not remove RLS to make a query work.
