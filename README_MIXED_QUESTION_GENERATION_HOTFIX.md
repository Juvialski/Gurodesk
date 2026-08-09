# GuroDesk mixed-question generation hotfix

This hotfix fixes the production failure where a 40-item assessment could keep
existing Multiple Choice questions while every newly attempted non-MCQ item
failed with an Edge Function HTTP 400.

## Root causes fixed

1. Gemini 3.5 Flash-Lite request compatibility
   - The shared Gemini request builder previously inherited explicit sampling
     values such as `temperature` from callers.
   - Current Gemini 3.5 Flash-Lite / Gemini 3.x guidance requires deprecated
     sampling fields to be removed.
   - The shared config now strips `temperature`, `topP` / `top_p`, `topK` /
     `top_k`, and `candidateCount` / `candidate_count` while preserving Lite
     `thinkingLevel: high`.

2. Structured output for every supported assessment type
   - Assessment generation, verification, and repair now request JSON through
     the current GenerateContent `responseFormat` contract.
   - Generation uses a type-specific JSON schema for all 11 supported question
     types rather than relying on a generic MCQ-shaped response.
   - Server validation still checks every returned candidate before it reaches
     the teacher draft.

3. Auto / balanced distribution now means mixed generation
   - Clicking Generate missing in Auto / balanced, Fixed counts, or Percentage
     mode now applies the selected question-type plan to eligible EMPTY slots
     before any AI request is made.
   - Completed, teacher-edited, accepted, and locked questions are never
     overwritten.
   - Distribution fills deficits first. If an old draft already contains 16
     completed MCQs, the remaining empty slots are assigned to the other
     enabled formats instead of generating more MCQs.
   - Manual per item remains fully manual.

4. Failure handling remains quota-conscious
   - The prior resumable/checkpointed generation behavior is preserved.
   - Successful work remains recoverable across refreshes.
   - Generated, processed, failed, cancelled, and remaining counts stay
     separate.
   - A systemic provider/configuration error pauses the batch instead of using
     requests on every remaining item.
   - Edge Function error bodies are surfaced to the UI when available.

## Regression coverage added

- Fresh 40-item Auto/balanced test uses all 11 enabled question types.
- Existing 16 completed MCQs remain untouched and all 24 remaining empty slots
  are assigned to non-MCQ types first.
- Deprecated Gemini sampling fields cannot leak into the shared request config.
- Lite models retain high thinking.
- Valid structured candidates are accepted for all 11 question types.
- A provider request-configuration 400 pauses remaining batch work.
- Existing generation refresh/checkpoint tests are retained.

## No database migration

No schema, RLS, scoring, TOS mapping, learner, results, or remediation migration
is required for this hotfix.

## Expected production retest

After deployment, on the existing assessment that already has 16 MCQs:

1. Keep all desired question types checked.
2. Keep Mode = Auto / balanced.
3. Tap Generate missing.
4. Existing 16 MCQs remain untouched.
5. The 24 empty slots are redistributed across the other enabled question
   types and saved before generation starts.
6. Test one non-MCQ item first if conserving quota is important, then run the
   remaining batch after it succeeds.
