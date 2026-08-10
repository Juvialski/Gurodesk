import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ASSESSMENT_QUESTION_TYPES,
  generationConfigFor,
  maxOutputTokensForQuestionType,
  responseJsonSchemaForQuestionType,
  responseSchemaForQuestionType,
} from '../../supabase/functions/_shared/ai-models'
import {
  callGemini,
  extractGeminiText,
  GeminiResponseError,
  parseGeminiJson,
} from '../../supabase/functions/_shared/gemini'
import { validateAssessmentCandidate } from '../../supabase/functions/_shared/assessment-contract'
import { VALID_ASSESSMENT_CANDIDATES } from './assessmentContractFixtures'

afterEach(() => vi.unstubAllGlobals())

const visual = {
  id: 'geometry-1',
  kind: 'geometry',
  version: 1,
  width: 320,
  height: 200,
  altText: 'A triangle with labeled vertices.',
  primitives: [
    { type: 'polygon', points: [{ x: 40, y: 160 }, { x: 160, y: 32 }, { x: 280, y: 160 }], color: 'blue' },
    { type: 'textLabel', x: 160, y: 24, text: 'B', textSize: 'medium', anchor: 'middle' },
  ],
}

const base = {
  questionType: 'true_false' as const,
  prompt: 'A square has four equal sides.',
  answer: { type: 'true_false' as const, value: true },
  rationale: 'This is a defining property of a square.',
  referencedResources: [],
  visual: null,
}

describe('raw Gemini assessment contract', () => {
  it('builds a schema and bounded output budget for every question type', () => {
    for (const type of ASSESSMENT_QUESTION_TYPES) {
      const schema = responseSchemaForQuestionType(type)
      expect(schema.type).toBe('OBJECT')
      expect(schema.required).toContain('visual')
      expect(schema.properties?.questionType?.enum).toEqual([type])
      expect(schema.properties?.answer?.type).toBe('OBJECT')
      expect(schema.properties?.answer?.properties?.type?.enum).toEqual([type])
      expect(schema.properties?.visual?.type).toBe('OBJECT')
      expect(schema.properties?.visual?.nullable).toBe(true)
      expect(schema.properties?.visual?.properties?.kind?.enum).toEqual(['geometry'])
      expect(maxOutputTokensForQuestionType(type)).toBeGreaterThanOrEqual(4096)
      expect(maxOutputTokensForQuestionType(type)).toBeLessThanOrEqual(12288)
    }
  })

  it('builds the current JSON-Schema envelope without open empty objects', () => {
    for (const type of ASSESSMENT_QUESTION_TYPES) {
      const schema = responseJsonSchemaForQuestionType(type)
      expect(schema.type).toBe('object')
      expect(schema.properties?.answer?.properties?.type?.enum).toEqual([type])
      expect(schema.properties?.answer?.additionalProperties).toBe(true)
      expect(schema.properties?.visual?.anyOf).toHaveLength(2)
    }
  })

  it('uses current responseFormat for Gemini 3.5 Flash-Lite and strips deprecated config fields', () => {
    const config = generationConfigFor('gemini-3.5-flash-lite', {
      questionType: 'essay',
      responseFormat: { text: { mimeType: 'application/json' } },
      temperature: 0.2,
      topP: 0.9,
      candidateCount: 2,
      sdkPrivateField: 'must not cross the boundary',
      maxOutputTokens: 10,
    })
    expect(config).toHaveProperty('responseFormat.text.mimeType', 'application/json')
    expect(config).toHaveProperty('responseFormat.text.schema.properties.answer.properties.type.enum', ['essay'])
    expect(config).not.toHaveProperty('responseMimeType')
    expect(config).not.toHaveProperty('responseSchema')
    expect(config).not.toHaveProperty('temperature')
    expect(config).not.toHaveProperty('topP')
    expect(config).not.toHaveProperty('candidateCount')
    expect(config).not.toHaveProperty('sdkPrivateField')
    expect(config.maxOutputTokens).toBe(12288)
    expect(config.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' })
  })

  it('keeps Gemini 3.1 Flash-Lite on a valid non-empty legacy responseSchema fallback', () => {
    const config = generationConfigFor('gemini-3.1-flash-lite', { questionType: 'multiple_choice' })
    expect(config.responseMimeType).toBe('application/json')
    expect(config.responseSchema).toBeTruthy()
    expect(config).not.toHaveProperty('responseFormat')
    expect((config.responseSchema as { properties?: Record<string, { properties?: unknown }> }).properties?.answer?.properties).toBeTruthy()
  })

  it('checks finishReason before returning text', () => {
    expect(extractGeminiText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }] })).toMatchObject({ text: '{"ok":true}', finishReason: 'STOP' })
    expect(() => extractGeminiText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] })).toThrowError(GeminiResponseError)
    expect(() => extractGeminiText({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] })).toThrow(/safety/u)
    expect(() => extractGeminiText({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] })).toThrow(/text/u)
    expect(() => extractGeminiText({ candidates: [{ content: { parts: [{ text: '{}' }] } }] })).toThrow(/finish reason/u)
    expect(extractGeminiText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'Internal summary that is not JSON.' }, { text: '{\"ok\":true}' }] } }] }).text).toBe('{\"ok\":true}')
    expect(() => parseGeminiJson('{not-json')).toThrow(/malformed/u)
  })

  it('uses raw v1beta generateContent and returns sanitized structured output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(base) }] } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(callGemini('secret-key', 'gemini-3.5-flash-lite', 'fixture', { questionType: 'true_false' })).resolves.toContain('true_false')
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(request.body))
    expect(String(body.contents[0].parts[0].text)).toBe('fixture')
    expect(body.generationConfig.responseFormat.text.mimeType).toBe('application/json')
    expect(body.generationConfig.responseFormat.text.schema.required).toContain('visual')
    expect(body.generationConfig).not.toHaveProperty('responseMimeType')
    expect(body.generationConfig).not.toHaveProperty('responseSchema')
    expect(request.headers).toMatchObject({ 'x-goog-api-key': 'secret-key' })
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('?key=')
  })

  it('requires the nullable visual field and rejects unsupported nested fields', () => {
    expect(validateAssessmentCandidate(base, 'true_false', [])).toMatchObject({ visual: null })
    expect(() => validateAssessmentCandidate({ ...base, visual: { ...visual, primitives: [{ ...visual.primitives[0], fill: 'not-a-palette-colour' }] } }, 'true_false', [])).toThrow(/visual/u)
    expect(() => validateAssessmentCandidate({ ...base, answer: { ...base.answer, unsupported: true } }, 'true_false', [])).toThrow(/unsupported/u)
    expect(() => validateAssessmentCandidate({ ...base, visual: undefined }, 'true_false', [])).toThrow()
  })

  it('accepts the strict wire shape for every supported answer type', () => {
    for (const type of ASSESSMENT_QUESTION_TYPES) {
      const candidate = { ...VALID_ASSESSMENT_CANDIDATES[type], visual: null }
      expect(() => validateAssessmentCandidate(candidate, type, [])).not.toThrow()
    }
  })
})
