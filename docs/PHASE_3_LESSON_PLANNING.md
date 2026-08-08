# Phase 3 / 3.5 — ILAW Lesson Planning

Reviewed: 2026-08-08

## Planning model

GuroDesk keeps the ILAW planning structure:

- **Intentions** — verified competency plus teacher-approved learning objectives
- **Learning Experience** — resources, pre-lesson activity, lesson flow, contextualization, inclusion supports, and continuity alternatives
- **Assessing Learning** — formative checks and evidence of learning
- **Ways Forward** — reflection, next steps, remediation/enrichment, and extended learning

The app is a working planning assistant, not an assertion that every UI field is a nationally mandated paperwork field.

## AI assistance model

Phase 3.5 intentionally provides more help than the original Phase 3 implementation.

AI may generate **optional starting-point suggestions** grounded in the selected verified competency and teacher-provided context. The teacher chooses, edits, validates, and approves the final instructional text.

Two modes exist:

1. **Field suggestions** — generate 3 alternatives and explicitly choose one.
2. **Quick Draft** — generate a coherent set of suggestions for currently empty planning fields. Existing teacher text is never overwritten. Quick Draft sections are marked pending review until the teacher confirms them.

Text polishing remains available for clarity, organization, grammar, and formatting.

## Fields AI must not fabricate

The following boundaries are intentional:

- **Learning resources** — teacher-entered and teacher-verified only
- **References** — teacher-entered only; no invented titles, page numbers, URLs, or citations
- **Learner context** — teacher-provided class-level information only; AI may polish but does not invent learner facts
- **Reflection** — teacher-authored after instruction; AI may polish but does not invent what happened in class

The Edge Function contains a resource-accuracy rule that prohibits naming a specific resource/device unless the teacher explicitly listed it as available.

## Reusable teaching setup

`teacher_lesson_preferences` stores teacher-owned defaults:

- typical minutes per session
- language preference
- class-level profile
- available technology
- preferred approaches
- actual books/modules/materials used by the teacher
- resource constraints/notes

RLS limits the row to the teacher who owns it.

## Data model

Lesson content remains in `documents.structured_content` with schema version 1 plus backward-compatible Phase 3.5 fields:

- `resourcesVerifiedByTeacher`
- `aiSuggestionReview.pendingSections`
- `aiSuggestionReview.lastQuickDraftAt`

`lesson_plan_ai_events` audits both revision and suggestion operations for saved lesson documents.

## Curriculum/calendar separation

Keep these concepts separate:

1. curriculum-guide sequence period
2. instructional pacing / Budget of Work
3. school grading term

Do not infer a quarter-to-term mapping unless verified pacing data explicitly provides one.

## Privacy

Lesson AI receives class-level planning context only. The UI warns teachers not to enter learner names, diagnoses, addresses, account information, or other sensitive personal data.
