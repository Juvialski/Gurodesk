# GuroDesk handover for Codex / next coding session

## Product objective

GuroDesk is a DepEd-teacher web workspace that reduces repetitive planning, assessment, and paperwork using verified curriculum/policy data plus teacher-controlled AI assistance.

Preferred workflow:

```text
ChatGPT/Codex edits complete project
→ full ZIP
→ AI Studio Build test
→ push to GitHub
→ next phase
```

Avoid manual merging when a complete ZIP is feasible.

## Current state — Phase 3.5 complete

### Foundation

- Vite + React + TypeScript
- responsive phone/desktop UI
- Supabase Auth + demo/localStorage mode
- teacher profile/onboarding/assignments
- strict RLS for teacher-owned data
- generic documents + document versions

### Curriculum engine

- versioned official source architecture
- curriculum applicability by school year / grade
- Curriculum Navigator
- curriculum-guide periods scoped by subject
- grading calendar stored separately
- instructional pacing / Budget of Work layer stored separately
- source provenance + pages
- verified Grade 7 Mathematics dataset: 52 competencies
- no fabricated official content for unloaded subjects

### Lesson planning

- `/lesson-plans`, `/lesson-plans/new`, `/lesson-plans/:id`
- ILAW structured lesson content
- Curriculum → verified competency → lesson handoff
- curriculum period and grading term remain separate
- competency/source/performance-standard grounding
- save draft/final + versioning
- `lesson_plan_competencies` snapshots
- `lesson_plan_ai_events` audit trail

### Phase 3.5 teacher-guided suggestions

- Quick Draft generates a coherent set of suggestions for empty planning fields in one call
- Quick Draft preserves all existing teacher text
- applied Quick Draft fields are marked pending review and block finalization until confirmed
- individual 3-option suggestions for objectives, lesson flow, opening, contextualization, universal inclusion supports, formative assessment, evidence, next steps, continuity, and extension
- text polishing still supports clarity/organization/grammar/formatting
- learner context stays teacher-provided; AI may polish it only
- post-lesson reflection stays teacher-authored; AI may polish it only
- **Learning resources and References are never AI-filled**
- teacher confirms actual lesson resources before finalizing
- reusable `teacher_lesson_preferences` table/UI stores duration, language, class-level profile, available technology, preferred approaches, actual resources, resource notes
- Edge Function resource rule forbids invented books, pages, devices, websites, materials, citations, and local facts

### BYOK AI

- no shared GuroDesk Gemini key
- each teacher connects a personal Google AI Studio key
- key encrypted server-side in `teacher_ai_credentials`
- model settings stored in `teacher_ai_settings`
- credential tables have RLS and no normal browser CRUD policies
- default: `gemini-3.5-flash-lite`, explicit high thinking
- Lite fallback: `gemini-3.1-flash-lite`, explicit high thinking
- `gemini-3.6-flash` and `gemini-3.5-flash` manually selectable
- automatic fallback stays Lite-only

## AI architecture

```text
React
→ authenticated Supabase Edge Function
→ resolve teacher BYOK credential + model preferences
→ competency/resource/privacy grounded prompt
→ Gemini
→ suggestion/revision preview
→ teacher chooses/adapts/approves
```

Suggestion allowlist:

- `suggest_learning_objectives`
- `suggest_home_alternative`
- `suggest_pre_lesson`
- `suggest_lesson_flow`
- `suggest_contextualization`
- `suggest_inclusion`
- `suggest_formative_assessment`
- `suggest_evidence_of_learning`
- `suggest_next_steps`
- `suggest_extended_learning`
- `quick_draft`

Revision allowlist:

- `refine_clarity`
- `organize_text`
- `grammar_spelling`
- `format_text`
- `translate`

Never create `VITE_GEMINI_API_KEY` or expose service-role credentials.

## Migration order

1. `202608080001_phase1_foundation.sql`
2. `202608080002_phase2_curriculum_engine.sql`
3. `202608080003_seed_g7_mathematics.sql`
4. `202608080004_phase2_pacing_foundation.sql`
5. `202608080005_phase3_lesson_planning.sql`
6. `202608080006_seed_lesson_planning_policy_metadata.sql`
7. `202608080007_phase3_byok_ai.sql`
8. `202608080008_phase35_lesson_suggestions.sql`

## Architecture constraints — do not undo

1. Do not fabricate official curriculum/policy content.
2. Only verified competencies are attachable/teacher-visible.
3. Curriculum-guide period ≠ grading term ≠ Budget of Work pacing.
4. Do not infer quarter→term mappings.
5. Do not expose Gemini or service-role secrets client-side.
6. Keep demo mode functional.
7. Keep teacher-owned data behind RLS.
8. Do not weaken RLS to fix UI bugs.
9. Quick Draft must never overwrite existing teacher text.
10. Do not AI-fill specific resources, references, books, page numbers, devices, materials, URLs, or citations.
11. AI may mention a specific resource only when teacher-listed in teaching setup/context.
12. Do not infer sensitive learner facts or diagnoses.
13. Post-lesson reflection describes what actually happened and stays teacher-authored.
14. AI output remains a suggestion/revision until teacher selects or confirms it.
15. Do not use DepEd seal/logo or imply official endorsement.

## Files to read first

- `src/pages/LessonPlanEditorPage.tsx`
- `src/components/AiAssistTextarea.tsx`
- `src/components/TeachingSetupPanel.tsx`
- `src/types/lessonPlan.ts`
- `src/types/teachingSetup.ts`
- `src/lib/lessonPlanValidation.ts`
- `src/lib/lessonPlanFactory.ts`
- `src/lib/repository.ts`
- `supabase/functions/lesson-ai-support/index.ts`
- `supabase/functions/_shared/ai-models.ts`
- `supabase/migrations/202608080008_phase35_lesson_suggestions.sql`
- `docs/PHASE_3_5_LESSON_SUGGESTIONS.md`

## Next recommended phase — Phase 4: TOS + Assessment Engine

Build TOS first, then tests from validated TOS cells.

1. Review current assessment/grading rules (DO 015, s. 2026) in detail.
2. Define policy rules separately from curriculum rules.
3. Add TOS schema/builder: covered competencies, instructional time/weight, cognitive distribution, deterministic item counts, exact-total validation.
4. Add assessment/question-bank schema.
5. Generate items grounded in selected verified competencies + TOS cells.
6. Validate competency, cognitive level, item type, answer-key completeness, and totals.
7. Build student test + answer key/solutions views.
8. Keep AI model selection/BYOK shared with lesson planning.

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

If the packaging environment cannot install `@supabase/supabase-js`, do not remove Supabase. Run the dependency-backed Vite build in AI Studio/public npm.
