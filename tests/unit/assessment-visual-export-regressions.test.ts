import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import { assessmentVisualSvgMarkup, drawAssessmentVisualPdf } from '../../src/lib/assessmentVisualExport'
import { validateAssessmentVisual } from '../../src/lib/assessmentVisualValidation'

describe('validated visual export regressions', () => {
  it('accepts deterministic polygon/label and mark/arc fixtures', () => {
    expect(validateAssessmentVisual(ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon).valid).toBe(true)
    expect(validateAssessmentVisual(ASSESSMENT_VISUAL_FIXTURES.convexQuadrilateral).valid).toBe(true)
    expect(validateAssessmentVisual(ASSESSMENT_VISUAL_FIXTURES.regularHexagon).valid).toBe(true)
    expect(validateAssessmentVisual(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels).valid).toBe(true)
    expect(ASSESSMENT_VISUAL_FIXTURES.convexQuadrilateral.primitives.some((primitive) => primitive.type === 'textLabel' && primitive.text.includes('='))).toBe(true)
  })

  it('serializes only safe primitives, escapes labels, and remains deterministic', () => {
    const visual = { ...ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon, altText: 'A <safe> polygon & labels' }
    // Markup is rejected by the validator, so an unsafe model never reaches a renderer.
    expect(assessmentVisualSvgMarkup(visual)).toBe('')

    const safe = ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon
    const first = assessmentVisualSvgMarkup(safe)
    expect(first).toContain('<svg')
    expect(first).toContain('<polygon')
    expect(first).toContain('<text')
    expect(first).not.toContain('<script')
    expect(first).toBe(assessmentVisualSvgMarkup(safe))

    const marked = assessmentVisualSvgMarkup(ASSESSMENT_VISUAL_FIXTURES.marksAndLabels)
    expect(marked).toContain('stroke-dasharray="7 5"')
    expect(marked).toContain('<polyline')
    expect(marked).toContain('stroke-linejoin="round"')
  })

  it('draws validated primitives into the dedicated jsPDF document and rejects invalid visuals', () => {
    const visual = ASSESSMENT_VISUAL_FIXTURES.marksAndLabels
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    expect(drawAssessmentVisualPdf(doc, visual, { x: 40, y: 80, width: 360, height: 240 })).toBe(true)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(500)
    const pdf = doc.output()
    expect(pdf).toContain('] 0. d')
    expect(pdf).toContain('[] 0. d')

    const arrowOnly = { ...visual, primitives: visual.primitives.filter((primitive) => primitive.type === 'arrow') }
    const arrowDoc = new jsPDF({ unit: 'pt', format: 'a4' })
    expect(drawAssessmentVisualPdf(arrowDoc, arrowOnly, { x: 40, y: 80, width: 360, height: 240 })).toBe(true)
    const arrowStream = arrowDoc.output().slice(arrowDoc.output().indexOf('stream'), arrowDoc.output().indexOf('endstream'))
    // One shaft plus two deterministic wing segments are emitted for arrows.
    expect((arrowStream.match(/ m\n/g) ?? []).length).toBe(3)

    const invalid = { ...visual, primitives: [{ type: 'rawSvg', value: '<script>alert(1)</script>' }] } as never
    expect(drawAssessmentVisualPdf(doc, invalid, { x: 40, y: 80, width: 360, height: 240 })).toBe(false)
  })
})

describe('dedicated assessment export integration contract', () => {
  it('routes print and PDF through the validated visual primitives helper', () => {
    const exportSource = readFileSync(new URL('../../src/lib/assessmentExport.ts', import.meta.url), 'utf8')
    const exportModelSource = readFileSync(new URL('../../src/lib/assessmentExportModel.ts', import.meta.url), 'utf8')
    expect(exportSource).toMatch(/drawPdfVisual/u)
    expect(exportSource).toMatch(/printVisualMarkup/u)
    expect(exportModelSource).toMatch(/visual/u)
  })
})
