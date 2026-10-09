import { describe, expect, it } from 'vitest'
import {
  cropItemWritingArea,
  formatExpectedAnswerSummary,
  gradeSubjectiveResponse,
} from '../../src/lib/omr/subjectiveAutoGrader'
import { calculateResultTotals, formatScore, scoreAnswerSheet } from '../../src/lib/resultsScoring'
import type { AssessmentBlueprint, AssessmentItem } from '../../src/types/assessment'
import type { AssessmentResultSession, ResultAssessmentItemSnapshot, ResultLearnerSnapshot } from '../../src/types/results'
import type { OmrImageBuffer } from '../../src/types/omr'

function createSubjectiveAssessment(): AssessmentBlueprint {
  const essayItem: AssessmentItem = {
    id: 'item-essay-1',
    itemNumber: 1,
    questionType: 'essay',
    prompt: 'Discuss the impact of deforestation on local biodiversity in the Philippines.',
    pointsPossible: 5,
    points: 5,
    authorshipState: 'teacher_accepted',
    competencySnapshot: {
      id: 'comp-sci-1',
      code: 'S10LT-IIIi-42',
      text: 'Explain biodiversity and population growth',
      sourcePage: 15,
      academicPeriodId: 'q3',
      curriculumPeriodId: 'q3',
      curriculumPeriodLabel: 'Q3',
    },
    cognitiveCategorySnapshot: {
      id: 'cog-1',
      label: 'Evaluating',
      shortLabel: 'Eva',
    },
    mapping: {
      rowId: 'row-1',
      competencyId: 'comp-sci-1',
      cognitiveCategoryId: 'cog-1',
      allocationItemStart: 1,
      allocationItemEnd: 1,
      allocationIndex: 1,
    },
    answer: {
      type: 'essay',
      keyPoints: [
        'Habitat destruction and species displacement',
        'Soil erosion and disrupted water cycle',
        'Endangerment of endemic Philippine species (e.g. Philippine Eagle, Tarsier)',
      ],
      scoringNotes: 'Award 5 points for comprehensive discussion covering all 3 key points. Award partial points accordingly.',
    },
  }

  const problemSolvingItem: AssessmentItem = {
    id: 'item-prob-2',
    itemNumber: 2,
    questionType: 'problem_solving',
    prompt: 'A car accelerates from rest at 2 m/s^2 for 5 seconds. Find its final velocity.',
    pointsPossible: 3,
    points: 3,
    authorshipState: 'teacher_accepted',
    competencySnapshot: {
      id: 'comp-sci-2',
      code: 'S9FE-Ia-1',
      text: 'Uniformly accelerated motion',
      sourcePage: 12,
      academicPeriodId: 'q1',
      curriculumPeriodId: 'q1',
      curriculumPeriodLabel: 'Q1',
    },
    cognitiveCategorySnapshot: {
      id: 'cog-2',
      label: 'Applying',
      shortLabel: 'App',
    },
    mapping: {
      rowId: 'row-2',
      competencyId: 'comp-sci-2',
      cognitiveCategoryId: 'cog-2',
      allocationItemStart: 2,
      allocationItemEnd: 2,
      allocationIndex: 1,
    },
    answer: {
      type: 'problem_solving',
      finalAnswer: '10 m/s',
      solutionOutline: 'v = u + at = 0 + (2 m/s^2)(5 s) = 10 m/s',
    },
  }

  return {
    id: 'asm-subjective-1',
    userId: 'teacher-1',
    assignmentId: 'assign-1',
    title: 'Science Subjective Exam',
    instructions: 'Write your answers clearly in the designated boxes.',
    gradeLevel: '10',
    learningArea: 'Science',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: 2,
    totalPoints: 8,
    versionNumber: 1,
    status: 'final',
    items: [essayItem, problemSolvingItem],
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  }
}

describe('Subjective AI Auto-Grader & Teacher Consent (Essay & Problem Solving)', () => {
  it('formats expected answer and rubric summaries accurately for AI context', () => {
    const assessment = createSubjectiveAssessment()
    const essaySummary = formatExpectedAnswerSummary(assessment.items[0] as unknown as ResultAssessmentItemSnapshot)
    expect(essaySummary).toContain('Key Points: Habitat destruction')
    expect(essaySummary).toContain('Philippine Eagle')
    expect(essaySummary).toContain('Scoring Notes:')

    const probSummary = formatExpectedAnswerSummary(assessment.items[1] as unknown as ResultAssessmentItemSnapshot)
    expect(probSummary).toContain('Final Answer: 10 m/s')
    expect(probSummary).toContain('v = u + at')
  })

  it('crops writing area box from OMR image buffer to base64 JPEG', () => {
    const image: OmrImageBuffer = {
      width: 1000,
      height: 1400,
      data: new Uint8Array(1000 * 1400).fill(255), // Blank white sheet
    }

    const pageDims = { widthMm: 210, heightMm: 297 }
    const boundsMm = { xMm: 30, yMm: 50, widthMm: 80, heightMm: 40 }

    const crop = cropItemWritingArea(image, pageDims, boundsMm)
    expect(crop).toBeDefined()
    expect(crop).toContain('data:image/jpeg;base64,')
  })

  it('handles missing student response gracefully in gradeSubjectiveResponse', async () => {
    const assessment = createSubjectiveAssessment()
    const result = await gradeSubjectiveResponse({
      item: assessment.items[0] as unknown as ResultAssessmentItemSnapshot,
    })

    expect(result.success).toBe(false)
    expect(result.suggestedPoints).toBe(0)
    expect(result.error).toContain('Missing student response')
  })
  it('refuses an AI grading request before dispatch when teacher consent is absent', async () => {
    const assessment = createSubjectiveAssessment()
    const result = await gradeSubjectiveResponse({ cropBase64: 'fixture-image', item: assessment.items[0] as unknown as ResultAssessmentItemSnapshot })
    expect(result.success).toBe(false)
    expect(result.error).toContain('consent')
  })

  it('allows teacher to review and override AI score suggestions in canonical scoring engine', () => {
    const assessment = createSubjectiveAssessment()
    const learners: ResultLearnerSnapshot[] = [
      { participantId: 'p1', learnerId: 'l1', displayName: 'Dela Cruz, Juan', localReference: '001', learnerWasActive: true },
    ]

    const mockSession: AssessmentResultSession = {
      id: 'sess-subj-1',
      userId: 'teacher-1',
      assignmentId: 'assign-1',
      sectionName: 'Rizal',
      assessmentId: assessment.id,
      administrationDate: '2026-08-20',
      title: assessment.title,
      status: 'draft',
      entryMode: 'answer_sheet',
      shortAnswerScoring: { defaultMode: 'manual', itemModes: {} },
      versionNumber: 1,
      assessmentSnapshot: {
        assessmentId: assessment.id,
        assessmentVersionNumber: assessment.versionNumber,
        assessmentTitle: assessment.title,
        assignmentId: 'assign-1',
        gradeLevel: assessment.gradeLevel,
        learningArea: assessment.learningArea,
        schoolYear: assessment.schoolYear,
        gradingTermId: assessment.gradingTermId,
        gradingTermLabel: assessment.gradingTermLabel,
        curriculumPeriodIds: assessment.curriculumPeriodIds,
        curriculumPeriodLabels: assessment.curriculumPeriodLabels,
        totalItems: assessment.totalItems,
        totalPossiblePoints: 8,
        items: assessment.items as unknown as ResultAssessmentItemSnapshot[],
      },
      learners,
      itemOutcomes: [],
      scoreOnlyOutcomes: [],
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    }

    // 1. Initial AI suggested points (Essay: 4/5, Prob Solving: 3/3)
    const learnerAnswers = {
      'item-essay-1': { type: 'essay' as const, text: 'Deforestation causes habitat destruction.' },
      'item-prob-2': { type: 'problem_solving' as const, finalAnswer: '10 m/s' },
    }

    const aiTeacherPoints = {
      'item-essay-1': 4.0,
      'item-prob-2': 3.0,
    }

    const aiOutcomes = scoreAnswerSheet(
      mockSession,
      { participantId: 'p1', learnerId: 'l1' },
      learnerAnswers,
      mockSession.assessmentSnapshot.items,
      aiTeacherPoints,
    )

    const aiTotals = calculateResultTotals(aiOutcomes)
    expect(aiTotals.rawScore).toBe(7)
    expect(aiTotals.possiblePoints).toBe(8)
    expect(formatScore(aiTotals.percentage)).toBe('87.5')

    // 2. Teacher manually overrides Essay score to 4.5
    const overriddenPoints = {
      'item-essay-1': 4.5,
      'item-prob-2': 3.0,
    }

    const overriddenOutcomes = scoreAnswerSheet(
      mockSession,
      { participantId: 'p1', learnerId: 'l1' },
      learnerAnswers,
      mockSession.assessmentSnapshot.items,
      overriddenPoints,
    )

    const overriddenTotals = calculateResultTotals(overriddenOutcomes)
    expect(overriddenTotals.rawScore).toBe(7.5)
    expect(overriddenTotals.possiblePoints).toBe(8)
    expect(formatScore(overriddenTotals.percentage)).toBe('93.75')
  })
})
