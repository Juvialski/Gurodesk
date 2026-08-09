# Phase 4.2 — BYOK AI Question Generation

## Policy and responsibility

The implementation is grounded in DepEd Order No. 015, s. 2026. AI may assist a teacher by drafting test items/prompts and alternative versions, but the teacher remains responsible for professional judgment, curriculum alignment, validation, review, assessment integrity, and the final document. GuroDesk does not use AI to determine grades, replace the finalized TOS, or evaluate learner results in this phase.

## Fixed mapping

Generation operates on an existing deterministic item slot. The authenticated server loads the teacher-owned assessment and canonical item mapping. Browser-supplied competency text, cognitive labels, item numbers, or curriculum identities are not trusted and cannot be returned as replacements.

## BYOK request path

```text
Assessment editor
→ authenticated assessment-question-generator Edge Function
→ teacher-owned encrypted Gemini credential
→ preferred model with Lite-only automatic fallback
→ strict structured JSON validation
→ candidate preview / explicit teacher action
```

The browser never receives the Gemini key, encrypted credential, service-role secret, or a shared public AI credential. Gemini 3.5 Flash-Lite remains the default and Gemini 3.1 Flash-Lite the automatic Lite fallback, both with high thinking. Manually selected Flash models are not silently consumed as automatic fallbacks.

## Accuracy guardrails

The server supplies only the verified competency and stored cognitive category. Questions are normally self-contained. The prompt forbids invented curriculum codes, books, modules, page numbers, websites, devices, apps, worksheets, school materials, and local/community facts. Any referenced-resource declaration must be a subset of resources the teacher already listed. Learner personally identifiable information is not included.

Language follows the stored teacher preference: Auto, English, Filipino, English + Filipino, or the named local language. Existing teacher-authored content is not unexpectedly translated.

## Review workflow

Item actions generate a candidate or alternative; they do not silently overwrite accepted, edited, or manual content. Batch generation skips nonempty items, uses bounded concurrency and finite retry/backoff for transient failures, preserves successful candidates when another item fails, reports progress, and supports cancellation.

## Validation

Run `npm run validate:phase42`. It tests structured output parsing, type-specific answer validation, malformed-output rejection, resource and language guardrails, fixed mapping, partial batch failure, bounded concurrency/retries, JWT configuration, BYOK secrecy, and teacher ownership checks.
