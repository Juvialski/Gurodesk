# Phase 4.1 — Assessment Engine Foundation

## Boundary

Phase 4.1 turns a **finalized** Table of Specifications into a structured assessment draft. It does not encode learner results, calculate grades, perform item analysis, or recommend remediation.

## Source contract

- A new assessment must reference a teacher-owned `documents` row whose type is `tos` and whose status is `final` at creation.
- The assessment stores the source TOS ID, final version number, and an immutable source snapshot.
- In Supabase mode the server retains the raw TOS JSON for provenance and derives a canonical snapshot from the finalized relational TOS rows. This preserves Phase 3.5.1 fallback IDs while ensuring persisted assessment items use verified production competency UUIDs.
- Assignment, grade, learning area, school year, grading term, curriculum periods, competency identity/text, cognitive category, and total-item metadata are copied from that source.
- Editing or duplicating another TOS cannot silently change an existing assessment.

## Deterministic blueprint

The application expands the finalized TOS ranges into exactly one slot for every integer item number from `1` through `N`. Each slot permanently carries its source TOS row, verified competency snapshot, and cognitive-category snapshot. The blueprint rejects missing, duplicate, overlapping, out-of-order, or unmapped numbers.

Gemini is never asked to choose item numbers, competencies, cognitive categories, or allocation totals.

## Structured item model

Each item has a stable ID, item number, immutable mapping snapshots, question type, prompt, points, optional rationale and teacher notes, and a typed answer structure. Supported initial types are:

- multiple choice — stable choices plus the ID of one existing correct choice;
- true/false — a boolean answer;
- short answer — one or more accepted answers; and
- constructed response — an expected/sample response with optional rubric guidance.

Content state distinguishes `empty`, `ai_suggestion`, `teacher_accepted`, `teacher_edited`, and `manual`. Printable documents do not expose this metadata.

## Validation and persistence

Drafts may remain incomplete. Finalization requires the exact source blueprint, item numbers `1..N`, complete prompts, positive points, teacher-accepted/edited/manual authorship state, and valid type-specific answer structures. An unaccepted AI suggestion cannot be finalized. Multiple-choice choices must be nonblank and unique, and the correct choice ID must exist. The supported two-to-six-choice range is a GuroDesk safety/good-practice boundary, not represented as a nationwide DepEd mandate.

Demo mode persists the same structured model in local storage. Production uses teacher-owned relational projections, immutable source/version records, strict RLS, atomic draft/final saves, and immutable version history. Final assessments can be archived or duplicated into a new draft; they cannot be edited in place or hard-deleted.

## Validation

Run `npm run validate:phase41`. It covers totals of 1, 37, 40, and 43; multiple competencies and cognitive categories; exact numbering and traceability; final-TOS enforcement; and adversarial answer validation.
