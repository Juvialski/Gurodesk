import { describe, expect, it } from 'vitest'
import { generateAnswerSheetLayout } from '../../src/lib/answerSheet/layoutEngine'
import { computeImageFingerprint, processAnswerSheetImage } from '../../src/lib/omr/omrEngine'
import { encodeAnswerSheetQrPayload } from '../../src/lib/answerSheet/qrPayload'
import type { AssessmentBlueprint } from '../../src/types/assessment'
import { createSyntheticAnswerSheetImage } from './omr-synthetic-fixtures'

function createSampleAssessment(totalItems = 20): AssessmentBlueprint {
  return {
    id: 'asm-omr-test-101',
    userId: 'teacher-omr-1',
    assignmentId: 'assign-omr-1',
    title: 'Grade 9 Science Quarterly Exam',
    instructions: 'Shade the correct circle on your answer sheet.',
    gradeLevel: '9',
    learningArea: 'Science',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems,
    items: Array.from({ length: totalItems }, (_, i) => {
      const num = i + 1
      const isTf = num % 4 === 0
      return {
        id: `item-${num}`,
        itemNumber: num,
        questionType: isTf ? 'true_false' : 'multiple_choice',
        prompt: `Question ${num}`,
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: {
          id: 'comp-1',
          code: 'S9LT-I-1',
          text: 'Science comp',
          sourcePage: 1,
          academicPeriodId: 'q1',
          curriculumPeriodId: 'q1',
          curriculumPeriodLabel: 'Quarter 1',
        },
        cognitiveCategorySnapshot: {
          id: 'cog-1',
          label: 'Applying',
          shortLabel: 'App',
        },
        mapping: {
          rowId: 'row-1',
          competencyId: 'comp-1',
          cognitiveCategoryId: 'cog-1',
          allocationItemStart: num,
          allocationItemEnd: num,
          allocationIndex: 1,
        },
        answer: isTf
          ? { type: 'true_false', value: true }
          : {
              type: 'multiple_choice',
              choices: [
                { id: 'c1', text: 'Option A' },
                { id: 'c2', text: 'Option B' },
                { id: 'c3', text: 'Option C' },
                { id: 'c4', text: 'Option D' },
              ],
              choiceId: 'c1',
            },
      }
    }),
    versionNumber: 1,
    status: 'final',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

describe('Local OMR Scanner Engine', () => {
  it('accurately scans a clean sheet with 100% precision on single-choice answers', () => {
    const assessment = createSampleAssessment(10)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    // Synthetic answers: Item 1: 'A', Item 2: 'C', Item 3: 'B', Item 4 (TF): 'T', Item 5: 'D'
    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: {
        1: 'A',
        2: 'C',
        3: 'B',
        4: 'T',
        5: 'D',
      },
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('SUCCESS')
    expect(result.needsReview).toBe(false)
    expect(result.summary.filledCount).toBe(5)
    expect(result.summary.emptyCount).toBe(5)
    expect(result.summary.needsReviewCount).toBe(0)

    const item1 = result.recognizedItems.find((item) => item.itemNumber === 1)!
    expect(item1.state).toBe('FILLED')
    expect(item1.selectedLabels).toEqual(['A'])
    expect(item1.needsReview).toBe(false)

    const item2 = result.recognizedItems.find((item) => item.itemNumber === 2)!
    expect(item2.state).toBe('FILLED')
    expect(item2.selectedLabels).toEqual(['C'])

    const item4 = result.recognizedItems.find((item) => item.itemNumber === 4)!
    expect(item4.state).toBe('FILLED')
    expect(item4.trueFalseValue).toBe(true)

    // Unanswered item 6 should be EMPTY with no review needed
    const item6 = result.recognizedItems.find((item) => item.itemNumber === 6)!
    expect(item6.state).toBe('EMPTY')
    expect(item6.selectedLabels).toEqual([])
    expect(item6.needsReview).toBe(false)
  })

  it('detects faint pencil marks or partial erasures and flags needsReview = true without guessing', () => {
    const assessment = createSampleAssessment(5)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    // Item 1: faint mark (0.28 darkness)
    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: { 1: 'B' },
      markDarkness: { 1: 0.28 },
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('NEEDS_REVIEW')
    expect(result.needsReview).toBe(true)

    const item1 = result.recognizedItems.find((item) => item.itemNumber === 1)!
    expect(item1.state).toBe('AMBIGUOUS')
    expect(item1.needsReview).toBe(true)
    expect(item1.reviewReason).toContain('Faint or partially erased')
  })

  it('detects double/multiple marks and flags MULTIPLE with needsReview = true', () => {
    const assessment = createSampleAssessment(5)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    // Item 2: double marked ('A' and 'C')
    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: {
        2: ['A', 'C'],
      },
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.status).toBe('NEEDS_REVIEW')
    const item2 = result.recognizedItems.find((item) => item.itemNumber === 2)!
    expect(item2.state).toBe('MULTIPLE')
    expect(item2.selectedLabels).toEqual(['A', 'C'])
    expect(item2.needsReview).toBe(true)
    expect(item2.reviewReason).toContain('Multiple answers detected')
  })

  it('handles shadow gradients across the page through local background contrast normalization', () => {
    const assessment = createSampleAssessment(10)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: { 1: 'A', 5: 'C', 10: 'D' },
      addShadowGradient: true,
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(true)
    const item1 = result.recognizedItems.find((item) => item.itemNumber === 1)!
    const item10 = result.recognizedItems.find((item) => item.itemNumber === 10)!

    expect(item1.state).toBe('FILLED')
    expect(item1.selectedLabels).toEqual(['A'])
    expect(item10.state).toBe('FILLED')
    expect(item10.selectedLabels).toEqual(['D'])
  })

  it('fails gracefully with MARKERS_NOT_FOUND when corner markers are missing or cropped', () => {
    const assessment = createSampleAssessment(5)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    const image = createSyntheticAnswerSheetImage(sheet, {
      omitTopLeftMarker: true,
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('MARKERS_NOT_FOUND')
    expect(result.errorMessage).toContain('corner registration markers')
  })

  it('rejects assessment version mismatch when sheet was printed for an older version', () => {
    const assessment = createSampleAssessment(5)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })
    const image = createSyntheticAnswerSheetImage(sheet, {})

    // Sheet printed for version 1, active assessment is version 2
    const v1Payload = encodeAnswerSheetQrPayload({
      assessmentId: 'asm-omr-test-101',
      assessmentVersion: 1,
      mode: 'generic',
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      expectedVersionNumber: 2, // Active is V2
      scannedQrPayload: v1Payload,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('MISMATCHED_VERSION')
    expect(result.errorMessage).toContain('Assessment Version Mismatch')
  })

  it('rejects wrong assessment sheet scans', () => {
    const assessment = createSampleAssessment(5)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })
    const image = createSyntheticAnswerSheetImage(sheet, {})

    const foreignPayload = encodeAnswerSheetQrPayload({
      assessmentId: 'asm-other-exam-999',
      assessmentVersion: 1,
      mode: 'generic',
    })

    const result = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      scannedQrPayload: foreignPayload,
      layoutDefinition: sheet,
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('MISMATCHED_ASSESSMENT')
    expect(result.errorMessage).toContain('Wrong Assessment')
  })

  it('produces unique image fingerprints for different photos', () => {
    const assessment = createSampleAssessment(5)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    const img1 = createSyntheticAnswerSheetImage(sheet, { marks: { 1: 'A' } })
    const img2 = createSyntheticAnswerSheetImage(sheet, { marks: { 1: 'B' } })

    const fp1 = computeImageFingerprint(img1)
    const fp2 = computeImageFingerprint(img2)

    expect(fp1).toMatch(/^img-[0-9a-f]{8}-[0-9a-f]{8}-/)
    expect(fp1).not.toBe(fp2)
  })
})
