import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { callGemini, extractGeminiText, parseGeminiJson } from '../../supabase/functions/_shared/gemini'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assessment AI request contract regressions', () => {
  it('exposes a pure response parser that accepts STOP and rejects partial output', () => {
    expect(extractGeminiText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }] })).toEqual({ text: '{"ok":true}', finishReason: 'STOP' })
    expect(parseGeminiJson('{"ok":true}')).toEqual({ ok: true })
    expect(() => extractGeminiText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"partial":' }] } }] })).toThrow(/stopped|finish|incomplete|truncat/u)
  })

  it('sends only the supported Gemini REST JSON envelope and keeps the key out of the prompt body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(callGemini('teacher-secret-key', 'gemini-3.5-flash-lite', 'fixed prompt', {
      responseMimeType: 'application/json',
      temperature: 0.2,
      topP: 0.8,
      topK: 20,
    })).resolves.toBe('{"ok":true}')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect(url).not.toContain('?key=')
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'teacher-secret-key' })
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(payload.contents).toEqual([{ role: 'user', parts: [{ text: 'fixed prompt' }] }])
    expect(payload).not.toHaveProperty('prompt')
    // No questionType was supplied in this low-level boundary fixture, so the
    // explicit legacy MIME override remains valid for non-assessment callers.
    expect(payload).toHaveProperty('generationConfig.responseMimeType', 'application/json')
    expect(payload.generationConfig).not.toHaveProperty('temperature')
    expect(payload.generationConfig).not.toHaveProperty('topP')
    expect(payload.generationConfig).not.toHaveProperty('topK')
    expect(payload.generationConfig).not.toHaveProperty('responseFormat')
  })

  it('rejects a non-terminal Gemini finish reason even when partial text is present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"partial":' }] } }] }), { status: 200 })))
    await expect(callGemini('teacher-secret-key', 'gemini-3.5-flash-lite', 'fixed prompt')).rejects.toThrow(/finish|incomplete|truncat|stopped/u)
  })

  it('rejects safety/recitation candidates instead of treating their text as a valid item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '{"unsafe":true}' }] } }] }), { status: 200 })))
    await expect(callGemini('teacher-secret-key', 'gemini-3.5-flash-lite', 'fixed prompt')).rejects.toThrow(/finish|safety|incomplete|complete/u)
  })
})

describe('assessment question-generator request boundary', () => {
  const source = readFileSync(new URL('../../supabase/functions/assessment-question-generator/index.ts', import.meta.url), 'utf8')

  it('keeps the edge request allow-list explicit and rejects unknown browser fields', () => {
    expect(source).toMatch(/const allowedBodyKeys = \['operation', 'assessmentId', 'itemId', 'questionType', 'alternative', 'teacherContext', 'candidate', 'issues', 'repairGuidance', 'generatorModel', 'visualIntent'\]/u)
    expect(source).toMatch(/Object\.keys\(body \?\? \{\}\)\.some\(\(key\) => !allowedBodyKeys\.includes\(key\)\)/u)
    expect(source).toMatch(/Unsupported assessment AI request fields/u)
  })



  it('keeps question generation and mathematical visual generation in separate provider operations', () => {
    expect(source).toMatch(/type Operation = 'generate' \| 'verify' \| 'repair' \| 'visual'/u)
    expect(source).toMatch(/visualRequirement, visualIntent/u)
    expect(source).toMatch(/Do not return visual geometry/u)
    expect(source).toMatch(/function buildVisualPrompt/u)
    expect(source).toMatch(/operation === 'visual'/u)
    expect(source).toMatch(/Never return TikZ, TeX commands, SVG, HTML, JavaScript/u)
    expect(source).toMatch(/validateAssessmentVisual/u)
  })

  it('binds visual-only requests to the authoritative saved prompt and answer', () => {
    expect(source).toMatch(/function stableJson/u)
    expect(source).toMatch(/function savedAnswerForVisual/u)
    expect(source).toMatch(/clean\(approved\.prompt\) !== clean\(item\.prompt\)/u)
    expect(source).toMatch(/stableJson\(approved\.answer\) !== stableJson\(savedAnswerForVisual\(item\.answer\)\)/u)
    expect(source).toMatch(/saved question changed before visual generation/u)
  })

  it('keeps question type, item identity, mapping, and points server-owned', () => {
    expect(source).toMatch(/serverType !== requestedType/u)
    expect(source).toMatch(/item\.question_type/u)
    expect(source).toMatch(/pointsPossible/u)
    expect(source).toMatch(/saved item mapping|saved cognitive mapping/u)
    expect(source).toMatch(/Never alter the fixed item number, competency, cognitive category, question type, or points/u)
  })
})
