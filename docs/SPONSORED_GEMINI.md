# Sponsored Gemini: implementation and manual deployment

No production migration, secret change, function deployment, or provider generation was performed during this local implementation.

## Deployment order

1. Recover an authorized SQL connection to `hmeybakjxtzmiebtxonc`. Reconcile its real migration history against the repository before applying anything. The connector still returns `28P01`; do not rotate passwords as part of this handoff.
2. Apply the pending repository migrations in order, including `20261009063731_sponsored_gemini_allowance.sql` and `20261009065739_reusable_mail_merge_templates.sql`. Local success is not proof of production compatibility. The fresh/upgrade database gates must pass first.
3. Configure `GURODESK_SPONSORED_GEMINI_KEY` through Supabase Dashboard → Edge Functions → Secrets. Never use a `VITE_*` variable or paste the key into an AI chat. See [Supabase secret configuration](https://supabase.com/docs/guides/functions/secrets).
4. Preserve existing credential encryption material. `GURODESK_CREDENTIAL_ENCRYPTION_KEY` is used for dedicated encryption; historical credentials marked `service_role` rely on their original service-role material. Changing either without a credential migration can break existing BYOK keys. Supabase supplies the server URL/anon/service-role environment to the functions; service-role material never belongs in the browser.
5. Redeploy **all eleven** functions in `supabase/config.toml`, including the previously missing `handwriting-transcriber` and `performance-task-generator`. Shared source changes require all provider callers to be redeployed together. Keep JWT verification enabled. The functions also validate the token with `auth.getUser()`.
6. Deploy the frontend only after the database and functions are ready. No deployment commands were executed by Codex.

## Accounting rules

- The authenticated Edge identity selects the teacher. Client user IDs, day boundaries, and usage counters are never accepted by the quota RPCs.
- A stored personal key always takes priority, including selected model settings. It remains encrypted at rest and is decrypted only on the server. An invalid or undecryptable personal key stops the request; it never switches to sponsorship.
- Every sponsored outbound `generateContent` request crosses `geminiFetch`, including generation, verification, repairs, visuals, multimodal analysis, handwriting, and fallback attempts. Saving/testing a personal key is BYOK and does not consume sponsored calls.
- Admission reserves capacity under a short global database row lock. Twenty active reservations/dispatched calls exhaust the teacher's Manila-day capacity. A separate compare-and-set dispatch operation prevents replay from sending a second provider request.
- Day boundaries are computed in Postgres using `Asia/Manila`. A reservation from the previous day cannot dispatch after midnight. The UI reads the owner-only `sponsored_ai_usage()` RPC and refreshes after function calls, on focus, and every minute.
- Invalid input, a missing sponsored secret, and already-aborted requests do not dispatch or charge. Reservations cancelled before dispatch are released; unfinished reservations expire after two minutes. Their records remain for audit.
- **Once dispatch is recorded, the call is counted even if the provider returns 429/500, blocks safety, truncates output, or the response cannot be parsed. Network timeout/connection uncertainty is counted and recorded as `network_unknown`; there is no automatic refund or automatic replay.** A process crash between the recorded dispatch and network transmission is conservatively counted. Distributed database/HTTP dispatch cannot be made one indivisible transaction; this ambiguity is explicit, not presented as an exact Google billing measurement.
- HTTP outcome recording is best effort after admission/dispatch have been persisted. If recording fails, the charge remains with a pending outcome for review.
- Idempotency uses a teacher-scoped request UUID, internal-call ordinal, and SHA-256 fingerprint of the function path/model/provider payload. No raw prompts, images, names, or keys are stored in the quota ledger. A duplicate/conflicting action returns 409 rather than regenerating or promising a cached result. The browser adds a UUID; callers retrying the same action must retain its `x-idempotency-key`.

## Global controls and security

The private `gurodesk_ai_private.budget` row defaults to 2,000 calls/day and 120 admissions/minute, with at most 20 admissions/minute per teacher. These are request-count safeguards, not a currency-denominated spending guarantee. A provider 429 activates a one-minute shared circuit breaker; it does not consume the allowance of other teachers whose requests are rejected before dispatch. An administrator can reduce the caps or disable sponsored admission in that private row after reviewing usage.

Private tables have RLS enabled, no anon/authenticated schema/table access, and no client write policies. Admission/dispatch/cancellation/completion RPCs are service-role-only, use an empty search path, and check their executing role. The owner-only read RPC is a narrowly scoped security definer with an `auth.uid()` check. No service-role grants are added to Auth tables. A foreign key validates teacher existence.

Static code/permission review and mocked transport tests have run locally. Actual Postgres permissions, fresh/upgrade compatibility, concurrency, and runtime boots still require the stopped local Docker/Supabase stack. Do not call production quota enforcement verified until those gates and an authorized hosted smoke test pass.

## Validation commands

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run test:ci
npm.cmd run test:quota:db
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run test:e2e:demo
```

Database/integration/auth E2E commands require an isolated local stack and its disposable environment values. `test:quota:db` refuses non-local database URLs. CI runs the SQL permissions/day-boundary/global-budget assertions after resetting its disposable database, and the integration test submits 30 concurrent admission requests and asserts exactly 20 succeed. No real Gemini key is required.
