# AI Studio upload checklist — completed through Phase 5.3

This project supports the phone-first **ZIP → AI Studio → GitHub** workflow.

## Upload / merge

Extract the ZIP contents directly into the existing project root. Do **not** create a nested wrapper folder.

## Supabase migrations

Apply every migration in filename order. Production migration order currently ends with:

12. `supabase/migrations/202608080012_phase4_tos_builder.sql`
13. `supabase/migrations/202608080013_phase41_assessment_engine.sql`
14. `supabase/migrations/202608080014_phase42_assessment_ai_audit.sql`
15. `supabase/migrations/202608080015_phase50_results_foundation.sql`
16. `supabase/migrations/202608080016_phase53_remediation.sql`

Deploy every Edge Function listed in `supabase/config.toml`, including the authenticated `assessment-question-generator` and aggregate-only `remediation-suggester` functions. Keep the existing server-only credential encryption and Supabase service-role secrets configured.

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

## Phase 5 phone acceptance

Continue in the same signed-in teacher workspace:

16. Open the teacher-owned assignment/section learner roster; add one learner, edit the display name, deactivate/reactivate it, and confirm no LRN or unrelated personal fields are required.
17. Create a result session only from the finalized assessment owned by that teacher. Confirm the title, administration date, item count, possible points, section, and immutable competency/cognitive/curriculum-period mappings are retained.
18. Encode a small MCQ/True/False assessment in answer-sheet mode, then use item mode for another item. Confirm large tap targets, direct learner/item navigation, draft recovery, and a clear warning that score-only mode cannot produce full item analysis.
19. Test partial answers, omitted answers, short-answer exact/normalized matching where enabled, constructed-response teacher points/feedback, and a 40-learner/50-item class-sized draft. Confirm saving is batched rather than one request per cell.
20. Review deterministic class, learner, item, option, competency, cognitive-category, and curriculum-period analysis. Confirm small classes show insufficient-data states rather than invented correlation precision.
21. Create a remediation plan from neutral signals, change the configurable threshold, select whole-class or selected participants, edit targets/activity/schedule/follow-up/notes, and reload the plan. Archive or delete only where the status permits.
22. If using optional remediation assistance, inspect the teacher-review disclosure. Confirm the request contains only result-session/competency references and allowlisted teacher constraints; no learner name, ID, or raw answer is sent. Never auto-apply the suggestion.
23. Open Results Summary, Item Analysis, Competency Performance, and Remediation Plan previews. Export Print/PDF/DOCX and the combined XLSX; inspect all seven sheets and confirm no branding, prompts, AI metadata, technical IDs, or unintended learner names.

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
- AI may suggest remediation activities only from de-identified aggregates and teacher constraints; deterministic application code remains authoritative for scoring and analysis
- learner names, UUIDs, local references, complete answer sheets, and individual raw response histories never leave the teacher-owned application for Gemini
- custom result/item-analysis XLSX template upload/mapping/storage/fill remains architecture-only; built-in seven-sheet output is the supported path
- live Supabase migration, RLS, Edge Function, and Gemini smoke tests must be completed in staging; this sandbox does not claim those checks

## Release stop boundary

This package stops after Phase 5.3. The next recommendation is **Phase 5.4 Production Acceptance & Deployment Validation**. Do not begin the full grading/class-record system, report-card computation, awards/ranking, student/parent portals, or AI grading without separate explicit authorization.
