import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { geminiFetch, resolveGeminiAccess, SponsoredAiError, type GeminiAccess } from '../../supabase/functions/_shared/sponsored-ai'
import { encryptCredential } from '../../supabase/functions/_shared/credentialCrypto'

const userId = '11111111-1111-4111-8111-111111111111'
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'
const payload = { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: 'Unit fixture' }] }] }) }
function ledger() {
  let admitted = 0
  const records = new Map<string, { fingerprint: string; state: string }>()
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>): Promise<{ data: Record<string, unknown>; error: unknown }> => {
    if (name === 'reserve_sponsored_ai_call') {
      const id = `${args.p_request_id}:${args.p_ordinal}`
      const existing = records.get(id)
      if (existing) return { data: { allowed: false, code: existing.fingerprint === args.p_fingerprint ? 'duplicate' : 'idempotency_conflict' }, error: null }
      if (admitted >= 20) return { data: { allowed: false, code: 'allowance_exhausted' }, error: null }
      admitted++
      records.set(id, { fingerprint: String(args.p_fingerprint), state: 'reserved' })
      return { data: { allowed: true, call_id: id }, error: null }
    }
    if (name === 'dispatch_sponsored_ai_call') records.get(String(args.p_call_id))!.state = 'dispatched'
    return { data: { allowed: true }, error: null }
  })
  return { rpc, records }
}
async function access(admin = ledger(), id = crypto.randomUUID()) {
  return resolveGeminiAccess(null, admin, userId, new Request('https://local.test/functions/v1/assessment-question-generator', { method: 'POST', headers: { 'x-idempotency-key': id } }), 'unit-provider-key')
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))); vi.stubGlobal('Deno', { env: { get: () => 'unit-encryption-material-not-a-real-secret' } }) })

describe('sponsored Gemini provider boundary (mocked accounting, no live provider)', () => {
  it('dispatches calls 1–20 and blocks the twenty-first before fetch', async () => {
    const admin = ledger(); const key = await access(admin)
    for (let call = 1; call <= 20; call++) await geminiFetch(key, endpoint, payload)
    await expect(geminiFetch(key, endpoint, payload)).rejects.toMatchObject({ code: 'allowance_exhausted', status: 429 })
    expect(fetch).toHaveBeenCalledTimes(20)
  })
  it('counts each internal call in one action, including fallback models', async () => {
    const admin = ledger(); const key = await access(admin)
    await geminiFetch(key, endpoint, payload)
    await geminiFetch(key, endpoint.replace('3.5', '3.1'), payload)
    expect(admin.records.size).toBe(2)
    expect(admin.rpc.mock.calls.filter(([name]) => name === 'reserve_sponsored_ai_call').map(([, args]) => args.p_ordinal)).toEqual([1, 2])
  })
  it('does not reserve for invalid serialized payloads or untrusted endpoints', async () => {
    const admin = ledger(); const key = await access(admin)
    await expect(geminiFetch(key, endpoint, { ...payload, body: 'broken JSON' })).rejects.toThrow()
    await expect(geminiFetch(key, 'https://attacker.test:443/generateContent', payload)).rejects.toThrow()
    expect(admin.rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('records HTTP failures after dispatch and does not refund', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }))
    const admin = ledger(); const key = await access(admin)
    expect((await geminiFetch(key, endpoint, payload)).status).toBe(503)
    expect(admin.rpc).toHaveBeenLastCalledWith('finish_sponsored_ai_call', expect.objectContaining({ p_http_status: 503 }))
    expect([...admin.records.values()][0].state).toBe('dispatched')
  })
  it('counts network uncertainty once and records its outcome', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network unavailable'))
    const admin = ledger(); const key = await access(admin)
    await expect(geminiFetch(key, endpoint, payload)).rejects.toThrow('network unavailable')
    expect(admin.rpc).toHaveBeenLastCalledWith('finish_sponsored_ai_call', expect.objectContaining({ p_http_status: null }))
  })
  it('rejects duplicate requests and mismatched replay content without another dispatch', async () => {
    const admin = ledger(); const id = crypto.randomUUID()
    await geminiFetch(await access(admin, id), endpoint, payload)
    await expect(geminiFetch(await access(admin, id), endpoint, payload)).rejects.toMatchObject({ code: 'duplicate' })
    await expect(geminiFetch(await access(admin, id), endpoint, { ...payload, body: '{}' })).rejects.toMatchObject({ code: 'idempotency_conflict' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('fails closed if admission/dispatch accounting is unavailable', async () => {
    const admin = ledger(); admin.rpc.mockResolvedValue({ data: {}, error: new Error('DB unavailable') } as never)
    await expect(geminiFetch(await access(admin), endpoint, payload)).rejects.toBeInstanceOf(SponsoredAiError)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not dispatch expired reservations or lose charges on completion recording failure', async () => {
    const admin = ledger()
    admin.rpc.mockImplementation(async name => ({ data: name === 'dispatch_sponsored_ai_call' ? { allowed: false, code: 'reservation_expired' } : { allowed: true, call_id: 'fixture' }, error: null }))
    await expect(geminiFetch(await access(admin), endpoint, payload)).rejects.toMatchObject({ code: 'reservation_expired' }); expect(fetch).not.toHaveBeenCalled()
    admin.rpc.mockImplementation(async name => ({ data: { allowed: true, call_id: 'fixture' }, error: name === 'finish_sponsored_ai_call' ? new Error('DB unavailable') : null } as never))
    expect((await geminiFetch(await access(admin), endpoint, payload)).ok).toBe(true)
  })
  it('keeps provider quota exhaustion distinct from teacher allowance', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 429 }))
    const admin = ledger()
    await expect(geminiFetch(await access(admin), endpoint, payload)).rejects.toMatchObject({ code: 'provider_quota_exhausted' })
    expect(admin.rpc).toHaveBeenLastCalledWith('finish_sponsored_ai_call', expect.objectContaining({ p_http_status: 429 }))
  })
  it('reports missing global secret and unauthenticated identities without dispatch', async () => {
    const admin = ledger(); const req = new Request('https://local.test')
    await expect(resolveGeminiAccess(null, admin, userId, req, undefined)).rejects.toMatchObject({ code: 'SPONSORED_AI_UNAVAILABLE' })
    await expect(resolveGeminiAccess(null, admin, '', req, 'fixture')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(admin.rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('does not reserve an aborted action and cancels a reservation aborted before dispatch', async () => {
    const controller = new AbortController(); const admin = ledger(); const key = await access(admin)
    controller.abort()
    await expect(geminiFetch(key, endpoint, { ...payload, signal: controller.signal })).rejects.toThrow()
    expect(admin.rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
    const pending = new AbortController()
    admin.rpc.mockImplementation(async name => {
      if (name === 'reserve_sponsored_ai_call') pending.abort()
      return { data: { allowed: true, call_id: 'fixture' }, error: null }
    })
    await expect(geminiFetch(key, endpoint, { ...payload, signal: pending.signal })).rejects.toThrow()
    expect(admin.rpc).toHaveBeenLastCalledWith('cancel_sponsored_ai_call', { p_call_id: 'fixture' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects a global budget refusal without another provider request', async () => {
    const admin = ledger(); admin.rpc.mockResolvedValue({ data: { allowed: false, code: 'global_budget_exhausted' }, error: null })
    await expect(geminiFetch(await access(admin), endpoint, payload)).rejects.toMatchObject({ code: 'global_budget_exhausted' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses encrypted BYOK first, even when no global secret exists, without a sponsored reservation', async () => {
    const encrypted = await encryptCredential('fixture-personal-gemini-key')
    const admin = ledger()
    const key = await resolveGeminiAccess({ api_key_ciphertext: encrypted.ciphertext, api_key_iv: encrypted.iv, encryption_key_source: encrypted.keySource }, admin, userId, new Request('https://local.test'), undefined)
    await geminiFetch(key, endpoint, payload)
    expect(admin.rpc).not.toHaveBeenCalled()
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers)
    expect(headers.get('x-goog-api-key')).toBe('fixture-personal-gemini-key')
  })
  it('never falls back to sponsorship if an existing personal credential cannot decrypt', async () => {
    await expect(resolveGeminiAccess({ api_key_ciphertext: 'broken', api_key_iv: 'broken', encryption_key_source: 'dedicated' }, ledger(), userId, new Request('https://local.test'), 'fixture-global-key')).rejects.toMatchObject({ code: 'AI_KEY_RECONNECT_REQUIRED' })
    expect(fetch).not.toHaveBeenCalled()
  })
})

it('every production provider path is metered and authenticates before choosing a key', () => {
  for (const entry of readdirSync('supabase/functions', { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))) {
    const file = readFileSync(`supabase/functions/${entry.name}/index.ts`, 'utf8')
    if (entry.name === 'gemini-health' || entry.name === 'ai-settings') continue
    expect(file, entry.name).toContain('resolveGeminiAccess')
    expect(file, entry.name).toContain('.auth.getUser()')
    expect(file, entry.name).not.toMatch(/await fetch\(endpoint/)
    expect(file, entry.name).not.toContain(':generateContent?key=')
  }
})
