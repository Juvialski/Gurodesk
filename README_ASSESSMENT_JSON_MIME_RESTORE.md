# Assessment generation JSON MIME restore hotfix

Date: 2026-08-10

## Why this exists

A later assessment-provider experiment accidentally reintroduced `generationConfig.responseFormat` for Gemini 3.5 Flash-Lite. That regressed production to the previously confirmed HTTP 400 structured-request configuration failure.

## Restored production boundary

Normal assessment generation and repair now use raw Gemini `v1beta ...:generateContent` with:

- `generationConfig.responseMimeType = "application/json"`
- the existing bounded per-question output-token budget
- `thinkingConfig.thinkingLevel = "HIGH"` for the Lite models
- no `responseFormat`
- no provider `responseSchema` on normal generation/repair

The prompt still specifies the exact wire shape for all 11 question types. `validateAssessmentCandidate()` remains the authoritative strict server-side answer, scoring, resource, immutable-context, and safe-visual validator after JSON parsing.

The explicit verifier operation remains separate and may use its small fixed response schema.

## Regression protection

Tests and the Phase 4.4 static validator now require the MIME-only normal-generation boundary for both Gemini 3.5 Flash-Lite and Gemini 3.1 Flash-Lite. Incoming `responseFormat`/`responseSchema` overrides are stripped from normal question generation.

No database migration. No RLS/scoring/results/curriculum changes.
