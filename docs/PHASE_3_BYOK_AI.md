# Phase 3 BYOK AI checkpoint

GuroDesk no longer uses a shared application Gemini API key.

## Teacher flow

1. Sign in to GuroDesk.
2. Open **Settings → AI Assistant**.
3. Tap **Get Gemini API key** to open Google AI Studio's API-key page.
4. Paste the teacher's own key into GuroDesk.
5. GuroDesk tests the selected model once.
6. If successful, the Edge Function encrypts the key with AES-GCM and stores only ciphertext/IV/last-four metadata.
7. The saved key is never returned to the browser.

## Model priority

Default:

- `gemini-3.5-flash-lite` — high thinking
- automatic Lite fallback: `gemini-3.1-flash-lite` — high thinking

Selectable alternatives:

- `gemini-3.6-flash`
- `gemini-3.5-flash`

The UI displays the current planning guide of 500 calls/day for the two Lite models and 20 calls/day for the two Flash models. Those values are **guidance only**; GuroDesk never enforces them. Google's real API response (including `429`) is authoritative.

Automatic fallback is intentionally Lite-only. Selecting 3.6 Flash or 3.5 Flash never causes GuroDesk to silently consume calls from another limited-call Flash model.

## High-thinking rule

For both Flash-Lite models, every Gemini request includes:

```json
{
  "thinkingConfig": {
    "thinkingLevel": "high"
  }
}
```

The two non-Lite Flash models use their model default unless this policy is intentionally changed later.

## Credential security

Tables:

- `teacher_ai_credentials`
- `teacher_ai_settings`

Both have RLS enabled with **no normal authenticated Data API CRUD policies**. The browser cannot query even the ciphertext. Only authenticated Edge Functions use the Supabase service role after verifying the caller's JWT.

Encryption uses AES-GCM. If the optional `GURODESK_CREDENTIAL_ENCRYPTION_KEY` Edge Function secret is available, new credentials use it. Otherwise GuroDesk derives encryption material from the server-only `SUPABASE_SERVICE_ROLE_KEY`. The row records which source encrypted it, allowing a future dedicated secret to coexist with older rows.

If the service-role secret is rotated while an older credential used service-role-derived encryption, that teacher may need to reconnect the Gemini key. No plaintext key is recoverable from the browser.

## Edge Functions

- `ai-settings` — status, test/save/replace/remove key, model settings
- `lesson-ai-support` — decrypts the authenticated teacher's key only for the duration of the request, uses the selected model, and applies Lite-only fallback
- `gemini-health` — platform/BYOK mode status only; no shared Gemini key

## Migration

After migrations 001–006, apply:

`202608080007_phase3_byok_ai.sql`

The GitHub/Supabase production integration should apply this automatically when the commit reaches `main`.
