import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fallbackAllowed,
  generationConfigFor,
} from '../../supabase/functions/_shared/ai-models'
import {
  callGemini,
  GeminiHttpError,
  isFallbackEligibleStatus,
} from '../../supabase/functions/_shared/gemini'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Gemini dependency boundary', () => {
  it('allows fallback only between distinct Lite models', () => {
    expect(fallbackAllowed('gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', true)).toBe(true)
    expect(fallbackAllowed('gemini-3.5-flash', 'gemini-3.1-flash-lite', true)).toBe(false)
    expect(fallbackAllowed('gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', true)).toBe(false)
    expect(fallbackAllowed('gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', false)).toBe(false)
  })

  it('keeps high-thinking configuration on Lite models', () => {
    expect(generationConfigFor('gemini-3.5-flash-lite')).toMatchObject({
      thinkingConfig: { thinkingLevel: 'HIGH' },
    })
    expect(generationConfigFor('gemini-3.5-flash')).not.toHaveProperty('thinkingConfig')
  })

  it('classifies retryable provider responses without making a real request', () => {
    expect([404, 500, 502, 503, 504].every(isFallbackEligibleStatus)).toBe(true)
    expect(isFallbackEligibleStatus(429)).toBe(false)
    expect(isFallbackEligibleStatus(401)).toBe(false)
  })

  it('surfaces a bounded provider error while keeping the API key out of the message', async () => {
    const apiKey = 'teacher-secret-api-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quota detail', { status: 429 })))

    await expect(callGemini(apiKey, 'gemini-3.5-flash-lite', 'fixture prompt')).rejects.toMatchObject({
      status: 429,
      detail: 'quota detail',
    } satisfies Partial<GeminiHttpError>)

    try {
      await callGemini(apiKey, 'gemini-3.5-flash-lite', 'fixture prompt')
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(apiKey)
    }
  })
})
