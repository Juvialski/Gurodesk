import { describe, expect, it } from 'vitest'
import { generateAnswerSheetLayout } from '../../src/lib/answerSheet/layoutEngine'
import { decodeAnswerSheetQrPayload } from '../../src/lib/answerSheet/qrPayload'
import { renderAnswerSheetPageSvg } from '../../src/lib/answerSheet/printRenderer'
import type { AssessmentBlueprint } from '../../src/types/assessment'
import type { ClassLearner } from '../../src/types/results'

function createSampleAssessment(): AssessmentBlueprint {
  return {
    id: 'asm-science-quiz-2',
    userId: 'teacher-1',
    assignmentId: 'assign-g7-science',
    title: 'Grade 7 Science Quiz 2',
    instructions: 'Choose the best answer.',
    gradeLevel: '7',
    learningArea: 'Science',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: 10,
    items: Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i + 1}`,
      itemNumber: i + 1,
      questionType: 'multiple_choice',
      prompt: `Science question ${i + 1}`,
      pointsPossible: 1,
      points: 1,
      authorshipState: 'teacher_accepted',
      competencySnapshot: {
        id: 'comp-sci-1',
        code: 'S7LT-IIa-1',
        text: 'Microscopy competency',
        sourcePage: 5,
        academicPeriodId: 'q1',
        curriculumPeriodId: 'q1',
        curriculumPeriodLabel: 'Quarter 1',
      },
      cognitiveCategorySnapshot: {
        id: 'cog-1',
        label: 'Remembering',
        shortLabel: 'Rem',
      },
      mapping: {
        rowId: 'row-1',
        competencyId: 'comp-sci-1',
        cognitiveCategoryId: 'cog-1',
        allocationItemStart: i + 1,
        allocationItemEnd: i + 1,
        allocationIndex: 1,
      },
      answer: {
        type: 'multiple_choice',
        choices: [
          { id: 'c1', text: 'Nucleus' },
          { id: 'c2', text: 'Cytoplasm' },
          { id: 'c3', text: 'Mitochondria' },
          { id: 'c4', text: 'Cell Wall' },
        ],
        choiceId: 'c1',
      },
    })),
    versionNumber: 1,
    status: 'final',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

const SAMPLE_ROSTER: ClassLearner[] = [
  {
    id: 'lrn-001-uuid',
    userId: 'teacher-1',
    assignmentId: 'assign-g7-science',
    sectionName: '7-Einstein',
    displayName: 'Juan Dela Cruz',
    localReference: 'LRN-1029384756',
    status: 'active',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
  {
    id: 'lrn-002-uuid',
    userId: 'teacher-1',
    assignmentId: 'assign-g7-science',
    sectionName: '7-Einstein',
    displayName: 'Maria Santos',
    localReference: 'LRN-2039485761',
    status: 'active',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
  {
    id: 'lrn-003-uuid',
    userId: 'teacher-1',
    assignmentId: 'assign-g7-science',
    sectionName: '7-Einstein',
    displayName: 'Andrea Reyes',
    localReference: 'LRN-3049586712',
    status: 'active',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  },
]

describe('Personalized Smart Answer Sheets from Class Roster', () => {
  it('generates personalized sheets with visible learner name and opaque QR identification', () => {
    const assessment = createSampleAssessment()

    const sheets = SAMPLE_ROSTER.map((learner) => generateAnswerSheetLayout(assessment, {
      mode: 'personalized',
      learner,
      paperSize: 'a4',
    }))

    expect(sheets.length).toBe(3)

    // Check Sheet 1 (Juan Dela Cruz)
    const sheet1 = sheets[0]
    expect(sheet1.mode).toBe('personalized')
    expect(sheet1.learner?.displayName).toBe('Juan Dela Cruz')
    expect(sheet1.learner?.id).toBe('lrn-001-uuid')

    const svg1 = renderAnswerSheetPageSvg(sheet1, sheet1.pages[0])
    expect(svg1).toContain('Juan Dela Cruz')
    expect(svg1).toContain('STUDENT:')

    // QR Verification & Privacy Check: QR must NOT contain the plain name 'Juan Dela Cruz'
    const qrPayload1 = sheet1.pages[0].qrCode.payload
    expect(qrPayload1).not.toContain('Juan')
    expect(qrPayload1).not.toContain('Dela Cruz')
    expect(qrPayload1).toContain('s:lrn-001-uuid')

    const decoded1 = decodeAnswerSheetQrPayload(qrPayload1)
    expect(decoded1.success).toBe(true)
    expect(decoded1.payload?.mode).toBe('personalized')
    expect(decoded1.payload?.learnerId).toBe('lrn-001-uuid')

    // Check Sheet 2 (Maria Santos)
    const sheet2 = sheets[1]
    const decoded2 = decodeAnswerSheetQrPayload(sheet2.pages[0].qrCode.payload)
    expect(decoded2.payload?.learnerId).toBe('lrn-002-uuid')

    // Each student receives a distinct QR checksum and payload
    expect(qrPayload1).not.toBe(sheet2.pages[0].qrCode.payload)
  })
})
