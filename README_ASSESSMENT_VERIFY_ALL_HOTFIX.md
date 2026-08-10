# GuroDesk assessment one-action verification hotfix

Date: 2026-08-10

## Goal
Make assessment approval practical for a full generated test. Teachers should not have to accept, accuracy-check, acknowledge, and lock every item one by one.

## Workflow
The draft footer now exposes one primary action:

`Accept, verify & finalize all`

That explicit teacher action:
- applies any pending AI suggestion for the item;
- runs deterministic structural QA locally;
- accepts and locks every completed item that passes structural QA;
- converts persisted `ai_suggestion` items to `teacher_accepted`, including after refresh when the transient suggestion card is gone;
- acknowledges non-blocking review warnings in the same action;
- saves the approved draft;
- finalizes immediately when no genuine structural blocker remains.

It does **not** issue one Gemini verification request per item. Teacher approval remains the authoritative explicit action.

Genuinely malformed items are not silently approved. Examples include an MCQ with fewer than two choices, a missing correct-choice reference, an incomplete matching map, or a prompt that requires a missing visual. Those items remain unlocked and are shown as a short blocker list.

## Review UI
Repeated final-review messages are grouped. Instead of dozens of identical lines, one message lists the affected item numbers (with long lists compacted).

## Test correction
The Gemini assessment contract test now matches the intentional optional-visual behavior: an undefined/invalid optional provider visual normalizes to `null` instead of failing the entire generated question.

## Database
No migration. Existing migration count remains 26.
