import type {
  AssessmentResultSession,
  LearnerItemAnswer,
  ResultAssessmentItemSnapshot,
  ResultItemOutcome,
} from '../../types/results'
import type { OmrItemRecognition, OmrScanResult } from '../../types/omr'
import { calculateResultTotals, scoreAnswerSheet, type ResultTotals } from '../resultsScoring'

/**
 * Converts local OMR recognized items into standard GuroDesk LearnerItemAnswer structures.
 * This ensures the scanner is strictly an INPUT METHOD and feeds the single canonical scoring engine.
 */
export function omrRecognitionsToLearnerAnswers(
  recognitions: OmrItemRecognition[],
): Record<string, LearnerItemAnswer | null> {
  const answers: Record<string, LearnerItemAnswer | null> = {}

  for (const item of recognitions) {
    if (!item.isMachineCheckable) {
      answers[item.itemId] = null
      continue
    }

    // If ambiguous or multiple or blank, do not auto-assert a valid single choice
    if (item.state === 'EMPTY' || item.state === 'AMBIGUOUS' || item.state === 'MULTIPLE' || item.state === 'UNREADABLE') {
      answers[item.itemId] = null
      continue
    }

    if (item.questionType === 'multiple_choice') {
      if (item.selectedChoiceIds.length === 1) {
        answers[item.itemId] = {
          type: 'multiple_choice',
          choiceId: item.selectedChoiceIds[0],
        }
      } else {
        answers[item.itemId] = null
      }
    } else if (item.questionType === 'true_false') {
      if (typeof item.trueFalseValue === 'boolean') {
        answers[item.itemId] = {
          type: 'true_false',
          value: item.trueFalseValue,
        }
      } else {
        answers[item.itemId] = null
      }
    } else if (item.questionType === 'multiple_select') {
      answers[item.itemId] = {
        type: 'multiple_select',
        choiceIds: item.selectedChoiceIds,
      }
    } else if (item.questionType === 'matching') {
      if (item.matchingMatches && Object.keys(item.matchingMatches).length > 0) {
        answers[item.itemId] = {
          type: 'matching',
          matches: item.matchingMatches,
        }
      } else {
        answers[item.itemId] = null
      }
    } else {
      answers[item.itemId] = null
    }
  }

  return answers
}

export type ScoredScanPreview = {
  scanResult: OmrScanResult
  learnerAnswers: Record<string, LearnerItemAnswer | null>
  outcomes: ResultItemOutcome[]
  totals: ResultTotals
  flaggedItems: OmrItemRecognition[]
  requiresTeacherReview: boolean
  isFullyScored: boolean
}

/**
 * Generates an in-memory score preview from a scan result using the canonical resultsScoring pipeline.
 */
export function previewScoredScan(
  scanResult: OmrScanResult,
  session: Pick<AssessmentResultSession, 'id' | 'shortAnswerScoring'>,
  learner: { participantId: string; learnerId: string },
  items: readonly ResultAssessmentItemSnapshot[],
  teacherPointsByItem: Record<string, number | null> = {},
  now?: string,
): ScoredScanPreview {
  const learnerAnswers = omrRecognitionsToLearnerAnswers(scanResult.recognizedItems)

  const outcomes = scoreAnswerSheet(
    session,
    learner,
    learnerAnswers,
    items,
    teacherPointsByItem,
    now,
  )

  const totals = calculateResultTotals(outcomes)
  const flaggedItems = scanResult.recognizedItems.filter((item) => item.needsReview)

  const hasUnscoredTeacherItems = items.some((item) => {
    if (item.questionType === 'constructed_response' || item.questionType === 'essay' || item.questionType === 'problem_solving') {
      const outcome = outcomes.find((o) => o.itemId === item.id)
      return outcome?.earnedPoints === 0 && outcome.scoringSource === 'teacher' && (teacherPointsByItem[item.id] === undefined || teacherPointsByItem[item.id] === null)
    }
    return false
  })

  const requiresTeacherReview = scanResult.needsReview || flaggedItems.length > 0 || hasUnscoredTeacherItems

  return {
    scanResult,
    learnerAnswers,
    outcomes,
    totals,
    flaggedItems,
    requiresTeacherReview,
    isFullyScored: !hasUnscoredTeacherItems && !requiresTeacherReview,
  }
}
