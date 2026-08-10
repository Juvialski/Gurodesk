import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { assessmentDuplicateLevel, assessmentSimilarityConcentration, assessmentVisualSemanticFindings, promptRequiresAssessmentVisual } from '../../src/lib/assessmentFinalQa'
import { normalizeAssessmentMathText, hasUnsupportedAssessmentMathMarkup } from '../../src/lib/assessmentMathText'
import { assessmentQuestionTypesAreContiguous, assessmentResponseKind, assessmentSectionTitle, assessmentUsesContiguousTypeSections, recommendedAssessmentResponseLines } from '../../src/lib/assessmentExportPresentation'
import { buildAssessmentDocxBlob } from '../../src/lib/assessmentExport'
import { buildAssessmentExportModel } from '../../src/lib/assessmentExportModel'
import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import type { AssessmentExportQuestion } from '../../src/types/assessmentExport'
import { assessmentItem, assessmentRecord } from './fixtures'

function exportQuestion(questionType: AssessmentExportQuestion['questionType'], overrides: Partial<AssessmentExportQuestion> = {}): AssessmentExportQuestion {
  return {
    itemNumber: 1,
    questionType,
    prompt: 'Question prompt',
    answerSpaceLines: 1,
    pointsPossible: 1,
    ...overrides,
  } as AssessmentExportQuestion
}

describe('assessment export presentation hardening', () => {
  it('normalizes the bounded historical TeX subset without executing arbitrary markup', () => {
    expect(normalizeAssessmentMathText('Find $\\angle ABC$ when $x=70^\\circ$.')).toBe('Find ∠ABC when x=70°.')
    expect(normalizeAssessmentMathText('Area is $6\\times4=24\\text{ cm}^2$.')).toContain('6×4=24 cm²')
    expect(normalizeAssessmentMathText('$\\frac{1}{2}$ of 8')).toBe('(1)/(2) of 8')
    expect(hasUnsupportedAssessmentMathMarkup('Use $\\unknown{q}$ here')).toBe(true)
  })

  it('builds Word as a native editable paper and embeds vector assessment diagrams', async () => {
    const visualItem = assessmentItem('multiple_choice', {
      id: 'word-visual', itemNumber: 1, prompt: 'Examine the polygon shown. How many sides does it have?',
      answer: { type: 'multiple_choice', choices: [{ id: 'A', text: '4' }, { id: 'B', text: '5' }, { id: 'C', text: '6' }], choiceId: 'B' },
      visual: ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon,
      authorshipState: 'teacher_accepted', qaState: 'locked', locked: true,
    })
    const matchingItem = assessmentItem('matching', {
      id: 'word-matching', itemNumber: 2, prompt: 'Match each term with its description.', pointsPossible: 2, points: 2,
      answer: { type: 'matching', prompts: [{ id: 'p1', text: 'Triangle' }, { id: 'p2', text: 'Quadrilateral' }], choices: [{ id: 'A', text: 'Three sides' }, { id: 'B', text: 'Four sides' }], mappings: [{ promptId: 'p1', choiceId: 'A' }, { promptId: 'p2', choiceId: 'B' }] },
      authorshipState: 'teacher_accepted', qaState: 'locked', locked: true,
    })
    const assessment = assessmentRecord([visualItem, matchingItem])
    assessment.status = 'final'
    assessment.settings = { ...assessment.settings!, allowedTypes: ['multiple_choice', 'matching'] }
    const model = buildAssessmentExportModel(assessment, { mode: 'student', teacherName: 'Teacher Test', schoolName: 'Sample School', region: 'Region III', division: 'Sample Division' })
    expect(model.questions[0].visual?.altText).toBe('A polygon outline with 5 vertices.')
    expect(model.questions[0].visual?.altText.toLocaleLowerCase('en')).not.toContain('irregular')
    expect(model.questions[0].visual?.altText.toLocaleLowerCase('en')).not.toContain('concave')
    const blob = await buildAssessmentDocxBlob(model, 'a4')
    const zip = new PizZip(await blob.arrayBuffer())
    const names = Object.keys(zip.files)
    expect(names.some((name) => /word\/media\/.*\.svg$/u.test(name))).toBe(true)
    const documentXml = zip.file('word/document.xml')?.asText() ?? ''
    expect(documentXml).toContain('Republic of the Philippines')
    expect(documentXml).toContain('Department of Education')
    expect(documentXml).toContain('Part I - Multiple Choice')
    expect(documentXml).toContain('Part II - Matching Type')
    expect(documentXml).toContain('Sample School')
    expect(documentXml).not.toContain('[Diagram:')
  })

  it('uses type-specific student response controls and point-aware writing space', () => {
    expect(assessmentResponseKind(exportQuestion('true_false'))).toBe('true_false')
    expect(assessmentResponseKind(exportQuestion('fill_in_the_blank', { prompt: 'A hexagon has ____ sides.', blanks: [{ label: 'A' }] }))).toBe('fill_inline')
    expect(assessmentResponseKind(exportQuestion('fill_in_the_blank', { prompt: 'Complete both values.', blanks: [{ label: 'A' }, { label: 'B' }] }))).toBe('fill_structured')
    expect(recommendedAssessmentResponseLines(exportQuestion('essay', { pointsPossible: 10 }))).toBeGreaterThanOrEqual(10)
    expect(recommendedAssessmentResponseLines(exportQuestion('constructed_response', { pointsPossible: 2 }))).toBeGreaterThanOrEqual(3)
    expect(assessmentSectionTitle('multiple_choice', 0)).toBe('Part I - Multiple Choice')
    expect(assessmentUsesContiguousTypeSections([exportQuestion('multiple_choice'), exportQuestion('multiple_choice'), exportQuestion('true_false')])).toBe(true)
    expect(assessmentUsesContiguousTypeSections([exportQuestion('multiple_choice'), exportQuestion('true_false'), exportQuestion('multiple_choice')])).toBe(false)
    expect(assessmentQuestionTypesAreContiguous([exportQuestion('multiple_choice'), exportQuestion('multiple_choice')])).toBe(true)
    expect(assessmentQuestionTypesAreContiguous([exportQuestion('multiple_choice'), exportQuestion('true_false'), exportQuestion('multiple_choice')])).toBe(false)
  })
})

describe('deterministic final assessment QA hardening', () => {
  it('blocks missing required visuals and deterministic polygon contradictions', () => {
    expect(promptRequiresAssessmentVisual('Examine the polygon shown in the visual.')).toBe(true)
    const missing = assessmentItem('identification', { prompt: 'Examine the polygon shown in the visual and name it.', answer: { type: 'identification', acceptedAnswers: ['pentagon'] } })
    expect(assessmentVisualSemanticFindings(missing).some((issue) => issue.code === 'required-visual-missing' && issue.severity === 'error')).toBe(true)

    const contradiction = assessmentItem('identification', {
      prompt: 'The irregular non-convex pentagon shown in the visual is _____.',
      answer: { type: 'identification', acceptedAnswers: ['pentagon'] },
      visual: ASSESSMENT_VISUAL_FIXTURES.regularHexagon,
    })
    const codes = assessmentVisualSemanticFindings(contradiction).map((issue) => issue.code)
    expect(codes).toContain('visual-side-count-mismatch')

    const missingLabels = assessmentItem('problem_solving', {
      prompt: 'Based on the provided diagram, determine ∠ABC and ∠CBD.',
      answer: { type: 'problem_solving', finalAnswer: '110°', solutionOutline: 'Use a linear pair.', subparts: [] },
      visual: ASSESSMENT_VISUAL_FIXTURES.regularHexagon,
    })
    expect(assessmentVisualSemanticFindings(missingLabels).some((issue) => issue.code === 'visual-label-mismatch' && issue.severity === 'error')).toBe(true)
  })

  it('blocks accepted answers leaked through visual labels or accessibility text', () => {
    const baseVisual = ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon
    const leak = assessmentItem('identification', {
      prompt: 'Name the polygon shown in the diagram.',
      answer: { type: 'identification', acceptedAnswers: ['pentagon'], caseSensitive: false },
      visual: {
        ...baseVisual,
        altText: 'A five-sided polygon outline with labeled vertices.',
        primitives: [...baseVisual.primitives, { type: 'textLabel', x: 160, y: 18, text: 'Pentagon', textSize: 'medium', anchor: 'middle' }],
      },
    })
    expect(assessmentVisualSemanticFindings(leak)).toContainEqual(expect.objectContaining({ code: 'visual-answer-leak', severity: 'error' }))

    const altLeak = { ...leak, visual: { ...leak.visual!, altText: 'A pentagon outline.', primitives: baseVisual.primitives } }
    expect(assessmentVisualSemanticFindings(altLeak)).toContainEqual(expect.objectContaining({ code: 'visual-answer-leak', severity: 'error' }))
  })

  it('distinguishes exact/strong duplicates from ordinary topic similarity', () => {
    const base = assessmentItem('multiple_choice', {
      id: 'a', itemNumber: 1, prompt: 'When drawing a regular pentagon, what is the measure of each interior angle?',
      answer: { type: 'multiple_choice', choices: [{ id: 'a', text: '90°' }, { id: 'b', text: '108°' }], choiceId: 'b' }, authorshipState: 'teacher_accepted',
    })
    const exact = { ...base, id: 'b', itemNumber: 2 }
    const strong = { ...base, id: 'c', itemNumber: 3, prompt: 'What should each interior angle measure when accurately constructing a regular pentagon?' }
    expect(assessmentDuplicateLevel(base, exact)).toBe('exact')
    expect(['strong', 'similar']).toContain(assessmentDuplicateLevel(base, strong))
  })

  it('flags point concentration only when a related cluster carries a large share', () => {
    const related = Array.from({ length: 3 }, (_, index) => assessmentItem('essay', {
      id: `r-${index}`, itemNumber: index + 1, pointsPossible: 10,
      prompt: `Explain the relationship between an exterior angle and its adjacent interior angle${index ? ` in case ${index + 1}` : ''}.`,
      answer: { type: 'essay', keyPoints: ['supplementary', '180 degrees'] }, authorshipState: 'teacher_accepted',
    }))
    const other = assessmentItem('multiple_choice', { id: 'o', itemNumber: 4, pointsPossible: 20, prompt: 'Which polygon has eight sides?', answer: { type: 'multiple_choice', choices: [{ id: 'a', text: 'octagon' }, { id: 'b', text: 'hexagon' }], choiceId: 'a' }, authorshipState: 'teacher_accepted' })
    const result = assessmentSimilarityConcentration([...related, other])
    expect(result?.itemNumbers).toEqual([1, 2, 3])
    expect(result?.share).toBeGreaterThanOrEqual(0.5)
  })
})
