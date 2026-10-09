import { expect, it, vi } from 'vitest'
import { createAiFetch } from '../../src/lib/aiFetch'

it('adds request identity, preserves auth headers and notifies after function completion', async () => {
  const native = vi.fn<typeof fetch>(async () => new Response('{}')); const notify = vi.fn()
  const call = createAiFetch(native, notify)
  await call('https://fixture.supabase.co/functions/v1/lesson-ai-support', { headers: { Authorization: 'Bearer unit-fixture' } })
  const headers = new Headers(native.mock.calls[0][1]?.headers)
  expect(headers.get('authorization')).toBe('Bearer unit-fixture')
  expect(headers.get('x-idempotency-key')).toMatch(/^[0-9a-f-]{36}$/)
  expect(notify).toHaveBeenCalledTimes(1)
})
it('retains an explicit replay ID, leaves ordinary REST untouched and notifies on network failure', async () => {
  const native = vi.fn<typeof fetch>(async () => new Response('{}')); const notify = vi.fn()
  const call = createAiFetch(native, notify)
  await call('https://fixture.supabase.co/rest/v1/teacher_profiles')
  expect(native.mock.calls[0][1]).toBeUndefined(); expect(notify).not.toHaveBeenCalled()
  await call('https://fixture.supabase.co/functions/v1/template-analyzer', { headers: { 'x-idempotency-key': 'explicit-fixture' } })
  expect(new Headers(native.mock.calls[1][1]?.headers).get('x-idempotency-key')).toBe('explicit-fixture')
  native.mockRejectedValue(new Error('network unavailable'))
  await expect(call('https://fixture.supabase.co/functions/v1/template-analyzer')).rejects.toThrow('network unavailable')
  expect(notify).toHaveBeenCalledTimes(2)
})
