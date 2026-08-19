import { describe, expect, it } from 'vitest'
import { generateAnswerSheetLayout } from '../../src/lib/answerSheet/layoutEngine'
import { processAnswerSheetImage } from '../../src/lib/omr/omrEngine'
import {
  omrRecognitionsToLearnerAnswers,
  previewScoredScan,
} from '../../src/lib/omr/omrResultsAdapter'
import { scoreAnswerSheet } from '../../src/lib/resultsScoring'
import { analyzeResultSession } from '../../src/lib/itemAnalysis'
import { buildRemediationSignals } from '../../src/lib/remediation'
import type { AssessmentBlueprint } from '../../src/types/assessment'
import type {
  AssessmentResultSession,
  LearnerItemAnswer,
  ResultAssessmentItemSnapshot,
  ResultItemOutcome,
} from '../../src/types/results'
import { createSyntheticAnswerSheetImage } from './omr-synthetic-fixtures'

function createSampleAssessment(): AssessmentBlueprint {
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
    id: 'asm-results-101',
    userId: 'teacher-1',
    assignmentId: 'assign-1',
    title: 'Grade 9 Science Periodic Test',
    instructions: 'Shade circles clearly.',
    gradeLevel: '9',
    learningArea: 'Science',
    schoolYear: '2026-2027',
    gradingTermId: 'q1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['q1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: 4,
    items: [
      {
        id: 'item-1',
        itemNumber: 1,
        questionType: 'multiple_choice',
        prompt: 'What organelle produces ATP?',
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c1', 'S9LT-I-1', 'Cell structure'),
        cognitiveCategorySnapshot: { id: 'cog-1', label: 'Remembering', shortLabel: 'Rem' },
        mapping: { rowId: 'r1', competencyId: 'c1', cognitiveCategoryId: 'cog-1', allocationItemStart: 1, allocationItemEnd: 1, allocationIndex: 1 },
        answer: {
          type: 'multiple_choice',
          choices: [
            { id: 'c1', text: 'Mitochondria' },
            { id: 'c2', text: 'Ribosome' },
            { id: 'c3', text: 'Golgi' },
            { id: 'c4', text: 'Vacuole' },
          ],
          choiceId: 'c1', // Correct answer is A (c1)
        },
      },
      {
        id: 'item-2',
        itemNumber: 2,
        questionType: 'true_false',
        prompt: 'Plant cells have a cell wall.',
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c1', 'S9LT-I-1', 'Cell structure'),
        cognitiveCategorySnapshot: { id: 'cog-1', label: 'Understanding', shortLabel: 'Und' },
        mapping: { rowId: 'r1', competencyId: 'c1', cognitiveCategoryId: 'cog-1', allocationItemStart: 2, allocationItemEnd: 2, allocationIndex: 2 },
        answer: { type: 'true_false', value: true }, // Correct answer is True
      },
      {
        id: 'item-3',
        itemNumber: 3,
        questionType: 'multiple_choice',
        prompt: 'Which is a greenhouse gas?',
        pointsPossible: 1,
        points: 1,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c2', 'S9LT-I-2', 'Atmospheric cycles'),
        cognitiveCategorySnapshot: { id: 'cog-2', label: 'Applying', shortLabel: 'App' },
        mapping: { rowId: 'r2', competencyId: 'c2', cognitiveCategoryId: 'cog-2', allocationItemStart: 3, allocationItemEnd: 3, allocationIndex: 3 },
        answer: {
          type: 'multiple_choice',
          choices: [
            { id: 'c1', text: 'Oxygen' },
            { id: 'c2', text: 'Nitrogen' },
            { id: 'c3', text: 'Carbon dioxide' },
            { id: 'c4', text: 'Argon' },
          ],
          choiceId: 'c3', // Correct answer is C (c3)
        },
      },
      {
        id: 'item-4',
        itemNumber: 4,
        questionType: 'short_answer',
        prompt: 'Define photosynthesis in your own words.',
        pointsPossible: 2,
        points: 2,
        authorshipState: 'teacher_accepted',
        competencySnapshot: comp('c3', 'S9LT-I-3', 'Photosynthesis'),
        cognitiveCategorySnapshot: { id: 'cog-3', label: 'Evaluating', shortLabel: 'Eva' },
        mapping: { rowId: 'r3', competencyId: 'c3', cognitiveCategoryId: 'cog-3', allocationItemStart: 4, allocationItemEnd: 4, allocationIndex: 4 },
        answer: { type: 'short_answer', acceptedAnswers: ['Process where plants make food'] },
      },
    ],
    versionNumber: 1,
    status: 'final',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

function createResultSession(assessment: AssessmentBlueprint): AssessmentResultSession {
  return {
    id: 'session-res-1',
    userId: 'teacher-1',
    assignmentId: 'assign-1',
    sectionName: 'Diamond',
    assessmentId: assessment.id,
    administrationDate: '2026-08-19',
    title: 'Grade 9 Science Quarterly Results',
    status: 'draft',
    entryMode: 'answer_sheet',
    shortAnswerScoring: {
      defaultMode: 'manual',
      itemModes: {},
    },
    versionNumber: 1,
    assessmentSnapshot: {
      assessmentId: assessment.id,
      assessmentVersionNumber: assessment.versionNumber,
      assessmentTitle: assessment.title,
      assignmentId: assessment.assignmentId || 'assign-1',
      gradeLevel: assessment.gradeLevel,
      learningArea: assessment.learningArea,
      schoolYear: assessment.schoolYear,
      gradingTermId: assessment.gradingTermId,
      gradingTermLabel: assessment.gradingTermLabel,
      curriculumPeriodIds: assessment.curriculumPeriodIds,
      curriculumPeriodLabels: assessment.curriculumPeriodLabels,
      totalItems: assessment.totalItems,
      totalPossiblePoints: 5,
      items: assessment.items as unknown as ResultAssessmentItemSnapshot[],
    },
    learners: [
      {
        participantId: 'part-1',
        learnerId: 'learner-1',
        displayName: 'Dela Cruz, Juan',
        localReference: 'LRN-001',
        learnerWasActive: true,
      },
    ],
    itemOutcomes: [],
    scoreOnlyOutcomes: [],
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  }
}

describe('OMR Results, Scoring & Item Analysis Integration', () => {
  it('produces identical ResultItemOutcome[] and totals between OMR scanned sheets and manual entry', () => {
    const assessment = createSampleAssessment()
    const session = createResultSession(assessment)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    // Synthetic scan: Student shaded Item 1: 'A' (c1, correct), Item 2: 'T' (True, correct), Item 3: 'B' (c2, incorrect)
    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: {
        1: 'A',
        2: 'T',
        3: 'B',
      },
    })

    const scanResult = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    expect(scanResult.success).toBe(true)

    // 1. Adapter conversion
    const scannedLearnerAnswers = omrRecognitionsToLearnerAnswers(scanResult.recognizedItems)

    // 2. Direct manual entry equivalent
    const manualLearnerAnswers: Record<string, LearnerItemAnswer | null> = {
      'item-1': { type: 'multiple_choice', choiceId: 'c1' },
      'item-2': { type: 'true_false', value: true },
      'item-3': { type: 'multiple_choice', choiceId: 'c2' },
      'item-4': null, // manual item left for teacher scoring
    }

    expect(scannedLearnerAnswers).toEqual(manualLearnerAnswers)

    // 3. Score using canonical resultsScoring engine (with written answer on teacher-scored item 4)
    const scoredAnswersScanned = { ...scannedLearnerAnswers, 'item-4': { type: 'short_answer' as const, text: 'Plants produce food' } }
    const scoredAnswersManual = { ...manualLearnerAnswers, 'item-4': { type: 'short_answer' as const, text: 'Plants produce food' } }

    const fixedNow = '2026-08-19T00:00:00.000Z'
    const scannedOutcomes = scoreAnswerSheet(
      session,
      { participantId: 'part-1', learnerId: 'learner-1' },
      scoredAnswersScanned,
      session.assessmentSnapshot.items,
      { 'item-4': 2 }, // Teacher awards 2 points on item 4
      fixedNow,
    )

    const manualOutcomes = scoreAnswerSheet(
      session,
      { participantId: 'part-1', learnerId: 'learner-1' },
      scoredAnswersManual,
      session.assessmentSnapshot.items,
      { 'item-4': 2 },
      fixedNow,
    )

    expect(scannedOutcomes).toEqual(manualOutcomes)

    // Item 1: 1/1 (Correct)
    expect(scannedOutcomes[0].isCorrect).toBe(true)
    expect(scannedOutcomes[0].earnedPoints).toBe(1)

    // Item 2: 1/1 (Correct)
    expect(scannedOutcomes[1].isCorrect).toBe(true)
    expect(scannedOutcomes[1].earnedPoints).toBe(1)

    // Item 3: 0/1 (Incorrect)
    expect(scannedOutcomes[2].isCorrect).toBe(false)
    expect(scannedOutcomes[2].earnedPoints).toBe(0)

    // Item 4: 2/2 (Teacher scored)
    expect(scannedOutcomes[3].scoringSource).toBe('teacher')
    expect(scannedOutcomes[3].earnedPoints).toBe(2)
  })

  it('generates a real-time ScoredScanPreview with flagged ambiguous items', () => {
    const assessment = createSampleAssessment()
    const session = createResultSession(assessment)
    const sheet = generateAnswerSheetLayout(assessment, { mode: 'generic' })

    // Student has a faint mark on item 1
    const image = createSyntheticAnswerSheetImage(sheet, {
      marks: { 1: 'A', 2: 'T' },
      markDarkness: { 1: 0.26 },
    })

    const scanResult = processAnswerSheetImage(image, {
      expectedAssessment: assessment,
      layoutDefinition: sheet,
    })

    const preview = previewScoredScan(
      scanResult,
      session,
      { participantId: 'part-1', learnerId: 'learner-1' },
      session.assessmentSnapshot.items,
    )

    expect(preview.requiresTeacherReview).toBe(true)
    expect(preview.flaggedItems.length).toBe(1)
    expect(preview.flaggedItems[0].itemNumber).toBe(1)
    expect(preview.flaggedItems[0].state).toBe('AMBIGUOUS')

    // Item 1 was ambiguous, so not awarded points automatically
    expect(preview.learnerAnswers['item-1']).toBeNull()
  })

  it('scanned answer sheet outcomes feed analyzeResultSession and buildRemediationSignals accurately', () => {
    const assessment = createSampleAssessment()
    const session = createResultSession(assessment)

    // 2 learners: Learner 1 got 100%, Learner 2 got 50%
    const outcomes1: ResultItemOutcome[] = [
      { id: 'o1', resultSessionId: session.id, participantId: 'p1', learnerId: 'l1', itemId: 'item-1', itemNumber: 1, answer: { type: 'multiple_choice', choiceId: 'c1' }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
      { id: 'o2', resultSessionId: session.id, participantId: 'p1', learnerId: 'l1', itemId: 'item-2', itemNumber: 2, answer: { type: 'true_false', value: true }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
      { id: 'o3', resultSessionId: session.id, participantId: 'p1', learnerId: 'l1', itemId: 'item-3', itemNumber: 3, answer: { type: 'multiple_choice', choiceId: 'c3' }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
      { id: 'o4', resultSessionId: session.id, participantId: 'p1', learnerId: 'l1', itemId: 'item-4', itemNumber: 4, answer: { type: 'short_answer', text: 'Photosynthesis' }, isCorrect: null, earnedPoints: 2, possiblePoints: 2, scoringSource: 'teacher', teacherFeedback: null, updatedAt: '2026-08-19' },
    ]

    const outcomes2: ResultItemOutcome[] = [
      { id: 'o5', resultSessionId: session.id, participantId: 'p2', learnerId: 'l2', itemId: 'item-1', itemNumber: 1, answer: { type: 'multiple_choice', choiceId: 'c2' }, isCorrect: false, earnedPoints: 0, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
      { id: 'o6', resultSessionId: session.id, participantId: 'p2', learnerId: 'l2', itemId: 'item-2', itemNumber: 2, answer: { type: 'true_false', value: false }, isCorrect: false, earnedPoints: 0, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
      { id: 'o7', resultSessionId: session.id, participantId: 'p2', learnerId: 'l2', itemId: 'item-3', itemNumber: 3, answer: { type: 'multiple_choice', choiceId: 'c3' }, isCorrect: true, earnedPoints: 1, possiblePoints: 1, scoringSource: 'deterministic', teacherFeedback: null, updatedAt: '2026-08-19' },
      { id: 'o8', resultSessionId: session.id, participantId: 'p2', learnerId: 'l2', itemId: 'item-4', itemNumber: 4, answer: { type: 'short_answer', text: '' }, isCorrect: null, earnedPoints: 0, possiblePoints: 2, scoringSource: 'teacher', teacherFeedback: null, updatedAt: '2026-08-19' },
    ]

    const allOutcomes = [...outcomes1, ...outcomes2]

    const sessionWith2Learners: AssessmentResultSession = {
      ...session,
      learners: [
        { participantId: 'p1', learnerId: 'l1', displayName: 'Dela Cruz, Juan', localReference: '001', learnerWasActive: true },
        { participantId: 'p2', learnerId: 'l2', displayName: 'Santos, Maria', localReference: '002', learnerWasActive: true },
      ],
      itemOutcomes: allOutcomes,
    }

    // 1. Calculate Item Analysis
    const itemAnalysis = analyzeResultSession({
      session: sessionWith2Learners,
      outcomes: allOutcomes,
    })

    expect(itemAnalysis.items.length).toBe(4)

    // Item 1: 1 correct (50% facility)
    const item1Analysis = itemAnalysis.items.find((it) => it.itemId === 'item-1')!
    expect(item1Analysis.attempted).toBe(2)
    expect(item1Analysis.correct).toBe(1)
    expect(item1Analysis.percentageCorrect).toBe(0.5)

    // Item 3: 2 correct (100% facility)
    const item3Analysis = itemAnalysis.items.find((it) => it.itemId === 'item-3')!
    expect(item3Analysis.correct).toBe(2)
    expect(item3Analysis.percentageCorrect).toBe(1.0)

    // 2. Generate Remediation Signals
    const remediationSignals = buildRemediationSignals(itemAnalysis)

    expect(remediationSignals.available).toBe(true)
    expect(remediationSignals.classSignals.length).toBeGreaterThan(0)
    // Competency c1 (Cell structure) was failed by Learner 2, so flagged
    const comp1 = remediationSignals.classSignals.find((c) => c.competencyCode === 'S9LT-I-1')!
    expect(comp1).toBeDefined()
    expect(comp1.participantIds).toContain('p2')
  })
})
