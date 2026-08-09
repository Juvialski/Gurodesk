# AI Studio upload checklist — completed through Phase 4.3

This project supports the phone-first **ZIP → AI Studio → GitHub** workflow.

## Upload / merge

Extract the ZIP contents directly into the existing project root. Do **not** create a nested wrapper folder.

## Supabase migrations

Apply every migration in filename order. Production migration order currently ends with:

12. `supabase/migrations/202608080012_phase4_tos_builder.sql`
13. `supabase/migrations/202608080013_phase41_assessment_engine.sql`
14. `supabase/migrations/202608080014_phase42_assessment_ai_audit.sql`

Deploy every Edge Function listed in `supabase/config.toml`, including the authenticated `assessment-question-generator` function. Keep the existing server-only credential encryption and Supabase service-role secrets configured.

## Phone acceptance test

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
12. Finalize a TOS, create an assessment from it, and confirm every item number and mapping is preallocated.
13. Generate one AI suggestion, review and accept it, then save and reopen the assessment.
14. Export Student Copy, Teacher Copy, and Answer Key in PDF and Word, and inspect browser Print preview.
15. Confirm Student Copy contains no answers, curriculum/cognitive metadata, AI metadata, internal IDs, or GuroDesk branding.

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
- AI may author only a candidate question; it cannot alter item number, competency, cognitive category, or finalized TOS allocation
- learner results, grading, item analysis, distractor statistics, analytics, and result-derived remediation remain outside the Phase 4.3 boundary
