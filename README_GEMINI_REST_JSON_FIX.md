# GuroDesk Gemini REST JSON hotfix

Confirmed live error:

`Invalid value at 'generation_config.response_format.text.mime_type'`

The Edge Function calls Gemini through the raw `v1beta ...:generateContent` REST API.
For that request body, JSON mode is configured with
`generationConfig.responseMimeType = "application/json"`.

This hotfix:
- removes the incompatible `responseFormat` object from assessment generation;
- uses `responseMimeType: "application/json"` for generation, fallback, repair, and verification;
- keeps all 11 question-type shapes enforced by the existing prompt and strict
  server-side `validateCandidate()` logic;
- adds no API calls;
- adds no migration and changes no RLS/TOS/scoring/results logic;
- updates the Phase 4.4 static validator so this exact regression is caught in CI.
