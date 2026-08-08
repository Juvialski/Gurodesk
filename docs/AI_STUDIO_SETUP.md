# AI Studio upload checklist — Phase 2

This repository is designed for the phone-first ZIP → AI Studio → GitHub workflow.

## Fast preview with no backend credentials

1. Upload/extract the full ZIP as the AI Studio project.
2. Let AI Studio install dependencies.
3. Start the app.
4. Choose **Open sample teacher workspace**.
5. Open **Curriculum**.
6. The sample Grade 7 Mathematics assignment should show 52 verified competencies across Quarter 1 to Quarter 4.
7. Switch to the sample Grade 8 Mathematics assignment to confirm the app safely shows "verified curriculum not loaded yet" rather than inventing content.

## Connect Supabase

Create a Supabase project and apply these files **in order**:

1. `supabase/migrations/202608080001_phase1_foundation.sql`
2. `supabase/migrations/202608080002_phase2_curriculum_engine.sql`
3. `supabase/migrations/202608080003_seed_g7_mathematics.sql`
4. `supabase/migrations/202608080004_phase2_pacing_foundation.sql`

The third migration is generated from the verified JSON manifest and loads the first production curriculum dataset.

Then create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart the app after adding environment variables.

## Gemini

Do not add a Gemini secret to `.env.local` with a `VITE_` prefix. The browser must never receive it.

When Phase 3 begins, configure the server-side secret using Supabase secrets:

```bash
supabase secrets set GEMINI_API_KEY=your-secret
```

## Before pushing to GitHub

- test demo Curriculum Navigator on a phone viewport
- test onboarding once
- if Supabase is connected, test sign-up/sign-in and the Curriculum page
- commit source files and migrations
- do not commit `.env.local` or `node_modules`

## Do not ask AI Studio to do these things

- invent missing DepEd competencies
- convert all curriculum quarters into school-calendar terms
- expose the Gemini API key client-side
- bypass RLS with a service-role key in browser code
- rewrite the verified curriculum manifest just to make UI copy look different
