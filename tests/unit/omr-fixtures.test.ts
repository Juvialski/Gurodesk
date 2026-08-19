import { describe, expect, it } from 'vitest'
import { generateAnswerSheetLayout } from '../../src/lib/answerSheet/layoutEngine'
import { processAnswerSheetImage } from '../../src/lib/omr/omrEngine'
import { encodeAnswerSheetQrPayload } from '../../src/lib/answerSheet/qrPayload'
import type { AssessmentBlueprint } from '../../src/types/assessment'
import { createSyntheticAnswerSheetImage } from './omr-synthetic-fixtures'

function createMixedAssessment(): AssessmentBlueprint {
  const comp = (id: string, code: string, text: string) => ({
    id,
    code,
    text,
    sourcePage: 1,
    academicPeriodId: 'q1',
    curriculumPeriodId: 'q1',
    curriculumPeriodLabel: 'Quarter 1',
  })

  return {
    id: 'asm-mixed-fixture-202',
    userId: 'teacher-mixed-1',
    assignmentId: 'assign-mixed-1',
    title: 'Grade 10 English Summative Test',
    instructions: 'Follow directions for each section carefully.',
    gradeLevel: '10',
    learningArea: 'English',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: 5,
    items: [
      // 1. Multiple Choice
      {
        id: 'item-1',
        itemNumber: 1,
        questionType: 'multiple_choice',
        prompt: 'What is the main theme?',
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c1', 'EN10-1', 'Theme'),
        cognitiveCategorySnapshot: { id: 'cog-1', label: 'Remembering', shortLabel: 'Rem' },
        mapping: { rowId: 'r1', competencyId: 'c1', cognitiveCategoryId: 'cog-1', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 1 },
        answer: {
          type: 'multiple_choice',
          choices: [
            { id: 'c1', text: 'Option A' },
            { id: 'c2', text: 'Option B' },
            { id: 'c3', text: 'Option C' },
            { id: 'c4', text: 'Option D' },
          ],
          choiceId: 'c2',
        },
      },
      // 2. True / False
      {
        id: 'item-2',
        itemNumber: 2,
        questionType: 'true_false',
        prompt: 'The protagonist is dynamic.',
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c1', 'EN10-1', 'Character'),
        cognitiveCategorySnapshot: { id: 'cog-1', label: 'Understanding', shortLabel: 'Und' },
        mapping: { rowId: 'r1', competencyId: 'c1', cognitiveCategoryId: 'cog-1', allocationItemStart: 2, allocationItemEnd: 2, allocationIndex: 2 },
        answer: { type: 'true_false', value: true },
      },
      // 3. Multiple Select
      {
        id: 'item-3',
        itemNumber: 3,
        questionType: 'multiple_select',
        prompt: 'Select all figures of speech used.',
        pointsPossible: 2,
        points: 2,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c2', 'EN10-2', 'Figures of speech'),
        cognitiveCategorySnapshot: { id: 'cog-2', label: 'Analyzing', shortLabel: 'Ana' },
        mapping: { rowId: 'r2', competencyId: 'c2', cognitiveCategoryId: 'cog-2', allocationItemStart: 3, allocationItemEnd: 3, allocationIndex: 3 },
        answer: {
          type: 'multiple_select',
          choices: [
            { id: 'ms1', text: 'Metaphor' },
            { id: 'ms2', text: 'Simile' },
            { id: 'ms3', text: 'Hyperbole' },
            { id: 'ms4', text: 'Personification' },
          ],
          choiceIds: ['ms1', 'ms3'],
        },
      },
      // 4. Short Answer (Manual Teacher Scoring)
      {
        id: 'item-4',
        itemNumber: 4,
        questionType: 'short_answer',
        prompt: 'Explain the symbol of the green light.',
        pointsPossible: 3,
        points: 3,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c3', 'EN10-3', 'Analysis'),
        cognitiveCategorySnapshot: { id: 'cog-3', label: 'Evaluating', shortLabel: 'Eva' },
        mapping: { rowId: 'r3', competencyId: 'c3', cognitiveCategoryId: 'cog-3', allocationItemStart: 4, allocationItemEnd: 4, allocationIndex: 4 },
        answer: { type: 'short_answer', acceptedAnswers: ['Hope and dreams'] },
      },
      // 5. Essay (Manual Teacher Scoring)
      {
        id: 'item-5',
        itemNumber: 5,
        questionType: 'essay',
        prompt: 'Write an essay comparing characters.',
        pointsPossible: 5,
        points: 5,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c4', 'EN10-4', 'Extended writing'),
        cognitiveCategorySnapshot: { id: 'cog-4', label: 'Creating', shortLabel: 'Cre' },
        mapping: { rowId: 'r4', competencyId: 'c4', cognitiveCategoryId: 'cog-4', allocationItemStart: 5, allocationItemEnd: 5, allocationIndex: 5 },
        answer: { type: 'essay', keyPoints: ['Character growth', 'Thematic depth'], rubric: [{ id: 'crit-1', label: 'Content', pointsPossible: 5, description: 'Depth' }] },
      },
    ],
    versionNumber: 1,
    status: 'final',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

describe('OMR Test Fixtures & Comprehensive Scenario Matrix', () => {
  it('Fixture 1: Perfect Clean Sheet with multiple question types', () => {
    const assessment = createMixedAssessment()
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: {
        1: 'B',
        2: 'T',
        3: ['A', 'C'], // Multiple select: options 1 & 3 ('A' and 'C')
      },
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('SUCCESS')
    expect(result.summary.totalQuestions).toBe(5)
    expect(result.summary.machineScanned).toBe(3)
    expect(result.summary.manualScoringCount).toBe(2)
    expect(result.summary.filledCount).toBe(3)
    expect(result.summary.needsReviewCount).toBe(0)

    const item1 = result.recognizedItems[0]
    expect(item1.isMachineCheckable).toBe(true)
    expect(item1.selectedLabels).toEqual(['B'])

    const item3 = result.recognizedItems[2]
    expect(item3.questionType).toBe('multiple_select')
    expect(item3.selectedLabels).toEqual(['A', 'C'])

    const item4 = result.recognizedItems[3]
    expect(item4.isMachineCheckable).toBe(false)
    expect(item4.needsReview).toBe(false)
  })

  it('Fixture 2: Completely Blank Sheet (all items omitted)', () => {
    const assessment = createMixedAssessment()
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: {},
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('SUCCESS')
    expect(result.summary.filledCount).toBe(0)
    expect(result.summary.emptyCount).toBe(3)
    expect(result.summary.needsReviewCount).toBe(0)
  })

  it('Fixture 3: Erased Answer with ghost residue (ambiguous mark safety)', () => {
    const assessment = createMixedAssessment()
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    // Student filled 'A' but erased it leaving 25% residue
    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: { 1: 'A' },
      markDarkness: { 1: 0.25 },
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('NEEDS_REVIEW')
    expect(result.needsReview).toBe(true)
    const item1 = result.recognizedItems[0]
    expect(item1.state).toBe('AMBIGUOUS')
    expect(item1.needsReview).toBe(true)
  })

  it('Fixture 4: Damaged or Cropped Corners (missing bottom-right fiducial)', () => {
    const assessment = createMixedAssessment()
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    const image = createSyntheticAnswerSheetImage(sheet, {
      omitBottomRightMarker: true,
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('MARKERS_NOT_FOUND')
  })

  it('Fixture 5: Unreadable or Corrupt QR code payload', () => {
    const assessment = createMixedAssessment()
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })
    const image = createSyntheticAnswerSheetImage(sheet, {})

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      scannedQrPayload: 'CORRUPTED_PAYLOAD_NOT_GURODESK',
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('UNREADABLE_QR')
    expect(result.errorMessage).toContain('Not a GuroDesk Smart Answer Sheet QR code')
  })

  it('Fixture 6: Personalized Sheet Recognition with Learner ID from QR', () => {
    const assessment = createMixedAssessment()
    const sheet = generateAnswerSheetLayout(assessment, {
      mode: 'personalized',
      learner: {
        id: 'learner-uuid-999',
        displayName: 'Santos, Maria Clara',
        localReference: '123456789012',
      },
    })

    const personalizedQr = encodeAnswerSheetQrPayload({
      assessmentId: 'asm-mixed-fixture-202',
      assessmentVersion: 1,
      mode: 'personalized',
      learnerId: 'learner-uuid-999',
    })

    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: { 1: 'C', 2: 'F' },
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      scannedQrPayload: personalizedQr,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    expect(result.mode).toBe('personalized')
    expect(result.learnerId).toBe('learner-uuid-999')
    expect(result.recognizedItems[0].selectedLabels).toEqual(['C'])
    expect(result.recognizedItems[1].trueFalseValue).toBe(false)
  })
})
