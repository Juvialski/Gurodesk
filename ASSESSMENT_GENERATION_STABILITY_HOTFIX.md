# Assessment generation stability hotfix

Date: 2026-08-11

## Why this hotfix exists

The first Word-first / separated-visual release exposed three practical regressions in live use:

1. successful retries could remain listed as old failures in the UI;
2. transient Supabase Edge Function transport failures were not retryable and the batch could cascade the same failure across later items; and
3. the new frontend could reject or duplicate work from an older still-deployed assessment generator that returned the visual inside the question response.

The same release also had two CI-only regressions: one unit-test callback returned `Array.push()`'s number, and the Source TOS Playwright locator still selected a hidden responsive duplicate.

## Implemented

- Successful question checkpoints now immediately remove that item from the visible failure list.
- Bulk generation runs sequentially (`concurrency: 1`) for a more stable phone/network/BYOK path.
- `FunctionsFetchError`, `Failed to send a request to the Edge Function`, failed fetch, and network-style failures are classified as `edge_transport`.
- Edge transport failures receive the scheduler's bounded transient retry behavior. If still exhausted, the batch pauses instead of attempting every remaining item.
- Visual/verifier service failures preserve the already-generated question and then pause the remainder of the batch when appropriate.
- Legacy pre-split generator responses that already contain a validated `visual` are accepted without requiring `visualRequirement` / `visualIntent` and without issuing the new second `visual` operation.
- With the split generator, only `visualRequirement=required` automatically spends a second visual request. `helpful` visuals are deferred.
- Independent opposite-Lite verification is automatic only for high-risk items. Medium-risk items still receive deterministic QA without an extra Gemini request.
- Fixed the `onSuggestion` unit-test callback so it returns `void` instead of the numeric result of `Array.push()`.
- Fixed the Source TOS E2E locator to target the visible responsive context and visible `<strong>` title.
- Added `scripts/check-assessment-generation-stability.mjs` to retain these invariants in `validate:all`.

## Deployment compatibility

No database migration was added.

This frontend is deliberately backward-compatible with the previous deployed `assessment-question-generator`: if that generator returns a visual in the original question response, GuroDesk uses it and does not call the newer `visual` operation.

Deploying the matching newer Edge Function is still recommended when convenient because it enables the dedicated required-visual pass, but the frontend no longer depends on perfectly synchronized deployment just to generate ordinary questions.
