import { describe, expect, it } from 'vitest'
import { assessmentVisualSemanticFindings } from '../../src/lib/assessmentFinalQa'
import { assessmentVisualTikzSource } from '../../src/lib/assessmentTikz'
import { cacheAssessmentTikzRenderedSvg } from '../../src/lib/assessmentTikzRenderCache'
import { validateAssessmentTikzSource } from '../../src/lib/assessmentTikzSafety'
import { assessmentVisualSvgMarkup } from '../../src/lib/assessmentVisualExport'
import { validateAssessmentVisual } from '../../src/lib/assessmentVisualValidation'
import type { AssessmentVisual } from '../../src/types/assessmentVisual'
import { assessmentItem } from './fixtures'

const tikz = String.raw`\begin{tikzpicture}
\path[use as bounding box] (0,0) rectangle (10,6);
\draw[thick] (2,1) -- (8,1) -- (5,5) -- cycle;
\node[below] at (2,1) {A};
\node[below] at (8,1) {B};
\node[above] at (5,5) {C};
\end{tikzpicture}`

function directVisual(source = tikz): AssessmentVisual {
  return { id: 'direct-tikz', kind: 'geometry', version: 1, width: 600, height: 360, altText: 'A mathematical diagram accompanying the question.', tikzCode: source, primitives: [] }
}

describe('Gemini direct TikZ visuals', () => {
  it('accepts one bounded TikZ picture and makes it the primary renderer source', () => {
    expect(validateAssessmentTikzSource(tikz)).toEqual({ valid: true, source: tikz, errors: [] })
    const visual = directVisual()
    expect(validateAssessmentVisual(visual)).toEqual({ valid: true, errors: [] })
    expect(assessmentVisualTikzSource(visual)).toBe(tikz)
  })

  it('blocks package loading, macros, loops, and multiple-document payloads', () => {
    expect(validateAssessmentTikzSource(String.raw`\begin{tikzpicture}\input{secret}\draw (0,0)--(1,1);\end{tikzpicture}`).valid).toBe(false)
    expect(validateAssessmentTikzSource(String.raw`\begin{tikzpicture}\foreach \x in {1,2} {\draw (\x,0)--(\x,1);}\end{tikzpicture}`).valid).toBe(false)
    expect(validateAssessmentTikzSource(String.raw`\documentclass{article}\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}`).valid).toBe(false)
  })

  it('checks learner-visible TikZ node text for answer leaks without treating coordinates as labels', () => {
    const safe = assessmentItem('identification', {
      prompt: 'Name the polygon shown in the diagram.',
      answer: { type: 'identification', acceptedAnswers: ['pentagon'], caseSensitive: false },
      visual: directVisual(),
    })
    expect(assessmentVisualSemanticFindings(safe).some((issue) => issue.code === 'visual-answer-leak')).toBe(false)

    const leaked = assessmentItem('identification', {
      prompt: 'Name the polygon shown in the diagram.',
      answer: { type: 'identification', acceptedAnswers: ['pentagon'], caseSensitive: false },
      visual: directVisual(tikz.replace('{C};', '{Pentagon};')),
    })
    expect(assessmentVisualSemanticFindings(leaked)).toContainEqual(expect.objectContaining({ code: 'visual-answer-leak', severity: 'error' }))
  })

  it('exports the exact sanitized TikZJax SVG once the sandbox renderer has cached it', () => {
    const visual = directVisual()
    expect(assessmentVisualSvgMarkup(visual)).toBe('')
    const rendered = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><path d="M 1 1 L 599 359"/></svg>'
    cacheAssessmentTikzRenderedSvg(visual, rendered)
    expect(assessmentVisualSvgMarkup(visual)).toBe(rendered)
  })
})
