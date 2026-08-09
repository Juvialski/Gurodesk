import type { AssessmentResultSession, ClassLearner, LearnerItemAnswer, ResultItemOutcome, ResultSaveBatch, ResultValidationIssue, ResultValidationResult } from '../types/results'
import { calculateResultTotals } from './resultsScoring'

/** Must stay aligned with the transactional Supabase RPC payload bound. */
const MAX_BULK_OUTCOMES = 10000

function addIssue(
  target: ResultValidationIssue[],
  key: string,
  message: string,
  severity: 'error' | 'warning',
  extra: Partial<Pick<ResultValidationIssue, 'participantId' | 'itemId' | 'itemNumber'>> = {},
) {
  target.push({ key, message, severity, ...extra })
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function sameNormalized(left: string, right: string) {
  return left.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US') ===
    right.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US')
}

function answerTypeMatches(itemType: string, answer: LearnerItemAnswer) {
  return answer.type === itemType
}

export function validateClassLearners(
  learners: readonly ClassLearner[],
  expectedAssignmentId?: string,
  expectedSectionName?: string,
): ResultValidationResult {
  const errors: ResultValidationIssue[] = []
  const warnings: ResultValidationIssue[] = []
  const ids = new Set<string>()
  const names = new Map<string, ClassLearner>()
  for (const learner of learners) {
    if (!text(learner.id)) addIssue(errors, 'learner-id', 'Each learner needs an internal identifier.', 'error')
    if (ids.has(learner.id)) addIssue(errors, 'duplicate-learner-id', 'Learner identifiers must be unique.', 'error')
    ids.add(learner.id)
    if (expectedAssignmentId && learner.assignmentId !== expectedAssignmentId) addIssue(errors, 'assignment-ownership', 'Every learner must belong to the selected teaching assignment.', 'error')
    if (!text(learner.sectionName)) addIssue(errors, 'learner-section', 'Every learner must belong to a named assignment section.', 'error')
    if (expectedSectionName && learner.sectionName !== expectedSectionName) addIssue(errors, 'section-ownership', 'Every learner must belong to the selected assignment section.', 'error')
    if (!text(learner.displayName)) addIssue(errors, 'learner-name', 'Learner display name is required.', 'error')
    if (learner.status !== 'active' && learner.status !== 'inactive') addIssue(errors, 'learner-status', 'Learner status must be active or inactive.', 'error')
    const key = learner.displayName.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US')
    if (key && names.has(key)) addIssue(warnings, 'duplicate-display-name', 'Two learners have the same normalized display name; verify that they are distinct people.', 'warning')
    if (key) names.set(key, learner)
    if (learner.localReference !== null && learner.localReference !== undefined && typeof learner.localReference !== 'string') addIssue(errors, 'local-reference', 'Teacher-local references must be text or empty.', 'error')
  }
  return { ready: errors.length === 0, errors, warnings }
}

export function validateResultSession(session: AssessmentResultSession): ResultValidationResult {
  const errors: ResultValidationIssue[] = []
  const warnings: ResultValidationIssue[] = []
  const snapshot = session.assessmentSnapshot
  const shortAnswerScoring = session.shortAnswerScoring ?? { defaultMode: 'manual' as const, itemModes: {} }
  if (!text(session.id) || !text(session.userId)) addIssue(errors, 'session-identity', 'A result session needs an internal ID and owning teacher.', 'error')
  if (!text(session.assignmentId) || snapshot.assignmentId !== session.assignmentId) addIssue(errors, 'assignment-link', 'The result session and immutable assessment snapshot must reference the same assignment.', 'error')
  if (!text(session.sectionName)) addIssue(errors, 'session-section', 'Result sessions must name the assignment section whose roster is being encoded.', 'error')
  if (!text(session.assessmentId) || snapshot.assessmentId !== session.assessmentId) addIssue(errors, 'assessment-link', 'The result session and immutable assessment snapshot must reference the same assessment.', 'error')
  if (session.status !== 'draft' && session.status !== 'final' && session.status !== 'archived') addIssue(errors, 'session-status', 'Result session status is invalid.', 'error')
  if (!text(session.title)) addIssue(errors, 'session-title', 'Result session title is required.', 'error')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.administrationDate)) addIssue(errors, 'administration-date', 'Administration date must use YYYY-MM-DD.', 'error')
  if (session.entryMode !== 'answer_sheet' && session.entryMode !== 'item' && session.entryMode !== 'score_only') addIssue(errors, 'entry-mode', 'Result entry mode is invalid.', 'error')
  if (!Number.isSafeInteger(snapshot.totalItems) || snapshot.totalItems < 1 || snapshot.items.length !== snapshot.totalItems) addIssue(errors, 'snapshot-items', 'The immutable assessment snapshot must contain exactly its declared item count.', 'error')
  const itemIds = new Set<string>()
  const itemNumbers = new Set<number>()
  for (const item of snapshot.items) {
    if (!text(item.id) || itemIds.has(item.id)) addIssue(errors, 'snapshot-item-id', 'Snapshot item IDs must be present and unique.', 'error', { itemId: item.id, itemNumber: item.itemNumber })
    itemIds.add(item.id)
    if (!Number.isSafeInteger(item.itemNumber) || item.itemNumber < 1 || item.itemNumber > snapshot.totalItems || itemNumbers.has(item.itemNumber)) addIssue(errors, 'snapshot-item-number', 'Snapshot item numbers must be unique whole numbers from 1..N.', 'error', { itemId: item.id, itemNumber: item.itemNumber })
    itemNumbers.add(item.itemNumber)
    if (!Number.isFinite(item.points) || item.points < 0) addIssue(errors, 'snapshot-points', 'Snapshot points must be finite and nonnegative.', 'error', { itemId: item.id, itemNumber: item.itemNumber })
  }
  const participantIds = new Set<string>()
  for (const participant of session.learners) {
    if (!text(participant.participantId) || participantIds.has(participant.participantId)) addIssue(errors, 'duplicate-participant', 'Result participants must have unique IDs.', 'error', { participantId: participant.participantId })
    participantIds.add(participant.participantId)
    if (!text(participant.learnerId) || !text(participant.displayName)) addIssue(errors, 'participant-snapshot', 'Each participant needs a learner ID and display-name snapshot.', 'error', { participantId: participant.participantId })
  }
  if (!session.shortAnswerScoring || (shortAnswerScoring.defaultMode !== 'manual' && shortAnswerScoring.defaultMode !== 'normalized_exact')) addIssue(errors, 'short-answer-mode', 'Short-answer scoring mode must be manual or explicitly normalized_exact.', 'error')
  if (session.entryMode === 'score_only' && session.itemOutcomes.length) addIssue(errors, 'score-only-items', 'Score-only sessions cannot contain item-level outcomes.', 'error')
  if (session.entryMode !== 'score_only' && session.scoreOnlyOutcomes.length) addIssue(errors, 'item-mode-scores', 'Item-level sessions cannot contain score-only outcomes.', 'error')
  const outcomes = validateResultOutcomes({ ...session, shortAnswerScoring }, errors, warnings)
  void outcomes
  return { ready: errors.length === 0, errors, warnings }
}

export function validateResultOutcomes(
  session: Pick<AssessmentResultSession, 'entryMode' | 'learners' | 'assessmentSnapshot' | 'shortAnswerScoring' | 'itemOutcomes' | 'scoreOnlyOutcomes'>,
  errors: ResultValidationIssue[] = [],
  warnings: ResultValidationIssue[] = [],
): { errors: ResultValidationIssue[]; warnings: ResultValidationIssue[] } {
  const participants = new Set(session.learners.map((learner) => learner.participantId))
  const participantLearners = new Map(session.learners.map((learner) => [learner.participantId, learner.learnerId]))
  const items = new Map(session.assessmentSnapshot.items.map((item) => [item.id, item]))
  const keys = new Set<string>()
  if (session.itemOutcomes.length > MAX_BULK_OUTCOMES) addIssue(errors, 'outcome-limit', `A single result save batch may not exceed ${MAX_BULK_OUTCOMES.toLocaleString('en-US')} item outcomes.`, 'error')
  for (const outcome of session.itemOutcomes) {
    const key = `${outcome.participantId}:${outcome.itemId}`
    if (keys.has(key)) addIssue(errors, 'duplicate-outcome', 'Only one outcome may exist for each learner and item.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId, itemNumber: outcome.itemNumber })
    keys.add(key)
    if (!participants.has(outcome.participantId) || participantLearners.get(outcome.participantId) !== outcome.learnerId) addIssue(errors, 'outcome-participant', 'An outcome must reference the exact learner paired with this result participant.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
    const item = items.get(outcome.itemId)
    if (!item) {
      addIssue(errors, 'outcome-item', 'An outcome may reference only an item in the immutable assessment snapshot.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
      continue
    }
    if (outcome.itemNumber !== item.itemNumber) addIssue(errors, 'outcome-item-number', 'The original item number must remain traceable to the snapshot.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId, itemNumber: outcome.itemNumber })
    if (!Number.isFinite(outcome.possiblePoints) || outcome.possiblePoints !== item.points) addIssue(errors, 'outcome-points-snapshot', 'Outcome possible points must equal the immutable item snapshot.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
    if (!Number.isFinite(outcome.earnedPoints) || outcome.earnedPoints < 0 || outcome.earnedPoints > outcome.possiblePoints) addIssue(errors, 'earned-points', 'Earned points must be finite and within the item point range.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
    if (outcome.answer !== null && !answerTypeMatches(item.questionType, outcome.answer)) addIssue(errors, 'answer-type', 'Learner answer shape must match the immutable question type.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
    if (item.questionType === 'constructed_response' && outcome.isCorrect !== null) addIssue(errors, 'constructed-correctness', 'Constructed responses remain teacher-scored and do not receive deterministic correctness.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
    if (item.questionType === 'short_answer' && (session.shortAnswerScoring.itemModes[item.id] ?? session.shortAnswerScoring.defaultMode) === 'manual' && outcome.scoringSource !== 'teacher') addIssue(errors, 'short-answer-source', 'Manual short-answer outcomes must remain teacher-scored.', 'error', { participantId: outcome.participantId, itemId: outcome.itemId })
  }
  const scoreParticipants = new Set<string>()
  for (const score of session.scoreOnlyOutcomes) {
    if (scoreParticipants.has(score.participantId)) addIssue(errors, 'duplicate-score-only', 'Only one score-only outcome may exist per participant.', 'error', { participantId: score.participantId })
    scoreParticipants.add(score.participantId)
    if (!participants.has(score.participantId) || participantLearners.get(score.participantId) !== score.learnerId) addIssue(errors, 'score-participant', 'A score-only outcome must reference the exact learner paired with this result participant.', 'error', { participantId: score.participantId })
    if (!Number.isFinite(score.possiblePoints) || score.possiblePoints !== session.assessmentSnapshot.totalPossiblePoints) addIssue(errors, 'score-only-possible', 'Score-only possible points must equal the immutable assessment total.', 'error', { participantId: score.participantId })
    if (score.rawScore !== null && (!Number.isFinite(score.rawScore) || score.rawScore < 0 || score.rawScore > score.possiblePoints)) addIssue(errors, 'score-only-range', 'A score-only raw score must be within the possible-point range.', 'error', { participantId: score.participantId })
  }
  if (session.entryMode === 'score_only' && session.itemOutcomes.length === 0 && session.scoreOnlyOutcomes.length === 0) addIssue(warnings, 'no-results', 'No scores have been entered yet.', 'warning')
  return { errors, warnings }
}

export function validateResultSaveBatch(batch: ResultSaveBatch): ResultValidationResult {
  const base = validateResultSession(batch.session)
  const errors = [...base.errors]
  const warnings = [...base.warnings]
  if (batch.outcomes.length > MAX_BULK_OUTCOMES || batch.scoreOnlyOutcomes.length > batch.session.learners.length) addIssue(errors, 'bulk-batch-size', 'Bulk saves must be bounded and must not exceed the session participant set.', 'error')
  if (batch.outcomes.length !== batch.session.itemOutcomes.length || batch.scoreOnlyOutcomes.length !== batch.session.scoreOnlyOutcomes.length) addIssue(errors, 'complete-batch', 'A result save must contain the complete bounded replacement set so omitted dirty deltas cannot erase previously saved responses.', 'error')
  validateResultOutcomes({ ...batch.session, itemOutcomes: batch.outcomes, scoreOnlyOutcomes: batch.scoreOnlyOutcomes }, errors, warnings)
  return { ready: errors.length === 0, errors, warnings }
}

/** Score-only sessions deliberately expose totals but no fabricated item facts. */
export function resultSessionCanProduceItemAnalysis(session: Pick<AssessmentResultSession, 'entryMode'>) {
  return session.entryMode !== 'score_only'
}

/** Helper for UI/report validators to avoid accidentally displaying NaN/Infinity. */
export function safePercentage(rawScore: number, possiblePoints: number): number | null {
  const totals = calculateResultTotals([], possiblePoints)
  if (totals.possiblePoints <= 0 || !Number.isFinite(rawScore)) return null
  return Math.round((Math.min(totals.possiblePoints, Math.max(0, rawScore)) / totals.possiblePoints) * 10000) / 100
}

export { MAX_BULK_OUTCOMES }
