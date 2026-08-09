# Phase 4.3 — Test, Teacher Copy, Answer Key, and Exports

## Shared document model

Student Copy, Teacher Copy, and Answer Key are projections of one structured assessment export model. They do not maintain separate question sources, and the Answer Key is derived only from stored structured correct answers. No export calls Gemini.

## Student Copy

The printable student document includes the assessment heading and configured teacher/school metadata, learner name and section blanks, instructions, numbered questions, choices, and suitable response spaces. It excludes correct answers, competency/cognitive mappings, AI/review metadata, internal IDs, technical provenance, and GuroDesk branding.

## Teacher Copy and Answer Key

The Teacher Copy may include the correct answer, verified competency, cognitive category, and rationale. The compact Answer Key formats the same stored answers for checking. Both remain plain professional documents without unnecessary AI metadata.

## Output formats and pagination

The built-in workflow supports browser print, PDF, and editable Word (`.docx`) for all three document modes. Long prompts, choices, rationales, and answers flow across pages without clipping or omission. A short multiple-choice block is kept together when practical; genuinely long constructed-response content can continue naturally.

Question content stays in its authored language. Reusable export language preferences control headings and labels only.

## Custom template boundary

Phase 3.7 custom DOCX mapping is safe for scalar lesson-plan fields but does not yet define a reliable repeating-question-block contract. Phase 4.3 therefore ships dependable built-in assessment exports and a stable shared export model, but does not claim exact compatibility with uploaded assessment templates. Repeating-section/table mappings, capacity rules, and round-trip preservation need a separate reviewed phase.

## Validation

Run `npm run validate:phase43`. It verifies copy-mode data separation, structured answer-key derivation, multilingual preservation, long-content pagination helpers, absence of AI calls and branding, and PDF/DOCX/print support.
