import { describe, expect, it } from 'vitest'
import { AssessmentRequestScheduler } from '../../src/lib/assessmentRequestScheduler'

describe('assessment request scheduler', () => {
  it('paces retries, honors 429 retry metadata, and stops at the retry ceiling', async () => {
    let now = 0
    const sleeps: number[] = []
    const attempts: number[] = []
    const scheduler = new AssessmentRequestScheduler({
      requestsPerMinute: 12,
      maxConcurrencyPerModel: 1,
      maxRetries: 2,
      backoffBaseMs: 25,
      backoffMaxMs: 100,
      now: () => now,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds)
        now += milliseconds
      },
    })

    await expect(scheduler.enqueue('gemini-3.5-flash-lite', async ({ attempt }) => {
      attempts.push(attempt)
      throw Object.assign(new Error('Provider rate limit'), { status: 429, retryAfterMs: 75 })
    })).rejects.toThrow('Provider rate limit')

    expect(attempts).toEqual([1, 2, 3])
    expect(scheduler.getUsageEstimate('gemini-3.5-flash-lite')).toMatchObject({ requestCount: 3, approximate: true })
    expect(sleeps).toContain(75)
    expect(now).toBeGreaterThanOrEqual(scheduler.intervalMs * 2)
  })

  it('does not retry permanent validation failures', async () => {
    const scheduler = new AssessmentRequestScheduler({
      maxRetries: 4,
      sleep: async () => undefined,
    })
    let calls = 0
    await expect(scheduler.enqueue('gemini-3.1-flash-lite', async () => {
      calls += 1
      throw Object.assign(new Error('Invalid request'), { status: 400 })
    })).rejects.toThrow('Invalid request')
    expect(calls).toBe(1)
  })
})
