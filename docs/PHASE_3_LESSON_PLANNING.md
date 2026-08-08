# Phase 3 — Teacher-led ILAW Lesson Planning

Reviewed: 2026-08-08

## Policy model

Phase 3 is built around DepEd Order No. 016, s. 2026. GuroDesk treats ILAW as the lesson-planning framework:

- **Intentions** — verified learning competency plus teacher-authored learning objectives.
- **Learning Experience** — teacher-selected resources, pre-lesson activity, flow, contextualization, and inclusion supports.
- **Assessing Learning** — teacher-designed formative checks and evidence of learning.
- **Ways Forward** — teacher reflection and next instructional steps.

The app does not impose extra paperwork as required national fields. The UI is a working planner built around the ILAW elements.

## AI guardrail

DO 016 states that AI is auxiliary and that fully AI-generated lesson plans are not allowed. Core instructional decisions remain with the teacher. Therefore Phase 3 deliberately does **not** provide one-click generation of objectives, lesson flow, assessment design, or ways-forward decisions.

AI support is exposed only after a teacher has entered text, for these allowlisted operations:

- refine clarity
- organize teacher-authored text
- grammar/spelling
- formatting
- translation (server support exists; UI language picker is deferred)

The Edge Function rejects unsupported task types and instructs Gemini not to introduce new instructional content.

## Data model

Lesson content is stored in the existing `documents` table using:

- `document_type = 'lesson_plan'`
- structured JSON content with schema version 1
- document versions on each explicit save
- `lesson_plan_competencies` for a verified competency link plus immutable snapshots
- `lesson_plan_ai_events` for server-side AI-support audit events when a saved document ID is available

## Curriculum and calendar handling

The planner keeps these separate:

1. curriculum-guide sequence period (for example Quarter 2)
2. verified instructional pacing / Budget of Work when available
3. school grading term (Term 1–3 for SY 2026–2027)

Phase 3 does not infer Quarter → Term mappings.

## Privacy boundary

Lesson context fields are for class-level planning. The UI explicitly discourages entering learner names, addresses, diagnoses, or other sensitive personal data.

## Demo mode

Demo mode saves plans in localStorage. AI buttons use a clearly labelled local preview transformation and do not pretend that Gemini was called.

## Deferred

- DOCX/PDF export
- collaborative shared lesson plans
- verified Three-Term BoW dataset ingestion
- print templates
- instructional leader coaching workflow
