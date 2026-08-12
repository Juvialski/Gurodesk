import { describe, expect, it } from 'vitest'
import { assessmentVisualSemanticFindings } from '../../src/lib/assessmentFinalQa'
import { reserveAssessmentRequiredVisualSlots, resolveAssessmentVisualPlans, resolveAssessmentVisualPlansForRecord } from '../../src/lib/assessmentVisualPlanning'
import { extractAssessmentTikzNodeTexts, normalizeAssessmentTikzLearnerText, validateAssessmentTikzSource } from '../../src/lib/assessmentTikzSafety'
import { cacheAssessmentTikzRenderedSvg, sanitizeAssessmentTikzSvg, waitForAssessmentTikzRenders } from '../../src/lib/assessmentTikzRenderCache'
import type { AssessmentAnswer, AssessmentItem } from '../../src/types/assessment'
import type { AssessmentVisual } from '../../src/types/assessmentVisual'
import { assessmentItem, assessmentRecord } from './fixtures'

function emptyMathItems(count: number) {
  return Array.from({ length: count }, (_, index) => assessmentItem('multiple_choice', {
    id: `slot-${index + 1}`,
    itemNumber: index + 1,
    competencySnapshot: {
      ...assessmentItem().competencySnapshot,
      id: `geometry-${(index % 4) + 1}`,
      text: `Analyze angle relationships in parallel lines, competency ${(index % 4) + 1}`,
    },
    mapping: { ...assessmentItem().mapping, allocationIndex: index, allocationItemStart: index + 1, allocationItemEnd: index + 1 },
  }))
}

function authoredMathItems(count: number) {
  return emptyMathItems(count).map((item, index) => ({
    ...item,
    prompt: `Determine the angle relationship for case ${index + 1} with value ${index + 10}.`,
    authorshipState: 'teacher_accepted' as const,
    qaState: 'verified' as const,
  }))
}

function directVisual(label: string): AssessmentVisual {
  return {
    id: `visual-${label}`,
    kind: 'geometry',
    version: 1,
    width: 600,
    height: 360,
    altText: 'A mathematical diagram.',
    tikzCode: String.raw`\begin{tikzpicture}
\draw (0,0) -- (4,0) -- (2,3) -- cycle;
\node[above] at (2,3) {${label}};
\end{tikzpicture}`,
    primitives: [],
  }
}

function itemWithAnswer(questionType: AssessmentItem['questionType'], answer: AssessmentAnswer, label: string) {
  return assessmentItem(questionType, {
    prompt: 'Use the diagram shown to answer the question.',
    answer,
    visual: directVisual(label),
    visualRequirement: 'required',
    visualStatus: 'succeeded',
    authorshipState: 'teacher_accepted',
    qaState: 'verified',
  })
}

describe('visual policy and reservation reliability', () => {
  it.each([
    [1, 0], [2, 0], [3, 0], [5, 1], [10, 2], [20, 5], [40, 10],
  ])('Balanced reserves at most about one required diagram per four items: %i -> %i', (count, expected) => {
    const result = reserveAssessmentRequiredVisualSlots(emptyMathItems(count), { learningArea: 'Mathematics', visualPolicy: 'balanced' })
    expect(result.budget).toBe(expected)
    expect(result.reservedItemIds).toHaveLength(expected)
  })

  it('keeps definition-style Mathematics questions text-only when a geometry noun is merely mentioned', () => {
    const item = assessmentItem('short_answer', {
      id: 'math-circle-definition',
      prompt: 'What is a circle?',
      competencySnapshot: { ...assessmentItem().competencySnapshot, text: 'Define a circle and its basic meaning.' },
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
    })
    const balance = resolveAssessmentVisualPlans([item], { learningArea: 'Mathematics', visualPolicy: 'more_visuals' })
    expect(balance.requiredItemIds).toEqual([])
    expect(balance.optionalItemIds).toEqual([])
    expect(balance.items[0].visualRequirement).toBe('none')
  })

  it('does not treat English reflection or language translation as mathematical visual dependencies', () => {
    const english = assessmentItem('short_answer', {
      id: 'english-reflection',
      competencySnapshot: { ...assessmentItem().competencySnapshot, text: 'Write a reflection on the translation of the passage.' },
    })
    const language = assessmentItem('short_answer', {
      id: 'language-translation',
      competencySnapshot: { ...assessmentItem().competencySnapshot, text: 'Translate a short passage and explain the meaning.' },
    })
    expect(reserveAssessmentRequiredVisualSlots([english], { learningArea: 'English', visualPolicy: 'more_visuals' }).reservedItemIds).toEqual([])
    expect(reserveAssessmentRequiredVisualSlots([language], { learningArea: 'Filipino', visualPolicy: 'more_visuals' }).reservedItemIds).toEqual([])
  })

  it('honors Off, Balanced, and More visuals without changing explicit learner dependencies', () => {
    const slots = emptyMathItems(20)
    expect(reserveAssessmentRequiredVisualSlots(slots, { learningArea: 'Mathematics', visualPolicy: 'off' }).budget).toBe(0)
    expect(reserveAssessmentRequiredVisualSlots(slots, { learningArea: 'Mathematics', visualPolicy: 'balanced' }).budget).toBe(5)
    expect(reserveAssessmentRequiredVisualSlots(slots, { learningArea: 'Mathematics', visualPolicy: 'more_visuals' }).budget).toBe(10)

    const teacherAuthored = assessmentItem('multiple_choice', {
      prompt: 'Use the diagram shown to determine the marked angle.',
      authorshipState: 'manual',
      qaState: 'teacher_edited',
    })
    const resolved = resolveAssessmentVisualPlans([teacherAuthored], { learningArea: 'English', visualPolicy: 'off' })
    expect(resolved.requiredItemIds).toEqual([teacherAuthored.id])
    expect(resolved.items[0].visualRequirement).toBe('required')
  })

  it('spreads selected visuals across the paper and competencies instead of taking the first eligible items', () => {
    const result = reserveAssessmentRequiredVisualSlots(emptyMathItems(20), { learningArea: 'Mathematics', visualPolicy: 'balanced' })
    const numbers = result.items.filter((item) => result.reservedItemIds.includes(item.id)).map((item) => item.itemNumber)
    const competencyIds = new Set(result.items.filter((item) => result.reservedItemIds.includes(item.id)).map((item) => item.competencySnapshot.id))
    expect(numbers).toHaveLength(5)
    expect(numbers[0]).toBeGreaterThan(1)
    expect(numbers.at(-1)).toBeGreaterThanOrEqual(15)
    expect(competencyIds.size).toBeGreaterThanOrEqual(3)
  })

  it.each(['final', 'archived'] as const)('never re-plans an immutable %s assessment', (status) => {
    const original = authoredMathItems(8)
    const record = { ...assessmentRecord(original), status }
    const resolved = resolveAssessmentVisualPlansForRecord(record)
    expect(resolved.items).toEqual(original)
    expect(resolved.requiredItemIds).toEqual([])
    expect(resolved.optionalItemIds).toEqual([])
  })

  it('also spreads optional authored candidates and preserves an existing manual visual when automatic visuals are Off', () => {
    const balanced = resolveAssessmentVisualPlans(authoredMathItems(20), { learningArea: 'Mathematics', visualPolicy: 'balanced' })
    const numbers = balanced.items.filter((item) => balanced.optionalItemIds.includes(item.id)).map((item) => item.itemNumber)
    expect(numbers).toHaveLength(5)
    expect(numbers[0]).toBeGreaterThan(1)
    expect(numbers.at(-1)).toBeGreaterThanOrEqual(15)

    const manual = assessmentItem('short_answer', {
      id: 'manual-visual',
      prompt: 'Explain your observation.',
      answer: { type: 'short_answer', acceptedAnswers: ['sample'], caseSensitive: false },
      visual: directVisual('A'),
      visualRequirement: 'helpful',
      visualStatus: 'succeeded',
      authorshipState: 'manual',
      qaState: 'teacher_edited',
    })
    const off = resolveAssessmentVisualPlans([manual], { learningArea: 'Science', visualPolicy: 'off' })
    expect(off.items[0].visual).toEqual(manual.visual)
    expect(off.items[0].visualStatus).toBe('succeeded')
  })
})

describe('brace-aware TikZ labels and answer-leak detection', () => {
  it('extracts and normalizes nested formatted, math-mode, Unicode, punctuation, and multiword labels', () => {
    const source = String.raw`\begin{tikzpicture}
\draw (0,0)--(2,0);
\node at (1,1) {\textbf{Regular \mathrm{Pentagon}}};
\node at (1,0) {$\frac{1}{2}$};
\node at (0,0) {Área: 25 m²!};
\end{tikzpicture}`
    const labels = extractAssessmentTikzNodeTexts(source).map(normalizeAssessmentTikzLearnerText)
    expect(labels).toContain('Regular Pentagon')
    expect(labels).toContain('1 / 2')
    expect(labels).toContain('Área: 25 m²!')
  })

  it.each([
    ['identification', { type: 'identification', acceptedAnswers: ['Pentagon'], caseSensitive: false } as AssessmentAnswer, String.raw`\textbf{PENTAGON}`],
    ['short_answer', { type: 'short_answer', acceptedAnswers: ['parallel lines'], caseSensitive: false } as AssessmentAnswer, String.raw`\mathrm{parallel lines}.`],
    ['fill_in_the_blank', { type: 'fill_in_the_blank', blanks: [{ id: 'b1', acceptedAnswers: ['translation'] }] } as AssessmentAnswer, 'Translation'],
    ['multiple_choice', { type: 'multiple_choice', choices: [{ id: 'a', text: '42' }, { id: 'b', text: '41' }], choiceId: 'a' } as AssessmentAnswer, '42'],
    ['multiple_select', { type: 'multiple_select', choices: [{ id: 'a', text: 'Acute' }, { id: 'b', text: 'Obtuse' }], choiceIds: ['a'] } as AssessmentAnswer, 'Acute'],
    ['numerical_answer', { type: 'numerical_answer', value: 12.5, unit: 'cm' } as AssessmentAnswer, '12.5'],
    ['problem_solving', { type: 'problem_solving', finalAnswer: '1 / 2', solutionOutline: 'Simplify.' } as AssessmentAnswer, String.raw`\frac{1}{2}`],
  ] as const)('flags learner-visible answer leakage for %s', (questionType, answer, label) => {
    const item = itemWithAnswer(questionType, answer, label)
    expect(assessmentVisualSemanticFindings(item)).toContainEqual(expect.objectContaining({ code: 'visual-answer-leak', severity: 'error' }))
  })

  it('does not treat drawing coordinates as learner-visible numerical labels', () => {
    const item = itemWithAnswer('numerical_answer', { type: 'numerical_answer', value: 42 }, 'A')
    item.visual = directVisual('A')
    item.visual.tikzCode = String.raw`\begin{tikzpicture}\draw (42,0)--(1,1);\node at (1,1) {A};\end{tikzpicture}`
    expect(assessmentVisualSemanticFindings(item).some((finding) => finding.code === 'visual-answer-leak')).toBe(false)
  })
})

describe('TikZ and rendered SVG safety boundaries', () => {
  it('accepts the supported textbook subset and rejects macros, loops, external access, excessive coordinates, and unknown environments', () => {
    const safe = String.raw`\begin{tikzpicture}\draw[thick] (0,0)--(4,0);\draw (2,0) arc[start angle=180,end angle=0,radius=1];\node[above] at (2,1) {$45^\circ$};\end{tikzpicture}`
    expect(validateAssessmentTikzSource(safe).valid).toBe(true)
    expect(validateAssessmentTikzSource(String.raw`\begin{tikzpicture}\newcommand{\x}{1}\draw (0,0)--(1,1);\end{tikzpicture}`).valid).toBe(false)
    expect(validateAssessmentTikzSource(String.raw`\begin{tikzpicture}\foreach \x in {1,2}{\draw (\x,0)--(\x,1);}\end{tikzpicture}`).valid).toBe(false)
    expect(validateAssessmentTikzSource(String.raw`\begin{tikzpicture}\node at (0,0) {https://example.com};\draw (0,0)--(1,1);\end{tikzpicture}`).valid).toBe(false)
    expect(validateAssessmentTikzSource(String.raw`\begin{axis}\draw (0,0)--(1,1);\end{axis}`).valid).toBe(false)
    expect(validateAssessmentTikzSource(String.raw`\begin{tikzpicture}\draw (2001,0)--(1,1);\end{tikzpicture}`).valid).toBe(false)
  })

  it('uses stable SVG readiness for print and DOCX while keeping PDF dependent on rasterization', async () => {
    const visual = directVisual('A')
    cacheAssessmentTikzRenderedSvg(visual, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>')
    expect(await waitForAssessmentTikzRenders([visual], 'print', 0)).toBe(true)
    expect(await waitForAssessmentTikzRenders([visual], 'docx', 0)).toBe(true)
    // Node tests have no browser canvas/Image, so a PNG cannot appear. This
    // proves PDF readiness does not incorrectly fall back to SVG-only state.
    expect(await waitForAssessmentTikzRenders([visual], 'pdf', 0)).toBe(false)
  })

  it('sanitizes safe SVG with a DOM allowlist and rejects active/remote/unsupported SVG content', () => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><path id="p1" d="M0 0L1 1"/></defs><use href="#p1"/><text x="2" y="3">A</text></svg>'
    expect(sanitizeAssessmentTikzSvg(safe)).toContain('<svg')
    expect(sanitizeAssessmentTikzSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toBe('')
    expect(sanitizeAssessmentTikzSvg('<svg xmlns="http://www.w3.org/2000/svg"><path onclick="alert(1)" d="M0 0L1 1"/></svg>')).toBe('')
    expect(sanitizeAssessmentTikzSvg('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>')).toBe('')
    expect(sanitizeAssessmentTikzSvg('<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/x.svg#p"/></svg>')).toBe('')
    expect(sanitizeAssessmentTikzSvg('<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://example.com/a)" d="M0 0L1 1"/></svg>')).toBe('')
    expect(sanitizeAssessmentTikzSvg('<?xml-stylesheet href="https://example.com/a.css"?><svg xmlns="http://www.w3.org/2000/svg"/>')).toBe('')
    expect(sanitizeAssessmentTikzSvg('<svg xmlns="http://www.w3.org/2000/svg" xmlns:evil="https://example.com"><evil:x/></svg>')).toBe('')
  })
})
