import { describe, expect, it } from 'vitest'
import { createExternalExamBlueprint } from '../../src/lib/answerSheet/externalExamAdapter'
import { generateAnswerSheetLayout } from '../../src/lib/answerSheet/layoutEngine'
import { generatePrintableAnswerSheetsHtml, renderAnswerSheetPageSvg } from '../../src/lib/answerSheet/printRenderer'
import { processAnswerSheetImage } from '../../src/lib/omr/omrEngine'
import { omrRecognitionsToLearnerAnswers } from '../../src/lib/omr/omrResultsAdapter'
import { calculateResultTotals, scoreAnswerSheet } from '../../src/lib/resultsScoring'
import type { AssessmentResultSession, ResultAssessmentItemSnapshot } from '../../src/types/results'
import { createSyntheticAnswerSheetImage } from './omr-synthetic-fixtures'

describe('External Exam Mode & Quick Answer Key Builder', () => {
  it('creates a standard AssessmentBlueprint from a 20-item MCQ answer key', () => {
    const keyMap: Record<number, string> = {
      1: 'A',
      2: 'B',
      3: 'C',
      4: 'D',
      5: 'A',
    }

    const blueprint = createExternalExamBlueprint({
      userId: 'teacher-1',
      title: 'Grade 10 NAT Science Practice Test',
      gradeLevel: '10',
      learningArea: 'Science',
      totalItems: 20,
      choicesPerItem: 4,
      keyMap,
    })

    expect(blueprint.totalItems).toBe(20)
    expect(blueprint.items.length).toBe(20)
    expect(blueprint.items[0].questionType).toBe('multiple_choice')
    expect(blueprint.items[0].answer).toEqual({
      type: 'multiple_choice',
      choices: [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
        { id: 'C', text: 'Option C' },
        { id: 'D', text: 'Option D' },
      ],
      choiceId: 'A',
    })
    expect(blueprint.items[2].answer).toMatchObject({ choiceId: 'C' })
  })

  it('generates a valid single-page SVG Smart Answer Sheet for a 50-item external exam', () => {
    const keyMap: Record<number, string> = {}
    for (let i = 1; i <= 50; i++) {
      keyMap[i] = ['A', 'B', 'C', 'D'][i % 4]
    }

    const blueprint = createExternalExamBlueprint({
      userId: 'teacher-1',
      title: 'Quarter 1 Periodic Exam',
      gradeLevel: '8',
      learningArea: 'Mathematics',
      totalItems: 50,
      keyMap,
    })

    const layout = generateAnswerSheetLayout(blueprint, { mode: 'generic' })
    expect(layout.pages.length).toBe(1)
    expect(layout.pages[0].items.length).toBe(50)

    const svg = renderAnswerSheetPageSvg(layout, layout.pages[0])
    expect(svg).toContain('<svg')
    expect(svg).toContain('Quarter 1 Periodic Exam')
    const html = generatePrintableAnswerSheetsHtml([layout])
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('scans and scores an external exam Smart Answer Sheet through the canonical results pipeline', () => {
    const keyMap: Record<number, string> = {
      1: 'A',
      2: 'B',
      3: 'C',
      4: 'D',
    }

    const blueprint = createExternalExamBlueprint({
      userId: 'teacher-1',
      title: '5-Item Quick Test',
      gradeLevel: '7',
      learningArea: 'English',
      totalItems: 4,
      keyMap,
    })

    const layout = generateAnswerSheetLayout(blueprint, { mode: 'generic' })

    // Student answers: 1: A (Correct), 2: B (Correct), 3: A (Incorrect, key is C), 4: D (Correct)
    const image = createSyntheticAnswerSheetImage(layout, {
      marks: {
        1: 'A',
        2: 'B',
        3: 'A',
        4: 'D',
      },
    })

    const scanResult = processAnswerSheetImage(image, {
      expectedAssessment: blueprint,
      layoutDefinition: layout,
    })

    expect(scanResult.success).toBe(true)

    const answers = omrRecognitionsToLearnerAnswers(scanResult.recognizedItems)

    const mockSession: AssessmentResultSession = {
      id: 'sess-ext-1',
      userId: 'teacher-1',
      assignmentId: 'assign-1',
      sectionName: 'Rizal',
      assessmentId: blueprint.id,
      administrationDate: '2026-08-19',
      title: 'External Exam Results',
      status: 'draft',
      entryMode: 'answer_sheet',
      shortAnswerScoring: { defaultMode: 'manual', itemModes: {} },
      versionNumber: 1,
      assessmentSnapshot: {
        assessmentId: blueprint.id,
        assessmentVersionNumber: blueprint.versionNumber,
        assessmentTitle: blueprint.title,
        assignmentId: 'assign-1',
        gradeLevel: blueprint.gradeLevel,
        learningArea: blueprint.learningArea,
        schoolYear: blueprint.schoolYear,
        gradingTermId: 'q1',
        gradingTermLabel: 'Quarter 1',
        curriculumPeriodIds: ['q1'],
        curriculumPeriodLabels: ['Quarter 1'],
        totalItems: blueprint.totalItems,
        totalPossiblePoints: 4,
        items: blueprint.items as unknown as ResultAssessmentItemSnapshot[],
      },
      learners: [
        { participantId: 'p1', learnerId: 'l1', displayName: 'Santos, Maria', localReference: '001', learnerWasActive: true },
      ],
      itemOutcomes: [],
      scoreOnlyOutcomes: [],
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    }

    const outcomes = scoreAnswerSheet(
      mockSession,
      { participantId: 'p1', learnerId: 'l1' },
      answers,
      mockSession.assessmentSnapshot.items,
    )

    const totals = calculateResultTotals(outcomes)

    expect(totals.rawScore).toBe(3)
    expect(totals.possiblePoints).toBe(4)
    expect(totals.correctItems).toBe(3)
    expect(totals.incorrectItems).toBe(1)
    expect(outcomes[0].isCorrect).toBe(true)
    expect(outcomes[1].isCorrect).toBe(true)
    expect(outcomes[2].isCorrect).toBe(false)
    expect(outcomes[3].isCorrect).toBe(true)
  })
})
