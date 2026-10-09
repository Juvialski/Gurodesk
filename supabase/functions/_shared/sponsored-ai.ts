import { decryptCredential, type EncryptionKeySource } from './credentialCrypto.ts'

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }
type Credential = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }
export type GeminiAccess = string | {
  key: string
  source: 'byok' | 'sponsored'
  admin: RpcClient
  userId: string
  requestId: string
  ordinal: number
  fingerprint: string
}

export class SponsoredAiError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); this.name = 'SponsoredAiError' }
}

export function sponsoredErrorPayload(error: unknown) {
  return error instanceof SponsoredAiError ? { error: error.message, code: error.code } : null
}

export async function fingerprint(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Injectable environment keeps tests key-free; the runtime never returns this object to a browser.
export async function resolveGeminiAccess(
  credential: Credential | null, admin: RpcClient, userId: string, req: Request,
  secret: string | undefined,
): Promise<GeminiAccess> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new SponsoredAiError('UNAUTHORIZED', 'Authentication required.', 401)
  if (credential) {
    try {
      const key = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)
      if (key.length < 20) throw new Error('Invalid stored credential')
      return key
    }
    catch { throw new SponsoredAiError('AI_KEY_RECONNECT_REQUIRED', 'Your saved Gemini key could not be decrypted. Replace it in Settings → AI Assistant.', 409) }
  }
  if (!secret?.trim()) throw new SponsoredAiError('SPONSORED_AI_UNAVAILABLE', 'Free AI is not configured yet. You can connect your own Gemini key in Settings, or continue using non-AI features.')
  const incoming = req.headers.get('x-idempotency-key')
  if (incoming && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)) {
    throw new SponsoredAiError('INVALID_IDEMPOTENCY_KEY', 'The AI request identifier is invalid.', 400)
  }
  return { key: secret.trim(), source: 'sponsored', admin, userId, requestId: incoming || crypto.randomUUID(), ordinal: 0,
    fingerprint: await fingerprint(new URL(req.url).pathname) }
}

async function rpc(admin: RpcClient, name: string, args: Record<string, unknown>) {
  const result = await admin.rpc(name, args)
  if (result.error) throw new SponsoredAiError('AI_ACCOUNTING_UNAVAILABLE', 'AI usage accounting is unavailable. Please try again later.')
  return result.data as Record<string, unknown>
}

const errors: Record<string, [string, number]> = {
  allowance_exhausted: ["You've used your 20 free AI calls today. Connect your own Gemini API key to continue, or use the free allowance again tomorrow.", 429],
  global_budget_exhausted: ['Free AI has reached its shared daily budget. Please try tomorrow or connect your own key.', 429],
  rate_limited: ['Too many AI requests at once. Please wait a minute before trying again.', 429],
  provider_quota_exhausted: ['The shared Google provider quota is temporarily unavailable. Your personal daily allowance is separate. Try later or connect your own key.', 429],
  duplicate: ['This AI request was already reserved or dispatched. It will not be sent again. Start a new action if you need another draft.', 409],
  idempotency_conflict: ['This request identifier was already used for different content.', 409],
  reservation_expired: ['The AI reservation expired before dispatch. Please try again.', 409],
}

function assertAllowed(result: Record<string, unknown>) {
  if (result.allowed === true) return
  const code = String(result.code ?? 'AI_ACCOUNTING_UNAVAILABLE')
  const [message, status] = errors[code] ?? ['Free AI is temporarily unavailable.', 503]
  throw new SponsoredAiError(code, message, status)
}

/** The ONLY production Gemini fetch boundary, including multimodal calls and fallbacks. */
export async function geminiFetch(access: GeminiAccess, endpoint: string, init: RequestInit): Promise<Response> {
  init.signal?.throwIfAborted()
  const url = new URL(endpoint)
  if (url.origin !== 'https://generativelanguage.googleapis.com' || !url.pathname.endsWith(':generateContent') || url.search) {
    throw new Error('Unsupported Gemini endpoint.')
  }
  const headers = new Headers(init.headers)
  headers.set('x-goog-api-key', typeof access === 'string' ? access : access.key)
  const ready = { ...init, headers: Object.fromEntries(headers.entries()), signal: init.signal ?? AbortSignal.timeout(90_000) }
  if (typeof access === 'string' || access.source === 'byok') return fetch(url.href, ready)
  // Validate/serialize payloads BEFORE reserving. One ordinal for every actual internal call.
  if (typeof init.body !== 'string' || !init.body) throw new Error('Gemini payload must be serialized before accounting.')
  JSON.parse(init.body)
  const ordinal = ++access.ordinal
  const reserved = await rpc(access.admin, 'reserve_sponsored_ai_call', {
    p_user_id: access.userId, p_request_id: access.requestId, p_ordinal: ordinal,
    p_fingerprint: await fingerprint(`${access.fingerprint}\n${url.pathname}\n${init.body}`),
    p_model: url.pathname.split('/').at(-1)?.replace(':generateContent', '') ?? '',
  })
  assertAllowed(reserved)
  const callId = reserved.call_id
  try { ready.signal.throwIfAborted() }
  catch (error) { await rpc(access.admin, 'cancel_sponsored_ai_call', { p_call_id: callId }).catch(() => {}); throw error }
  // If this fails, no fetch occurs. The short-lived reservation will expire, without a charge.
  const dispatch = await rpc(access.admin, 'dispatch_sponsored_ai_call', { p_call_id: callId })
  assertAllowed(dispatch)
  let response: Response
  try { response = await fetch(url.href, ready) }
  catch (error) {
    await rpc(access.admin, 'finish_sponsored_ai_call', { p_call_id: callId, p_http_status: null }).catch(() => {})
    throw error // Dispatch uncertainty is counted; never silently refund or retry.
  }
  // Accounting state was persisted before dispatch. Failure to record the outcome cannot erase it.
  await rpc(access.admin, 'finish_sponsored_ai_call', { p_call_id: callId, p_http_status: response.status }).catch(() => {})
  if (response.status === 429) throw new SponsoredAiError('provider_quota_exhausted', errors.provider_quota_exhausted[0], 429)
  if ([401, 403].includes(response.status)) throw new SponsoredAiError('SPONSORED_AI_UNAVAILABLE', 'The shared AI service credential was rejected. Please try later or connect your own key.')
  return response
}
