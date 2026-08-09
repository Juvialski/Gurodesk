import type { AssessmentRecord, AssessmentItem } from '../../src/types/assessment'
import type { TosRecord } from '../../src/types/tos'
import type {
  AssessmentResultSession,
  LearnerItemAnswer,
  ResultItemOutcome,
} from '../../src/types/results'
import type { CanonicalCurriculumFixture } from './supabaseTestHarness'
import { scoreResultItem } from '../../src/lib/resultsScoring'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireUuid(value: string, label: string) {
  if (!UUID_RE.test(value)) throw new Error(`${label} must be a UUID in the integration fixture.`)
  return value
}

function now() {
  return '2026-08-09T00:00:00.000Z'
}

function fixtureUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
}

/**
 * A minimal, fully reconciled TOS. One verified curriculum row allocates three
 * items to one cognitive category, which is enough to exercise the required
 * 1/1 + 3/5 + 8/10 database-backed scoring path without inventing curriculum.
 */
export function makeTosFixture(
  curriculum: CanonicalCurriculumFixture,
  title = 'Phase 5.5 deterministic TOS',
  totalItems = 3,
) {
  if (!Number.isSafeInteger(totalItems) || totalItems < 1 || totalItems > 100) {
    throw new Error('Integration TOS fixture item count must be an integer from 1 to 100.')
  }
  const rowId = requireUuid(fixtureUuid(), 'TOS row ID')
  const category = {
    id: 'remember',
    label: 'Remember',
    shortLabel: 'R',
    weight: '100',
    sortOrder: 1,
  }
  const allocation = {
    categoryId: category.id,
    label: category.label,
    shortLabel: category.shortLabel,
    itemCount: totalItems,
    itemStart: 1,
    itemEnd: totalItems,
    rangeLabel: totalItems === 1 ? '1' : `1–${totalItems}`,
  }
  const sourcePage = curriculum.competency.source_page
  const row = {
    id: rowId,
    sortOrder: 1,
    competency: {
      id: requireUuid(curriculum.competency.id, 'canonical competency ID'),
      code: curriculum.competency.competency_code,
      text: curriculum.competency.competency_text,
      sourcePage,
      sourceTitle: curriculum.source.title,
      sourceUrl: curriculum.source.source_url,
      academicPeriodId: curriculum.competency.academic_period_id,
      curriculumPeriodLabel: curriculum.period.label,
      verificationStatus: 'verified' as const,
    },
    instructionalMinutes: '45',
    manualWeight: '1',
    itemCountOverride: '',
    cognitiveWeights: { [category.id]: '100' },
    notes: 'Phase 5.5 deterministic integration fixture.',
    computedWeightPercent: '100',
    itemCount: totalItems,
    itemStart: 1,
    itemEnd: totalItems,
    itemRangeLabel: totalItems === 1 ? '1' : `1–${totalItems}`,
    cognitiveAllocations: [allocation],
  }
  const content = {
    schemaVersion: 1,
    title,
    assessmentTitle: 'Phase 5.5 results round trip',
    gradeLevel: curriculum.subject.grade_level,
    learningArea: curriculum.subject.name,
    sections: ['Phase55-1'],
    schoolYear: '2026-2027',
    gradingTermId: curriculum.gradingTerm.id,
    gradingTermLabel: curriculum.gradingTerm.label,
    curriculumVersionId: curriculum.version.id,
    curriculumVersionCode: curriculum.version.code,
    curriculumVersionName: curriculum.version.name,
    curriculumSubjectId: curriculum.subject.id,
    curriculumPeriodIds: [curriculum.period.id],
    curriculumPeriodLabels: [curriculum.period.label],
    sourceTitle: curriculum.source.title,
    sourceUrl: curriculum.source.source_url ?? '',
    totalItems,
    weightingMethod: 'equal' as const,
    cognitiveCategories: [category],
    rows: [row],
    notes: 'Integration fixture only.',
    calculation: {
      engine: 'hamilton-largest-remainder-v1' as const,
      valid: true,
      totalAllocated: totalItems,
      calculatedAt: now(),
      warnings: [],
    },
  }
  const rpcRow = {
    rowId,
    competencyId: row.competency.id,
    competencyCode: row.competency.code,
    competencyText: row.competency.text,
    sourcePage: row.competency.sourcePage,
    curriculumPeriodLabel: row.competency.curriculumPeriodLabel,
    rowOrder: row.sortOrder,
    instructionalMinutes: row.instructionalMinutes,
    sourceWeight: row.manualWeight,
    computedWeightPercent: row.computedWeightPercent,
    itemCount: row.itemCount,
    itemStart: row.itemStart,
    itemEnd: row.itemEnd,
    cognitiveAllocations: row.cognitiveAllocations,
    notes: row.notes,
  }
  return { content, rows: [rpcRow], rowId }
}

/** Convert a persisted TOS row into a repository-compatible source snapshot. */
export function tosRecordFromRpc(
  value: Record<string, unknown>,
  curriculum: CanonicalCurriculumFixture,
  userId: string,
  content: Record<string, unknown>,
): TosRecord {
  return {
    id: String(value.id),
    userId,
    assignmentId: String(content.assignmentId ?? ''),
    title: String(content.title),
    schoolYear: String(content.schoolYear),
    academicPeriodLabel: String(content.gradingTermLabel),
    status: 'final',
    content: {
      ...content,
      rows: (content.rows as unknown[]).map((raw) => {
        const row = raw as Record<string, unknown>
        return {
          ...row,
          competency: {
            ...((row.competency ?? {}) as Record<string, unknown>),
            id: curriculum.competency.id,
            code: curriculum.competency.competency_code,
            text: curriculum.competency.competency_text,
            sourcePage: curriculum.competency.source_page,
            academicPeriodId: curriculum.competency.academic_period_id,
            verificationStatus: 'verified' as const,
          },
        }
      }),
    } as TosRecord['content'],
    versionNumber: 1,
    createdAt: now(),
    updatedAt: now(),
  }
}

function objectiveItem(item: AssessmentItem): AssessmentItem {
  return {
    ...item,
    prompt: 'Choose the verified correct response.',
    questionType: 'multiple_choice',
    answer: {
      type: 'multiple_choice',
      choices: [
        { id: 'choice-a', text: 'Correct response' },
        { id: 'choice-b', text: 'Distractor response' },
      ],
      choiceId: 'choice-a',
    },
    pointsPossible: 1,
    points: 1,
    authorshipState: 'manual',
    qaState: 'verified',
    locked: false,
    rationale: 'Deterministic test answer.',
    teacherNotes: '',
  }
}

function problemSolvingItem(item: AssessmentItem): AssessmentItem {
  return {
    ...item,
    prompt: 'Show the solution to the verified problem.',
    questionType: 'problem_solving',
    answer: {
      type: 'problem_solving',
      finalAnswer: '7',
      solutionOutline: 'Show the equation and the verified final value.',
    },
    pointsPossible: 5,
    points: 5,
    authorshipState: 'manual',
    qaState: 'verified',
    locked: false,
    rationale: 'Deterministic test answer.',
    teacherNotes: '',
  }
}

function essayItem(item: AssessmentItem): AssessmentItem {
  return {
    ...item,
    prompt: 'Explain the reasoning for the verified competency.',
    questionType: 'essay',
    answer: {
      type: 'essay',
      keyPoints: ['Explain the reasoning clearly.'],
      rubric: [{ id: 'rubric-content', label: 'Content and reasoning', pointsPossible: 10 }],
    },
    pointsPossible: 10,
    points: 10,
    authorshipState: 'manual',
    qaState: 'verified',
    locked: false,
    rationale: 'Teacher-scored deterministic test fixture.',
    teacherNotes: '',
  }
}

/** A final assessment payload for the required 1 + 5 + 10 point mix. */
export function makeFinalAssessment(assessment: AssessmentRecord): AssessmentRecord {
  if (assessment.items.length !== 3) throw new Error('The results fixture requires exactly three assessment items.')
  const items = assessment.items.map((item, index) => {
    if (index === 0) return objectiveItem(item)
    if (index === 1) return problemSolvingItem(item)
    return essayItem(item)
  })
  return {
    ...assessment,
    status: 'final',
    title: 'Phase 5.5 finalized results assessment',
    instructions: 'Answer each item.',
    items,
    totalPoints: 16,
    updatedAt: now(),
  }
}

export function makeLockedDraft(assessment: AssessmentRecord): AssessmentRecord {
  return {
    ...assessment,
    title: 'Phase 5.5 locked draft',
    items: assessment.items.map((item, index) => index === 0 ? {
      ...item,
      locked: true,
      qaState: 'locked',
      authorshipState: 'manual',
      prompt: 'Locked fixture prompt.',
      answer: {
        type: 'multiple_choice',
        choices: [{ id: 'A', text: 'Choice A' }, { id: 'B', text: 'Choice B' }],
        choiceId: 'A',
      },
      questionType: 'multiple_choice',
    } : item),
  }
}

export function makeLearnerAnswer(item: AssessmentRecord['items'][number], complete: boolean): LearnerItemAnswer {
  if (item.questionType === 'multiple_choice') {
    return { type: 'multiple_choice', choiceId: 'choice-a' }
  }
  if (item.questionType === 'problem_solving') {
    return { type: 'problem_solving', finalAnswer: '7', solution: 'Worked solution.' }
  }
  if (item.questionType === 'essay') {
    return { type: 'essay', text: complete ? 'Complete essay response.' : 'Partial essay response.' }
  }
  throw new Error(`Unexpected deterministic fixture item type: ${item.questionType}`)
}

export function scoreLearner(
  session: AssessmentResultSession,
  complete: boolean,
  participant: { participantId: string; learnerId: string },
): ResultItemOutcome[] {
  return session.assessmentSnapshot.items.map((item) => scoreResultItem({
    resultSessionId: session.id,
    participantId: participant.participantId,
    learnerId: participant.learnerId,
    item,
    answer: makeLearnerAnswer(item as AssessmentItem, complete),
    awardedPoints: item.questionType === 'problem_solving'
      ? (complete ? 5 : 3)
      : item.questionType === 'essay'
        ? (complete ? 10 : 8)
        : undefined,
    shortAnswerMode: session.shortAnswerScoring.itemModes[item.id] ?? session.shortAnswerScoring.defaultMode,
    now: now(),
  }))
}
