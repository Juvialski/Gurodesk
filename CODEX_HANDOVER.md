# GuroDesk handover for Codex / next coding session

## Product objective

GuroDesk is a DepEd-teacher web workspace that reduces repetitive planning, assessment, and paperwork using verified DepEd curriculum/policy data. The user works primarily from a phone and uses this workflow:

```text
ChatGPT/Codex edits complete project
→ full ZIP
→ AI Studio Build test
→ push to GitHub
→ next phase
```

Do not require manual merging when a complete project ZIP is feasible.

---

## Current state — Phase 3 complete + BYOK checkpoint

### Foundation retained

- Vite + React + TypeScript
- responsive phone/desktop UI
- demo/localStorage mode without secrets
- Supabase Auth mode
- teacher profile/onboarding
- teaching assignments
- dashboard/class management
- strict RLS for teacher-owned data
- generic documents + document versions

### Curriculum Engine retained

- versioned official source architecture
- curriculum applicability by school year / grade
- Curriculum Navigator
- curriculum-guide periods scoped by subject
- school grading calendar stored separately
- instructional pacing / Budget of Work layer stored separately
- source provenance + source pages
- first verified full dataset: Grade 7 Mathematics, 52 competencies, four curriculum-guide quarters
- no fabricated content for unloaded subjects

### Phase 3 implemented

- `/lesson-plans` list
- `/lesson-plans/new` ILAW editor
- `/lesson-plans/:id` saved-plan editor
- Curriculum → selected competency → Create lesson plan handoff
- structured `LessonPlanContent` schema v1
- ILAW sections:
  - Intentions
  - Learning Experience
  - Assessing Learning
  - Ways Forward
- curriculum sequence period and grading term shown separately
- verified competency snapshot/source provenance
- performance-standard context when loaded
- class-level learner-context field with privacy warning
- ILAW self-check / readiness score
- save draft + mark final
- version row created per explicit save
- `lesson_plan_competencies` verified competency link
- `lesson_plan_ai_events` audit metadata
- automatic AI-use declaration
- teacher-review acknowledgement required after AI support before self-check passes
- demo-mode local AI-support preview clearly labelled as non-Gemini

### BYOK AI checkpoint

- no shared GuroDesk Gemini API key
- each teacher connects a personal Google AI Studio Gemini key
- API key sent only to authenticated `ai-settings` Edge Function during setup
- AES-GCM encrypted credential stored in `teacher_ai_credentials`
- credential/settings tables have RLS enabled and no browser CRUD policies
- browser receives only masked last-four/verification metadata
- default model: `gemini-3.5-flash-lite` with explicit `thinkingLevel: high`
- Lite fallback: `gemini-3.1-flash-lite` with explicit `thinkingLevel: high`
- `gemini-3.6-flash` and `gemini-3.5-flash` remain manually selectable
- automatic fallback is Lite-only; never auto-consume limited-call Flash models
- quota numbers shown in UI are guidance, not enforced limits


---

## Critical policy finding — do not undo

Detailed review of **DO 016, s. 2026 — Guidelines on Lesson Planning and Learning Design** changed the original product assumption.

The policy says:

- AI must be auxiliary.
- human judgment/pedagogical discretion remain paramount.
- fully AI-generated lesson plans are not allowed.
- AI is prohibited for core instructional decisions such as defining objectives, unpacking competencies, designing the learning experience/instructional strategies, and critical judgments about learner needs.
- after key instructional decisions are made, limited AI can rephrase/organize/refine text.
- guided AI can help with routine technical support such as grammar, clarity, formatting, and translation.

Therefore **do not turn Phase 3 into a one-click AI lesson generator**, even if technically easy. That would undermine the current product's DepEd-aligned positioning.

GuroDesk should reduce workload through:

- verified curriculum lookup
- reuse
- teacher-assignment defaults
- structured ILAW editor
- templating
- validation
- versioning
- AI text assistance only after teacher-authored decisions
- future export/reuse/collaboration

---

## Gemini architecture

Browser never receives Gemini secret.

```text
React
→ supabase.functions.invoke('lesson-ai-support')
→ authenticated Supabase Edge Function
→ allowlisted support task
→ Gemini REST API
→ revision preview
→ teacher explicitly applies revision
```

Server allowlist:

- `refine_clarity`
- `organize_text`
- `grammar_spelling`
- `format_text`
- `translate`

The endpoint rejects short/empty input and prompt-instructs Gemini not to introduce instructional decisions.

Credential/model architecture:

- teacher API key is encrypted per user in `teacher_ai_credentials`
- model preferences are server-managed in `teacher_ai_settings`
- `ai-settings` handles status/test/save/remove/model settings
- `lesson-ai-support` decrypts only for the active authenticated request
- no shared `GEMINI_API_KEY` or `GEMINI_MODEL` is used
- optional server-only `GURODESK_CREDENTIAL_ENCRYPTION_KEY`; service-role-derived material is the zero-config fallback

Never create `VITE_GEMINI_API_KEY`.

---

## Migration order

1. `202608080001_phase1_foundation.sql`
2. `202608080002_phase2_curriculum_engine.sql`
3. `202608080003_seed_g7_mathematics.sql`
4. `202608080004_phase2_pacing_foundation.sql`
5. `202608080005_phase3_lesson_planning.sql`
6. `202608080006_seed_lesson_planning_policy_metadata.sql`
7. `202608080007_phase3_byok_ai.sql`

Phase 3 tables:

- `lesson_plan_competencies`
- `lesson_plan_ai_events`

Lesson body stays in existing `documents.structured_content` to avoid a parallel document model.

---

## Files to read first

- `src/pages/LessonPlanEditorPage.tsx`
- `src/pages/LessonPlansPage.tsx`
- `src/components/AiAssistTextarea.tsx`
- `src/types/lessonPlan.ts`
- `src/lib/lessonPlanValidation.ts`
- `src/lib/lessonPlanFactory.ts`
- `src/lib/repository.ts`
- `src/data/lessonPlanningPolicy.ts`
- `supabase/functions/lesson-ai-support/index.ts`
- `supabase/migrations/202608080005_phase3_lesson_planning.sql`
- `supabase/migrations/202608080007_phase3_byok_ai.sql`
- `supabase/functions/ai-settings/index.ts`
- `src/components/AiSetupPanel.tsx`
- `src/data/aiModels.ts`
- `docs/PHASE_3_LESSON_PLANNING.md`

---

## Architecture constraints

1. No fabricated official curriculum content.
2. Only verified competency rows are teacher-visible/attachable.
3. Curriculum guide period ≠ school grading term ≠ Budget of Work pacing.
4. Do not infer quarter→term mappings.
5. Do not expose teacher Gemini plaintext/ciphertext or service-role secrets client-side.
6. Keep demo mode functional.
7. Keep teacher-owned data behind RLS.
8. Do not weaken RLS to fix UI bugs.
9. AI cannot create empty core ILAW fields.
10. AI output is previewed before teacher applies it.
11. Record AI use and require teacher review acknowledgement.
12. Do not use DepEd seal/logo or imply official endorsement.
13. Avoid learner personally identifying/sensitive information in lesson-plan AI prompts.

---

## Next recommended phase — Phase 4: TOS + Assessment Engine

Build TOS first, then tests from the TOS—not the other way around.

Recommended sequence:

1. Review DO 015, s. 2026 assessment/grading policy in detail.
2. Define assessment-policy rules separately from curriculum rules.
3. Add TOS schema and builder:
   - selected covered competencies
   - instructional time / weighting
   - cognitive-process distribution
   - deterministic item-count calculations
   - exact total validation
4. Add assessment schema/question bank.
5. Generate assessment items only where policy permits and always ground them in selected verified competencies + TOS cells.
6. Validate every generated item against:
   - competency
   - expected cognitive level
   - item type
   - answer-key completeness
   - total count
7. Create student test view + answer key/solutions.
8. Keep exports for later unless print is needed for testing.

Important: the AI constraints for lesson planning do not automatically equal the AI constraints for test-item generation. Review DO 003 + DO 015 before deciding what AI may do in assessment creation.

---

## Later phases

- Phase 5: assessment results + item analysis + remediation reports
- Phase 6: role-aware Paperwork Hub under DO 006, s. 2025/current updates
- Phase 7: DOCX/PDF/XLSX export engine
- Phase 8: admin DepEd source ingestion/review/update tools

---

## Validation commands

```bash
npm run curriculum:validate
npm run validate:phase2
npm run validate:phase3
npm run typecheck
npm run build
```

If the local environment cannot install `@supabase/supabase-js`, do not remove Supabase. AI Studio's normal npm environment should perform the actual dependency-backed Vite build.


## Phase 3.5.2 UX correction

Production users are now gated through `AiSetupRequiredPage` immediately after authentication until `ai-settings` reports a configured Gemini BYOK credential. This occurs before teacher-profile onboarding. Demo mode is exempt. `AiSetupPanel` now supports a mobile clipboard button, explicit `onPaste`, no autocapitalization/autocorrect, and key show/hide. Preserve this behavior.

---

## Phase 3.6 export checkpoint - COMPLETE

Do not remove these files/features:

- `src/types/export.ts`
- `src/lib/lessonPlanExport.ts`
- `src/components/ExportSettingsPanel.tsx`
- `src/components/LessonPlanDocumentView.tsx`
- `src/pages/LessonPlanPrintPreviewPage.tsx`
- `supabase/migrations/202608080009_phase36_export_preferences.sql`
- `docs/PHASE_3_6_EXPORT_ENGINE.md`

Lesson plans now support preview, browser print, PDF download, and Word `.docx` download. Export preferences are reusable and are the foundation for Phase 4 TOS/assessment exports.

The current shipped layout is `gurodesk_ilaw_standard`. It is intentionally a GuroDesk template, not represented as an official DepEd-issued form. Do not add DepEd seals/logos or imply endorsement.

Dependencies added: `docx`, `jspdf`.

Run `npm run validate:phase36` plus all earlier validation scripts. Keep the Phase 3.5.3 in-app mobile competency picker intact.
