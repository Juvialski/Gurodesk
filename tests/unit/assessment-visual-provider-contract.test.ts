import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generationConfigFor, visualResponseSchema } from '../../supabase/functions/_shared/ai-models'
import { normalizeAssessmentVisualProviderOutput, validateAssessmentVisual } from '../../supabase/functions/_shared/assessment-visual'

const providerAliasFixture = {
  id: 'provider-alias-fixture',
  kind: 'geometry',
  version: 1,
  width: 600,
  height: 360,
  altText: 'A labeled quadrilateral with a diagonal and an angle mark.',
  primitives: [
    { type: 'polygon', vertices: [[90, 70], [510, 70], [480, 285], [120, 285]], color: 'blue', strokeWidth: 2 },
    { type: 'line', start: [90, 70], end: { x: 480, y: 285 }, color: 'ink', strokeWidth: 1 },
    { type: 'angleArc', vertex: [90, 70], radius: 28, startAngle: 0, endAngle: 30, color: 'ink', strokeWidth: 1 },
    { type: 'label', position: [75, 58], text: 'A', color: 'ink', textSize: 'medium' },
  ],
}

describe('dedicated visual provider boundary', () => {
  it('attaches the bounded visual schema only to a visual-style request', () => {
    const visualConfig = generationConfigFor('gemini-3.5-flash-lite', {
      responseMimeType: 'application/json',
      responseSchema: visualResponseSchema,
      maxOutputTokens: 8192,
    })
    expect(visualConfig).toMatchObject({ responseMimeType: 'application/json', responseSchema: visualResponseSchema, maxOutputTokens: 8192 })

    const questionConfig = generationConfigFor('gemini-3.5-flash-lite', {
      questionType: 'multiple_choice',
      responseSchema: visualResponseSchema,
    })
    expect(questionConfig).not.toHaveProperty('responseSchema')
  })

  it('normalizes the screenshot endpoint, vertices, tuple-point, and label aliases before strict validation', () => {
    const normalized = normalizeAssessmentVisualProviderOutput(providerAliasFixture) as typeof providerAliasFixture & { primitives: Array<Record<string, unknown>> }
    expect(normalized.primitives[0]).toMatchObject({ type: 'polygon' })
    expect((normalized.primitives[0].points as unknown[]).slice(0, 2)).toEqual([{ x: 90, y: 70 }, { x: 510, y: 70 }])
    expect(normalized.primitives[0]).not.toHaveProperty('vertices')
    expect(normalized.primitives[1]).toMatchObject({ type: 'segment', x1: 90, y1: 70, x2: 480, y2: 285 })
    expect(normalized.primitives[1]).not.toHaveProperty('start')
    expect(normalized.primitives[2]).toMatchObject({ type: 'angleArc', vertex: { x: 90, y: 70 } })
    expect(normalized.primitives[3]).toMatchObject({ type: 'textLabel', x: 75, y: 58 })
    expect(validateAssessmentVisual(normalized)).toEqual({ valid: true, errors: [] })
  })

  it('keeps unknown/conflicting fields for strict rejection instead of silently broadening the grammar', () => {
    const unsafe = structuredClone(providerAliasFixture)
    ;(unsafe.primitives[1] as Record<string, unknown>).onclick = 'alert(1)'
    const normalized = normalizeAssessmentVisualProviderOutput(unsafe)
    expect(validateAssessmentVisual(normalized).errors.some((message) => message.includes('onclick'))).toBe(true)
  })

  it('rejects empty-looking, tiny, degenerate, and self-crossing provider diagrams', () => {
    const base = { ...providerAliasFixture, primitives: [] as unknown[] }
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'textLabel', x: 300, y: 180, text: 'Only a label' }] }).errors.some((message) => message.includes('not a diagram'))).toBe(true)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'polygon', points: [{ x: 100, y: 100 }, { x: 104, y: 100 }, { x: 102, y: 102 }] }] }).errors.some((message) => /tiny|degenerate/u.test(message))).toBe(true)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'polygon', points: [{ x: 90, y: 70 }, { x: 510, y: 285 }, { x: 510, y: 70 }, { x: 90, y: 285 }] }] }).errors.some((message) => message.includes('self-crossing'))).toBe(true)
  })

  it('keeps normal question generation schema-free while narrowly projecting extra provider envelope fields', () => {
    const source = readFileSync(new URL('../../supabase/functions/assessment-question-generator/index.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/canonicalQuestionProviderEnvelope/u)
    expect(source).toMatch(/REQUIRED_QUESTION_PROVIDER_KEYS\.every/u)
    expect(source).toMatch(/visualResponseSchema/u)
    expect(source).toMatch(/8192, visualResponseSchema/u)
  })
})
