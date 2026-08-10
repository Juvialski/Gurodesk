# Assessment accept/export reliability hotfix

Date: 2026-08-10

This hotfix follows the CI-green Phase 6 universal-curriculum + TikZ visual checkpoint.

## Fixed

- Print/export assessment documents now render their persisted structured visuals with the deterministic inline SVG renderer. TikZ remains the editor-first presentation renderer, while print/PDF/export no longer depends on an iframe compiler. This restores the Chromium E2E contract for `.assessment-document-question-visual` and keeps offline/export geometry deterministic.
- An invalid optional Gemini visual no longer discards an otherwise valid generated question. The invalid visual is dropped before rendering. If the prompt explicitly depends on a missing visual, deterministic QA marks that item `needs_review` so it cannot enter the bulk-ready approval set.
- Accepting an individual AI suggestion is now one action: **Accept & lock**.
- Batch-generated suggestions expose **Accept ready & lock (N)**. One explicit teacher action accepts, locks, and saves only suggestions that passed deterministic QA and were not flagged `needs_review`/`repair_needed`/`answer_needs_recheck`.
- Flagged items remain available for individual teacher review. No AI suggestion is silently approved merely because it was generated.
- The redundant `Lock accepted item` second step was removed from AI suggestion review. Manual/teacher-authored items can still be locked explicitly, and accepted items can be unlocked when the teacher wants to edit them.

## Unchanged boundaries

- TOS mapping, points, curriculum provenance, assessment immutability, RLS, Gemini BYOK, and migrations are unchanged.
- Migration count remains 26.
- Gemini never supplies executable TikZ/SVG/HTML. The safe structured visual DSL remains authoritative.
