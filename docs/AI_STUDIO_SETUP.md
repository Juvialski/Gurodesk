# AI Studio upload checklist — Phase 3.5 + BYOK AI

This project supports the phone-first **ZIP → AI Studio → GitHub** workflow.

## Upload / merge

Extract the ZIP contents directly into the existing project root. Do **not** create a nested `gurodesk-phase35/` folder.

## Supabase migrations

Production migration order now ends with:

7. `supabase/migrations/202608080007_phase3_byok_ai.sql`
8. `supabase/migrations/202608080008_phase35_lesson_suggestions.sql`

If GitHub production integration is enabled, pushing migration 008 to `main` should apply it automatically.

## Phase 3.5 test

After signing in:

1. Open **Settings → My teaching setup**.
2. Save a class-level profile, available technology, preferred approach, and one or two resources you actually use.
3. Confirm **AI Assistant** has the teacher's Gemini key connected.
4. Open Curriculum → Grade 7 Mathematics → choose a verified competency → Create lesson plan.
5. Tap **Prepare suggestions** under Quick Draft.
6. Confirm the preview contains planning suggestions but **no generated reference list or resource list**.
7. Apply it and confirm only empty fields are populated.
8. Confirm Quick Draft fields are marked for review and the plan cannot be finalized until review is acknowledged.
9. Use an individual **Suggest 3** action and choose one option.
10. In Learning resources, use only teacher-entered/saved resources and check the verification box.
11. Save, reload, and confirm persistence.

## BYOK

There is no shared application Gemini key. Each teacher connects a personal Google AI Studio key under Settings → AI Assistant. Do not put teacher keys in GitHub, `localStorage`, or any `VITE_*` variable.

## Intentional constraints

Do not let AI Studio remove these:

- verified curriculum remains the grounding source
- curriculum periods, grading terms, and pacing remain separate
- Quick Draft never overwrites existing teacher text
- specific resources/references remain teacher-entered and verified
- post-lesson reflection is not AI-generated
- learner context is class-level and teacher-provided
- BYOK credentials remain server-side/encrypted
- RLS must not be weakened to fix UI problems
