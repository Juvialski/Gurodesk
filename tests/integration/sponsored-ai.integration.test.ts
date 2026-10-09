import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalTestHarness, type TestHarness } from './supabaseTestHarness'

describe('sponsored AI admission against isolated local Postgres', () => {
  let harness: TestHarness
  beforeAll(async () => { harness = await createLocalTestHarness() }, 60_000)
  afterAll(async () => { await harness?.cleanup() }, 60_000)
  it('atomically admits only 20 of 30 concurrent provider calls and rejects replay/counter manipulation', async () => {
    const teacher = harness.teachers[0]
    const requests = Array.from({ length: 30 }, () => ({ p_user_id: teacher.id, p_request_id: crypto.randomUUID(), p_ordinal: 1, p_fingerprint: 'a'.repeat(64), p_model: 'gemini-3.5-flash-lite' }))
    const results = await Promise.all(requests.map(args => harness.service.rpc('reserve_sponsored_ai_call', args)))
    for (const result of results) expect(result.error).toBeNull()
    const allowed = results.filter(result => result.data.allowed)
    expect(allowed).toHaveLength(20)
    expect(results.filter(result => result.data.code === 'allowance_exhausted')).toHaveLength(10)
    const replay = await harness.service.rpc('reserve_sponsored_ai_call', requests[results.findIndex(result => result.data.allowed)])
    expect(replay.data.code).toBe('duplicate')
    const dispatch = await Promise.all(allowed.map(result => harness.service.rpc('dispatch_sponsored_ai_call', { p_call_id: result.data.call_id })))
    expect(dispatch.every(result => !result.error && result.data.allowed)).toBe(true)
    const usage = await teacher.client.rpc('sponsored_ai_usage')
    expect(usage.error).toBeNull(); expect(usage.data.remaining).toBe(0)
    const illegal = await teacher.client.rpc('reserve_sponsored_ai_call', requests[0])
    expect(illegal.error).not.toBeNull()
    const forgedRead = await teacher.client.rpc('sponsored_ai_usage', { user_id: harness.teachers[1].id })
    expect(forgedRead.error).not.toBeNull()
    const other = await harness.teachers[1].client.rpc('sponsored_ai_usage')
    expect(other.data.remaining).toBe(20)
    const replayDispatch = await harness.service.rpc('dispatch_sponsored_ai_call', { p_call_id: allowed[0].data.call_id })
    expect(replayDispatch.data.code).toBe('duplicate')
    const finish = await harness.service.rpc('finish_sponsored_ai_call', { p_call_id: allowed[0].data.call_id, p_http_status: 503 })
    expect(finish.error).toBeNull()
    expect((await teacher.client.rpc('sponsored_ai_usage')).data.remaining).toBe(0)
  })
})
