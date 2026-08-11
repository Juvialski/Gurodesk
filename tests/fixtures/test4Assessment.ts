import { ASSESSMENT_VISUAL_FIXTURES } from '../../src/lib/assessmentVisualFixtures'
import { assessmentVisualSourceHash } from '../../src/lib/assessmentVisualPlanning'
import type { AssessmentItem, AssessmentRecord, QuestionType } from '../../src/types/assessment'
import { cloneCandidate } from '../unit/assessmentContractFixtures'
import { assessmentItem, fixedNow } from '../unit/fixtures'

/**
 * Canonical "Test 4" export fixture from the VS Code handoff:
 * exactly 20 questions, 41 points, all 11 supported question types, and
 * several structured visuals. Question types are deliberately contiguous so
 * every paper renderer must expose the same eleven section headings.
 */
const TEST_4_LAYOUT: ReadonlyArray<readonly [QuestionType, number]> = [
  ['multiple_choice', 1],
  ['multiple_choice', 1],
  ['multiple_choice', 1],
  ['true_false', 1],
  ['true_false', 1],
  ['short_answer', 2],
  ['short_answer', 2],
  ['constructed_response', 4],
  ['constructed_response', 4],
  ['identification', 1],
  ['identification', 1],
  ['fill_in_the_blank', 1],
  ['fill_in_the_blank', 1],
  ['numerical_answer', 2],
  ['problem_solving', 5],
  ['matching', 3],
  ['multiple_select', 1],
  ['multiple_select', 1],
  ['essay', 4],
  ['essay', 4],
]

const VISUALS = new Map<number, AssessmentItem['visual']>([
  [1, ASSESSMENT_VISUAL_FIXTURES.marksAndLabels],
  [8, ASSESSMENT_VISUAL_FIXTURES.irregularConcavePentagon],
  [14, ASSESSMENT_VISUAL_FIXTURES.cartesianLinearGraph],
  [15, ASSESSMENT_VISUAL_FIXTURES.convexQuadrilateral],
  [19, ASSESSMENT_VISUAL_FIXTURES.regularHexagon],
])

export function buildTest4Assessment(): AssessmentRecord {
  const items = TEST_4_LAYOUT.map(([questionType, pointsPossible], index) => {
    const itemNumber = index + 1
    const candidate = cloneCandidate(questionType)
    const visual = VISUALS.get(itemNumber)
    const base = assessmentItem(questionType, {
      id: `test-4-item-${itemNumber}`,
      itemNumber,
      prompt: `${candidate.prompt} [Test 4 item ${itemNumber}]`,
      answer: candidate.answer,
      rationale: candidate.rationale,
      authorshipState: 'teacher_accepted',
      qaState: 'verified',
      pointsPossible,
      points: pointsPossible,
      mapping: {
        rowId: `test-4-row-${Math.ceil(itemNumber / 4)}`,
        competencyId: `test-4-competency-${Math.ceil(itemNumber / 4)}`,
        cognitiveCategoryId: itemNumber % 2 ? 'remembering' : 'understanding',
        allocationItemStart: itemNumber,
        allocationItemEnd: itemNumber,
        allocationIndex: 0,
      },
      competencySnapshot: {
        id: `test-4-competency-${Math.ceil(itemNumber / 4)}`,
        code: `T4-Q1-${String(itemNumber).padStart(2, '0')}`,
        text: `Test 4 competency group ${Math.ceil(itemNumber / 4)}`,
        sourcePage: itemNumber,
        academicPeriodId: 'period-1',
        curriculumPeriodId: 'period-1',
        curriculumPeriodLabel: 'Quarter 1',
      },
      cognitiveCategorySnapshot: itemNumber % 2
        ? { id: 'remembering', label: 'Remembering', shortLabel: 'R' }
        : { id: 'understanding', label: 'Understanding', shortLabel: 'U' },
      ...(visual ? { visual, visualRequirement: 'helpful' as const, visualStatus: 'succeeded' as const } : {}),
    })
    return visual ? { ...base, visualSourceHash: assessmentVisualSourceHash(base), visualUpdatedAt: fixedNow } : base
  })

  return {
    id: 'assessment-test-4',
    userId: 'teacher-test-4',
    assignmentId: 'assignment-test-4',
    title: 'Test 4: Complete Assessment Paper',
    instructions: 'Read each part carefully. Write clear answers and show complete solutions where requested.',
    gradeLevel: 'Grade 7',
    learningArea: 'Mathematics',
    schoolYear: '2026-2027',
    gradingTermId: 'term-1',
    gradingTermLabel: 'Quarter 1',
    curriculumPeriodIds: ['period-1'],
    curriculumPeriodLabels: ['Quarter 1'],
    totalItems: items.length,
    totalPoints: items.reduce((sum, item) => sum + item.pointsPossible, 0),
    settings: {
      mode: 'fixed_counts',
      allowedTypes: [...new Set(TEST_4_LAYOUT.map(([questionType]) => questionType))],
      targetTotalPoints: 41,
    },
    versionNumber: 1,
    status: 'final',
    sourceTos: {
      id: 'tos-test-4',
      versionNumber: 1,
      title: 'Test 4 canonical TOS',
      status: 'final',
      assignmentId: 'assignment-test-4',
      schoolYear: '2026-2027',
      academicPeriodLabel: 'Quarter 1',
      content: { rows: [] } as unknown as AssessmentRecord['sourceTos']['content'],
    },
    items,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }
}

