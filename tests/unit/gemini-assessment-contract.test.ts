import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ASSESSMENT_QUESTION_TYPES,
  generationConfigFor,
  maxOutputTokensForQuestionType,
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
  it('uses JSON MIME-only mode for every normal assessment question type', () => {
    for (const type of ASSESSMENT_QUESTION_TYPES) {
      const config = generationConfigFor('gemini-3.5-flash-lite', {
        questionType: type,
        responseFormat: { text: { mimeType: 'application/json' } },
        responseSchema: { type: 'OBJECT' },
        temperature: 0.2,
        topP: 0.9,
        candidateCount: 2,
        sdkPrivateField: 'must not cross the boundary',
        maxOutputTokens: 10,
      })
      expect(config.responseMimeType).toBe('application/json')
      expect(config).not.toHaveProperty('responseFormat')
      expect(config).not.toHaveProperty('responseSchema')
      expect(config).not.toHaveProperty('temperature')
      expect(config).not.toHaveProperty('topP')
      expect(config).not.toHaveProperty('candidateCount')
      expect(config).not.toHaveProperty('sdkPrivateField')
      expect(config.maxOutputTokens).toBe(maxOutputTokensForQuestionType(type))
      expect(config.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' })
    }
  })

  it('uses the same JSON MIME-only boundary for the 3.1 Lite fallback', () => {
    const config = generationConfigFor('gemini-3.1-flash-lite', { questionType: 'multiple_choice' })
    expect(config.responseMimeType).toBe('application/json')
    expect(config).not.toHaveProperty('responseFormat')
    expect(config).not.toHaveProperty('responseSchema')
    expect(config.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' })
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
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig).not.toHaveProperty('responseFormat')
    expect(body.generationConfig).not.toHaveProperty('responseSchema')
    expect(request.headers).toMatchObject({ 'x-goog-api-key': 'secret-key' })
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('?key=')
  })

  it('normalizes missing/invalid optional visuals to null and rejects unsupported answer fields', () => {
    expect(validateAssessmentCandidate(base, 'true_false', [])).toMatchObject({ visual: null })
    expect(validateAssessmentCandidate({ ...base, visual: { ...visual, primitives: [{ ...visual.primitives[0], fill: 'not-a-palette-colour' }] } }, 'true_false', []).visual).toBeNull()
    expect(() => validateAssessmentCandidate({ ...base, answer: { ...base.answer, unsupported: true } }, 'true_false', [])).toThrow(/unsupported/u)
    expect(validateAssessmentCandidate({ ...base, visual: undefined }, 'true_false', []).visual).toBeNull()
  })

  it('removes answer-leaking fill-in examples and replaces model alt text with neutral observational text', () => {
    const candidate = {
      questionType: 'fill_in_the_blank' as const,
      prompt: 'Classify the polygon (e.g., irregular non-convex pentagon): _____.',
      answer: { type: 'fill_in_the_blank' as const, blanks: [{ id: 'blank-1', acceptedAnswers: ['irregular non-convex'] }] },
      rationale: 'The figure is classified by its visible properties.',
      referencedResources: [],
      visual: {
        id: 'polygon-classification', kind: 'geometry', version: 1, width: 320, height: 200,
        altText: 'An irregular non-convex pentagon with five sides and an inward-pointing vertex.',
        primitives: [{ type: 'polygon', points: [{ x: 40, y: 40 }, { x: 260, y: 40 }, { x: 180, y: 95 }, { x: 260, y: 160 }, { x: 40, y: 160 }], color: 'ink' }],
      },
    }
    const normalized = validateAssessmentCandidate(candidate, 'fill_in_the_blank', [])
    expect(normalized.prompt).toBe('Classify the polygon: _____.')
    expect((normalized.visual as { altText: string }).altText).toBe('A polygon outline with 5 vertices.')
    expect((normalized.visual as { altText: string }).altText.toLocaleLowerCase('en')).not.toContain('irregular')
    expect((normalized.visual as { altText: string }).altText.toLocaleLowerCase('en')).not.toContain('non-convex')
  })

  it('rejects an accepted answer revealed by a learner-facing visual text label', () => {
    const candidate = {
      ...VALID_ASSESSMENT_CANDIDATES.identification,
      prompt: 'Name the polygon shown in the diagram.',
      answer: { type: 'identification' as const, acceptedAnswers: ['pentagon'], caseSensitive: false },
      visualRequirement: 'required' as const,
      visualIntent: 'Show an unlabeled five-sided polygon for classification.',
      visual: {
        id: 'answer-leak-visual', kind: 'geometry', version: 1, width: 320, height: 200,
        altText: 'A five-sided polygon outline.',
        primitives: [
          { type: 'polygon', points: [{ x: 40, y: 40 }, { x: 260, y: 40 }, { x: 285, y: 125 }, { x: 160, y: 175 }, { x: 35, y: 125 }], color: 'ink' },
          { type: 'textLabel', x: 160, y: 20, text: 'Pentagon', textSize: 'medium', anchor: 'middle' },
        ],
      },
    }
    expect(() => validateAssessmentCandidate(candidate, 'identification', [])).toThrow(/visual revealed an accepted answer/u)
  })

  it('rejects a direct accepted-answer hint that remains in the learner prompt', () => {
    const candidate = {
      ...VALID_ASSESSMENT_CANDIDATES.fill_in_the_blank,
      prompt: 'The correct classification is irregular non-convex. Write irregular non-convex in the blank: _____.',
      answer: { type: 'fill_in_the_blank' as const, blanks: [{ id: 'blank-1', acceptedAnswers: ['irregular non-convex'] }] },
      visual: null,
    }
    expect(() => validateAssessmentCandidate(candidate, 'fill_in_the_blank', [])).toThrow(/revealed an accepted answer/u)
  })

  it('accepts the strict wire shape for every supported answer type', () => {
    for (const type of ASSESSMENT_QUESTION_TYPES) {
      const candidate = { ...VALID_ASSESSMENT_CANDIDATES[type], visual: null }
      expect(() => validateAssessmentCandidate(candidate, type, [])).not.toThrow()
    }
  })
})
