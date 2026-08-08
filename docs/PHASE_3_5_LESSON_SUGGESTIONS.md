# Phase 3.5 — Teacher-guided lesson suggestions

## Goal

Reduce the amount of lesson paperwork teachers type from scratch while preserving verified curriculum grounding and teacher control over real classroom facts.

## Quick Draft

A Quick Draft request generates suggestions for:

- lesson title
- learning objectives
- home-based / continuity alternative
- pre-lesson activity
- lesson flow
- integration/contextualization
- universal inclusion supports
- formative assessment
- evidence of learning
- conditional next steps
- extended learning

It never generates:

- learning resources
- references/citations/page numbers
- learner facts
- post-lesson reflection

When applied, Quick Draft fills **empty fields only**. Existing teacher text is preserved. Applied fields are recorded in `aiSuggestionReview.pendingSections`, and finalization is blocked until the teacher confirms review.

## Individual suggestions

Supported suggestion operations:

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

Each returns 3 options. Selecting **Use this** is an explicit teacher selection; the result remains editable.

## Resource hallucination prevention

The server prompt has a CRITICAL resource-accuracy rule:

- the saved resource library is not treated as selected for a lesson
- specific books/modules/websites/apps/devices/equipment/materials are forbidden unless the teacher first adds them to the current lesson and verifies them
- available-technology settings are feasibility context only; they are not permission to name or require a device
- page numbers/citations are never invented
- if no verified lesson resource is listed, suggestions must work without named/special resources
- AI cannot invent local facts or official citations

The actual lesson resource field remains manual and has a teacher verification checkbox.

## BYOK/model behavior

All suggestions use the teacher's encrypted BYOK Gemini credential.

- 3.5 Flash-Lite default, high thinking
- 3.1 Flash-Lite fallback, high thinking
- 3.6 Flash / 3.5 Flash manual selection only
- automatic fallback remains Lite-only
