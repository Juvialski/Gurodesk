# Assessment provider contract hotfix — 2026-08-10

Production retest after the shallow-schema correction still failed for every assessment type.

Root causes addressed:

1. The legacy `responseSchema` shallow envelope used empty `OBJECT` definitions for `answer` and `visual`. Gemini's Schema validator requires object properties to be non-empty. The fallback schema is still shallow, but now carries only discriminators (`answer.type`, `visual.kind/version`) while the server remains authoritative for the complete answer/visual contract.
2. Google’s current generateContent documentation now exposes `generationConfig.responseFormat.text` with JSON Schema for current Gemini models. `gemini-3.5-flash-lite` now uses that current contract; `gemini-3.1-flash-lite` intentionally remains on the older `responseMimeType` + `responseSchema` path as a compatibility fallback.
3. Gemini API keys now travel in the documented `x-goog-api-key` header rather than the request URL query string.
4. Safe provider status/category diagnostics are logged without prompts, answers, keys, ciphertext, or provider response bodies. Error JSON contains a non-secret generator contract marker and provider HTTP status when available.

No database migration. No curriculum changes. No extra routine Gemini request.

## Production deployment note

GitHub Actions validates a disposable local Supabase stack; it does not deploy hosted Edge Functions. After pushing this hotfix, confirm the production Supabase deployment has updated `assessment-question-generator` from the same `main` commit. A successful Render deploy only proves the frontend bundle is current.
