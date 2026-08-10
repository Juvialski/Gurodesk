import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { AssessmentDiagram } from '../../src/components/AssessmentDiagram'
import { ASSESSMENT_VISUAL_FIXTURES, CARTESIAN_LINEAR_GRAPH_VISUAL, IRREGULAR_CONCAVE_PENTAGON_VISUAL } from '../../src/lib/assessmentVisualFixtures'
import { assessmentVisualSvgMarkup } from '../../src/lib/assessmentVisualExport'
import { assessmentVisualTikzSource, escapeTikzText } from '../../src/lib/assessmentTikz'
import { validateAssessmentVisual } from '../../src/lib/assessmentVisualValidation'
import { buildAssessmentAnswerKeyExportModel, buildAssessmentStudentExportModel, buildAssessmentTeacherExportModel } from '../../src/lib/assessmentExportModel'
import type { AssessmentVisual } from '../../src/types/assessmentVisual'
import { assessmentItem, assessmentRecord } from './fixtures'

describe('safe assessment visuals', () => {
  it('accepts the irregular concave pentagon and the full marks fixture', () => {
    for (const visual of Object.values(ASSESSMENT_VISUAL_FIXTURES)) expect(validateAssessmentVisual(visual)).toEqual({ valid: true, errors: [] })
    expect(ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon.primitives.some((primitive) => primitive.type === 'polygon')).toBe(true)
    expect(ASSESSMENT_VISUAL_FIXTURES.convexQuadrilateral.altText).toContain('convex')
    expect(ASSESSMENT_VISUAL_FIXTURES.regularHexagon.altText).toContain('regular')
    expect(ASSESSMENT_VISUAL_FIXTURES.convexQuadrilateral.primitives.some((primitive) => primitive.type === 'textLabel' && primitive.text.includes('='))).toBe(true)
  })

  it('translates only validated visual data into TikZ and supports Cartesian graphs', () => {
    const source = assessmentVisualTikzSource(CARTESIAN_LINEAR_GRAPH_VISUAL)
    expect(source).toContain('\\begin{tikzpicture}')
    expect(source).toContain('\\draw[->')
    expect(source).toContain('line width=0.8pt')
    expect(source).toContain('--')
    expect(source).not.toContain('\\usepackage')
    expect(source).not.toContain('\\input')
    expect(assessmentVisualSvgMarkup(CARTESIAN_LINEAR_GRAPH_VISUAL)).toContain('data-axis-id="axes-1"')
    expect(escapeTikzText('x_1 & 50%')).toBe('x\\_1 \\& 50\\%')
  })

  it('rejects Cartesian plots with missing axes or points outside the declared bounds', () => {
    const orphan = { ...CARTESIAN_LINEAR_GRAPH_VISUAL, primitives: [{ type: 'cartesianPlot', axisId: 'missing', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] } as unknown as AssessmentVisual
    expect(validateAssessmentVisual(orphan).valid).toBe(false)
    const outOfBounds = { ...CARTESIAN_LINEAR_GRAPH_VISUAL, primitives: CARTESIAN_LINEAR_GRAPH_VISUAL.primitives.map((primitive) => primitive.type === 'cartesianPlot' ? { ...primitive, points: [...primitive.points, { x: 7, y: 1 }] } : primitive) } as AssessmentVisual
    expect(validateAssessmentVisual(outOfBounds).errors.some((message) => message.includes('Cartesian bounds'))).toBe(true)
  })

  it('rejects generic/missing alt text, unknown keys, unsafe coordinates, primitives, labels, and style fields', () => {
    const base = IRREGULAR_CONCAVE_PENTAGON_VISUAL
    expect(validateAssessmentVisual({ ...base, altText: 'diagram' }).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, altText: 'image' }).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, altText: '' }).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, altText: undefined }).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, unexpected: true } as unknown as AssessmentVisual).errors.some((message) => message.includes('not a supported visual property'))).toBe(true)
    expect(validateAssessmentVisual({ ...base, style: 'position:absolute' } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'point', x: Number.NaN, y: 2, color: 'ink' }] } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'point', x: Number.POSITIVE_INFINITY, y: 2, color: 'ink' }] } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'rawSvg', value: '<script>alert(1)</script>' }] } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'point', x: 9999, y: 2, color: 'neon' }] } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'textLabel', x: 10, y: 10, text: 'x'.repeat(81), textSize: 'medium' }] } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'textLabel', x: 10, y: 10, text: '<script>alert(1)</script>', textSize: 'medium' }] } as unknown as AssessmentVisual).valid).toBe(false)
    expect(validateAssessmentVisual({ ...base, primitives: [{ type: 'textLabel', x: 10, y: 10, text: 'safe label', textSize: 'medium', style: 'color:red' }] } as unknown as AssessmentVisual).valid).toBe(false)
  })

  it('keeps script-like plain text bounded and escapes it in the safe serializer', () => {
    const visual: AssessmentVisual = { ...IRREGULAR_CONCAVE_PENTAGON_VISUAL, primitives: [{ type: 'textLabel', x: 20, y: 30, text: 'alert(1)', textSize: 'small' }] }
    const markup = assessmentVisualSvgMarkup(visual)
    expect(markup).toContain('alert(1)')
    expect(markup).not.toContain('<script')
  })

  it('renders deterministic accessible SVG without raw markup injection', () => {
    const markup = renderToStaticMarkup(createElement(AssessmentDiagram, { visual: IRREGULAR_CONCAVE_PENTAGON_VISUAL }))
    expect(markup).toContain('role="img"')
    expect(markup).toContain('An irregular concave pentagon')
    expect(markup).toContain('<polygon')
    expect(markup).toContain('>A</text>')
    expect(markup).not.toContain('dangerouslySetInnerHTML')
  })

  it('keeps the visual in student, teacher, and answer-key export models', () => {
    const item = assessmentItem('multiple_choice', {
      prompt: 'Name the polygon.',
      visual: IRREGULAR_CONCAVE_PENTAGON_VISUAL,
      answer: { type: 'multiple_choice', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], choiceId: 'a' },
      authorshipState: 'manual',
    })
    const record = assessmentRecord([item])
    expect(buildAssessmentStudentExportModel(record).questions[0].visual).toEqual(IRREGULAR_CONCAVE_PENTAGON_VISUAL)
    expect(buildAssessmentTeacherExportModel(record).questions[0].visual).toEqual(IRREGULAR_CONCAVE_PENTAGON_VISUAL)
    expect(buildAssessmentAnswerKeyExportModel(record).questions[0].visual).toEqual(IRREGULAR_CONCAVE_PENTAGON_VISUAL)
  })
})
