import type { AssessmentRecord } from '../types/assessment'
import type {
  AssessmentResultSession,
  ClassLearner,
  LearnerInput,
  ResultAssessmentItemSnapshot,
  ResultItemOutcome,
  ResultLearnerSnapshot,
  ResultSaveBatch,
  ScoreOnlyOutcome,
} from '../types/results'
import { scoreResultItem } from './resultsScoring'

/** Demo persistence is deliberately separate from the Supabase repository. */
export const DEMO_LEARNERS_KEY = 'gurodesk.demo.classLearners.v1'
export const DEMO_RESULTS_KEY = 'gurodesk.demo.resultSessions.v1'
const DEMO_REMEDIATION_KEY = 'gurodesk.demo.remediationPlans.v1'

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function read<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = localStorage.getItem(key)
    if (!value) return []
    const parsed = JSON.parse(value) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write<T>(key: string, values: T[]) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(values))
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function readDemoClassLearners(userId?: string, assignmentId?: string, sectionName?: string) {
  return read<ClassLearner>(DEMO_LEARNERS_KEY)
    .filter((item) => (!userId || item.userId === userId)
      && (!assignmentId || item.assignmentId === assignmentId)
      && (!sectionName || item.sectionName === sectionName))
    .map(clone)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
}

export function saveDemoClassLearner(input: LearnerInput, userId: string): ClassLearner {
  const values = read<ClassLearner>(DEMO_LEARNERS_KEY)
  const existing = input.id ? values.find((item) => item.id === input.id && item.userId === userId) : undefined
  if (existing && (existing.assignmentId !== input.assignmentId || existing.sectionName !== input.sectionName)) {
    throw new Error('A learner cannot be moved between assignment sections.')
  }
  const now = new Date().toISOString()
  const saved: ClassLearner = {
    id: existing?.id ?? input.id ?? newId(),
    userId,
    assignmentId: input.assignmentId,
    sectionName: input.sectionName,
    displayName: input.displayName.trim(),
    localReference: input.localReference?.trim() || null,
    status: input.status ?? existing?.status ?? 'active',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  write(DEMO_LEARNERS_KEY, [...values.filter((item) => item.id !== saved.id || item.userId !== userId), saved])
  return clone(saved)
}

export function deleteDemoClassLearner(id: string, userId: string) {
  const sessions = readDemoResultSessions(userId)
  if (sessions.some((session) => session.learners.some((learner) => learner.learnerId === id))) {
    throw new Error('Learner has historical results; deactivate instead of deleting.')
  }
  write(DEMO_LEARNERS_KEY, read<ClassLearner>(DEMO_LEARNERS_KEY).filter((item) => !(item.id === id && item.userId === userId)))
}

export function readDemoResultSessions(userId?: string, assignmentId?: string, sectionName?: string) {
  return read<AssessmentResultSession>(DEMO_RESULTS_KEY)
    .filter((item) => (!userId || item.userId === userId)
      && (!assignmentId || item.assignmentId === assignmentId)
      && (!sectionName || item.sectionName === sectionName))
    .map(clone)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveDemoResultSession(batch: ResultSaveBatch, userId: string, status: AssessmentResultSession['status'] = 'draft') {
  const values = read<AssessmentResultSession>(DEMO_RESULTS_KEY)
  const existing = values.find((item) => item.id === batch.session.id && item.userId === userId)
  if (existing && existing.status !== 'draft') throw new Error('Only draft demo result sessions can be edited.')
  if (existing && existing.versionNumber !== batch.session.versionNumber) throw new Error('This demo result draft changed elsewhere.')
  if (batch.session.userId !== userId) throw new Error('Demo result ownership is invalid.')
  if (!['answer_sheet', 'item', 'score_only'].includes(batch.session.entryMode)) throw new Error('Demo result entry mode is invalid.')
  if (batch.session.assessmentSnapshot.items.length !== batch.session.assessmentSnapshot.totalItems
    || batch.session.assessmentSnapshot.totalItems < 1
    || !Number.isFinite(batch.session.assessmentSnapshot.totalPossiblePoints)
    || batch.session.assessmentSnapshot.totalPossiblePoints < 0) {
    throw new Error('Demo result assessment snapshot totals are invalid.')
  }
  if (batch.session.assessmentSnapshot.assignmentId !== batch.session.assignmentId
    || batch.session.assessmentId !== batch.session.assessmentSnapshot.assessmentId) {
    throw new Error('Demo result assessment and assignment snapshots are inconsistent.')
  }
  if (!batch.session.sectionName.trim()) throw new Error('Demo result section is required.')
  const roster = readDemoClassLearners(userId, batch.session.assignmentId, batch.session.sectionName)
  const rosterById = new Map(roster.map((learner) => [learner.id, learner]))
  const participantIds = new Set(batch.session.learners.map((learner) => learner.participantId))
  const learnerIds = new Set(batch.session.learners.map((learner) => learner.learnerId))
  if (participantIds.size !== batch.session.learners.length || learnerIds.size !== batch.session.learners.length) {
    throw new Error('Demo result participants must be unique.')
  }
  if (batch.session.learners.some((participant) => {
    const learner = rosterById.get(participant.learnerId)
    return !learner
      || learner.assignmentId !== batch.session.assignmentId
      || learner.sectionName !== batch.session.sectionName
      || (!existing && (learner.status !== 'active'
        || learner.displayName !== participant.displayName
        || learner.localReference !== participant.localReference))
  })) {
    throw new Error('Every demo result participant must be a selected learner in the same assignment section.')
  }
  if (existing && (!sameJson(existing.assessmentSnapshot, batch.session.assessmentSnapshot)
    || existing.assignmentId !== batch.session.assignmentId
    || existing.sectionName !== batch.session.sectionName
    || existing.assessmentId !== batch.session.assessmentId
    || existing.entryMode !== batch.session.entryMode
    || existing.learners.length !== batch.session.learners.length
    || existing.learners.some((oldLearner, index) => {
      const nextLearner = batch.session.learners[index]
      return !nextLearner || oldLearner.participantId !== nextLearner.participantId
        || oldLearner.learnerId !== nextLearner.learnerId
        || oldLearner.displayName !== nextLearner.displayName
        || oldLearner.localReference !== nextLearner.localReference
    }))) {
    throw new Error('Demo result assessment and participant snapshots are immutable.')
  }
  if (batch.outcomes.length > 10000 || batch.scoreOnlyOutcomes.length > batch.session.learners.length) {
    throw new Error('Demo result batch is too large.')
  }
  if (batch.session.entryMode === 'score_only' && batch.outcomes.length > 0) throw new Error('Score-only sessions cannot contain item outcomes.')
  if (batch.session.entryMode !== 'score_only' && batch.scoreOnlyOutcomes.length > 0) throw new Error('Item-entry sessions cannot contain score-only outcomes.')
  const participants = participantIds
  const items = new Set(batch.session.assessmentSnapshot.items.map((item) => item.id))
  const itemById = new Map(batch.session.assessmentSnapshot.items.map((item) => [item.id, item]))
  const outcomeKeys = new Set<string>()
  const normalizedOutcomes: ResultItemOutcome[] = []
  if (batch.outcomes.some((outcome) => !participants.has(outcome.participantId)
    || !items.has(outcome.itemId)
    || outcome.resultSessionId !== batch.session.id
    || outcome.learnerId !== batch.session.learners.find((learner) => learner.participantId === outcome.participantId)?.learnerId)) {
    throw new Error('Demo result outcomes do not belong to the session snapshot.')
  }
  for (const outcome of batch.outcomes) {
    const item = itemById.get(outcome.itemId)
    const key = `${outcome.participantId}:${outcome.itemId}`
    if (!item || outcomeKeys.has(key)) throw new Error('Demo result outcomes contain a duplicate or unknown item.')
    outcomeKeys.add(key)
    if (outcome.itemNumber !== item.itemNumber || outcome.possiblePoints !== item.points
      || !Number.isFinite(outcome.earnedPoints) || outcome.earnedPoints < 0 || outcome.earnedPoints > outcome.possiblePoints) {
      throw new Error('Demo result outcome points do not match the assessment snapshot.')
    }
    const shortMode = batch.session.shortAnswerScoring.itemModes[item.id] ?? batch.session.shortAnswerScoring.defaultMode
    // Recompute objective correctness and all-or-nothing points from the
    // immutable item snapshot. Constructed responses and manual short answers
    // remain teacher-scored, but the scorer still enforces null correctness and
    // bounds the teacher-entered points.
    normalizedOutcomes.push(scoreResultItem({
      resultSessionId: batch.session.id,
      participantId: outcome.participantId,
      learnerId: outcome.learnerId,
      item,
      answer: outcome.answer,
      awardedPoints: outcome.earnedPoints,
      teacherFeedback: outcome.teacherFeedback,
      shortAnswerMode: shortMode,
      outcomeId: outcome.id,
      now: outcome.updatedAt || new Date().toISOString(),
    }))
  }
  if (batch.scoreOnlyOutcomes.some((outcome) => !participants.has(outcome.participantId)
    || outcome.learnerId !== batch.session.learners.find((learner) => learner.participantId === outcome.participantId)?.learnerId)) {
    throw new Error('Demo score outcomes do not belong to the session snapshot.')
  }
  for (const outcome of batch.scoreOnlyOutcomes) {
    if (outcome.possiblePoints !== batch.session.assessmentSnapshot.totalPossiblePoints
      || (outcome.rawScore !== null && (!Number.isFinite(outcome.rawScore) || outcome.rawScore < 0 || outcome.rawScore > outcome.possiblePoints))) {
      throw new Error('Demo score outcome is outside the assessment point range.')
    }
  }
  const now = new Date().toISOString()
  const saved: AssessmentResultSession = {
    ...clone(batch.session),
    userId,
    status,
    createdAt: existing?.createdAt ?? batch.session.createdAt ?? now,
    updatedAt: now,
    versionNumber: (existing?.versionNumber ?? batch.session.versionNumber ?? 0) + 1,
    itemOutcomes: clone(normalizedOutcomes),
    scoreOnlyOutcomes: clone(batch.scoreOnlyOutcomes),
  }
  write(DEMO_RESULTS_KEY, [...values.filter((item) => item.id !== saved.id || item.userId !== userId), saved])
  return clone(saved)
}

export function archiveDemoResultSession(id: string, userId: string) {
  const values = read<AssessmentResultSession>(DEMO_RESULTS_KEY)
  const found = values.find((item) => item.id === id && item.userId === userId)
  if (!found) return null
  if (found.status === 'archived') return clone(found)
  if (found.status !== 'final') throw new Error('Only final demo result sessions may be archived.')
  const archived = { ...found, status: 'archived' as const, updatedAt: new Date().toISOString() }
  write(DEMO_RESULTS_KEY, values.map((item) => item.id === id && item.userId === userId ? archived : item))
  return clone(archived)
}

export function deleteDemoDraftResultSession(id: string, userId: string) {
  const found = readDemoResultSessions(userId).find((item) => item.id === id)
  if (found && found.status !== 'draft') throw new Error('Only draft demo result sessions may be deleted.')
  write(DEMO_RESULTS_KEY, read<AssessmentResultSession>(DEMO_RESULTS_KEY).filter((item) => !(item.id === id && item.userId === userId)))
  // Match the database cascade: only planning records dependent on this
  // deletable draft are removed. Final/archived result sessions never reach
  // this function, so historical remediation evidence is preserved.
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(DEMO_REMEDIATION_KEY) ?? '[]') as Array<{ userId?: string; resultSessionId?: string }>
      if (Array.isArray(parsed)) localStorage.setItem(DEMO_REMEDIATION_KEY, JSON.stringify(parsed.filter((plan) => !(plan.userId === userId && plan.resultSessionId === id))))
    } catch {
      // A malformed optional demo cache is treated as empty by the remediation
      // repository; result deletion must still complete predictably.
      localStorage.removeItem(DEMO_REMEDIATION_KEY)
    }
  }
}

function itemSnapshotFromAssessment(assessment: AssessmentRecord): ResultAssessmentItemSnapshot[] {
  return assessment.items.map((item) => ({
    id: item.id,
    itemNumber: item.itemNumber,
    prompt: item.prompt,
    questionType: item.questionType,
    answer: clone(item.answer),
    points: Number(item.points ?? 1),
    competencySnapshot: clone(item.competencySnapshot),
    cognitiveCategorySnapshot: clone(item.cognitiveCategorySnapshot),
    mapping: clone(item.mapping),
  }))
}

/**
 * Opt-in sample data for demos and validator fixtures.  It requires a real
 * finalized assessment supplied by the caller, so it cannot invent curriculum
 * competencies or look like official learner data.
 */
export function createDemoResultsSample(
  assessment: AssessmentRecord,
  userId: string,
  assignmentId: string,
  sectionName: string,
  learnerNames = ['Demo Learner 1', 'Demo Learner 2', 'Demo Learner 3'],
): { learners: ClassLearner[]; session: AssessmentResultSession } {
  if (assessment.status !== 'final') throw new Error('A finalized assessment is required for a demo results sample.')
  if (assessment.assignmentId !== assignmentId) throw new Error('Demo assessment and assignment must match.')
  const now = new Date().toISOString()
  const learners = learnerNames.map((displayName, index) => ({
    id: newId(),
    userId,
    assignmentId,
    sectionName,
    displayName: displayName.trim() || `Demo Learner ${index + 1}`,
    localReference: `DEMO-${index + 1}`,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  }))
  const items = itemSnapshotFromAssessment(assessment)
  const snapshot = {
    assessmentId: assessment.id,
    assessmentVersionNumber: assessment.versionNumber,
    assessmentTitle: assessment.title,
    assignmentId,
    gradeLevel: assessment.gradeLevel,
    learningArea: assessment.learningArea,
    schoolYear: assessment.schoolYear,
    gradingTermId: assessment.gradingTermId,
    gradingTermLabel: assessment.gradingTermLabel,
    curriculumPeriodIds: [...assessment.curriculumPeriodIds],
    curriculumPeriodLabels: [...assessment.curriculumPeriodLabels],
    totalItems: items.length,
    totalPossiblePoints: items.reduce((sum, item) => sum + item.points, 0),
    items,
  }
  const participantSnapshots: ResultLearnerSnapshot[] = learners.map((learner) => ({
    participantId: newId(),
    learnerId: learner.id,
    displayName: learner.displayName,
    localReference: learner.localReference,
    learnerWasActive: true,
  }))
  const itemOutcomes: ResultItemOutcome[] = []
  for (const [learnerIndex, participant] of participantSnapshots.entries()) {
    for (const item of items) {
      const correct = (learnerIndex + item.itemNumber) % 4 !== 0
      const objective = item.questionType === 'multiple_choice' || item.questionType === 'true_false'
      const choiceAnswer = item.answer.type === 'multiple_choice' ? item.answer : null
      const trueFalseAnswer = item.answer.type === 'true_false' ? item.answer : null
      const shortAnswer = item.answer.type === 'short_answer' ? item.answer : null
      const constructedAnswer = item.answer.type === 'constructed_response' ? item.answer : null
      const answer = objective
        ? item.questionType === 'multiple_choice' && choiceAnswer
          ? { type: 'multiple_choice' as const, choiceId: correct
            ? choiceAnswer.choiceId
            : (choiceAnswer.choices.find((choice) => choice.id !== choiceAnswer.choiceId)?.id ?? choiceAnswer.choiceId) }
          : item.questionType === 'true_false' && trueFalseAnswer
            ? { type: 'true_false' as const, value: correct ? trueFalseAnswer.value : !trueFalseAnswer.value }
            : null
        : item.questionType === 'short_answer' && shortAnswer
          ? { type: 'short_answer' as const, text: correct ? (shortAnswer.acceptedAnswers[0] ?? 'Demo answer') : 'Demo response' }
          : item.questionType === 'constructed_response' && constructedAnswer
            ? { type: 'constructed_response' as const, text: correct ? constructedAnswer.expectedResponse : 'Demo response' }
            : null
      itemOutcomes.push(scoreResultItem({
        resultSessionId: '',
        participantId: participant.participantId,
        learnerId: participant.learnerId,
        item,
        answer,
        awardedPoints: correct ? item.points : 0,
        shortAnswerMode: 'manual',
        outcomeId: newId(),
        now,
      }))
    }
  }
  const session: AssessmentResultSession = {
    id: newId(),
    userId,
    assignmentId,
    sectionName,
    assessmentId: assessment.id,
    administrationDate: now.slice(0, 10),
    title: `${assessment.title} — Demo results`,
    entryMode: 'answer_sheet',
    status: 'draft',
    assessmentSnapshot: snapshot,
    learners: participantSnapshots,
    itemOutcomes,
    scoreOnlyOutcomes: [],
    shortAnswerScoring: { defaultMode: 'manual', itemModes: {} },
    createdAt: now,
    updatedAt: now,
    versionNumber: 0,
  }
  for (const outcome of itemOutcomes) outcome.resultSessionId = session.id
  return { learners, session }
}
