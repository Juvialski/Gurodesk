import type { AssessmentItem, AssessmentRecord } from '../types/assessment'
import { applyAssessmentItemSuggestion, generateAssessmentItemSuggestion, generateMissingAssessmentItems } from './assessmentGeneration'
import { unlockAssessmentItem } from './assessmentItemLifecycle'
import { reviewAssessmentForFinalization, type AssessmentFinalReview } from './assessmentFinalReview'

const AUTO_IGNORED_HARD_CODES = new Set(['teacher-review'])
const AUTO_REPAIRABLE_AUTHORSHIP = new Set(['ai_suggestion', 'teacher_accepted'])

function replaceItem(record: AssessmentRecord, replacement: AssessmentItem): AssessmentRecord {
  return { ...record, items: record.items.map((item) => item.id === replacement.id ? replacement : item) }
}

function providerBoundary(error: unknown) {
  const category = String((error as { failureCategory?: unknown })?.failureCategory ?? '')
  if (['provider_configuration', 'provider_authentication', 'provider_quota', 'provider_rate_limit', 'unknown_provider_failure'].includes(category)) return true
  const message = String((error as { message?: unknown })?.message ?? error)
  return /429|quota|rate.?limit|provider limit|api key|credential|authentication required|not configured|rejected the (?:structured )?request configuration/i.test(message)
}

function structuralHardErrors(review: AssessmentFinalReview) {
  return review.hardErrors.filter((issue) => !AUTO_IGNORED_HARD_CODES.has(issue.code))
}

export function assessmentAutomationBlockers(assessment: AssessmentRecord) {
  const review = reviewAssessmentForFinalization(assessment)
  const errors = structuralHardErrors(review)
  const itemIds = [...new Set(errors.map((issue) => issue.itemId).filter((value): value is string => Boolean(value)))]
  const repairableItemIds = itemIds.filter((itemId) => {
    const item = assessment.items.find((candidate) => candidate.id === itemId)
    return Boolean(item && AUTO_REPAIRABLE_AUTHORSHIP.has(item.authorshipState))
  })
  const unresolvedItemIds = itemIds.filter((itemId) => !repairableItemIds.includes(itemId))
  const globalErrors = errors.filter((issue) => !issue.itemId)
  return { review, errors, repairableItemIds, unresolvedItemIds, globalErrors }
}

export type AssessmentAutoPrepareProgress = {
  phase: 'generate' | 'repair' | 'review' | 'ready' | 'paused'
  round: number
  message: string
  itemId?: string
  itemNumber?: number
}

export type AssessmentAutoPrepareResult = {
  assessment: AssessmentRecord
  review: AssessmentFinalReview
  generated: number
  regenerated: number
  rounds: number
  providerPaused: boolean
  unresolvedItemIds: string[]
  globalBlockerCount: number
}

/**
 * Bounded one-click preparation loop.
 *
 * - Empty machine-owned slots are generated.
 * - Item-specific deterministic blockers on AI-generated items are regenerated
 *   as explicit alternatives.
 * - Teacher-authored/edited content is never overwritten automatically.
 * - Provider/auth/quota boundaries stop the loop immediately.
 * - There is no unbounded retry loop: at most `maxRounds` full QA passes.
 */
export async function autoPrepareAssessmentPaper(args: {
  assessment: AssessmentRecord
  demo: boolean
  teacherContext?: string
  signal?: AbortSignal
  maxRounds?: number
  onCheckpoint?: (assessment: AssessmentRecord) => Promise<void> | void
  onProgress?: (progress: AssessmentAutoPrepareProgress) => void
  generateMissing?: typeof generateMissingAssessmentItems
  generateItem?: typeof generateAssessmentItemSuggestion
}): Promise<AssessmentAutoPrepareResult> {
  const maxRounds = Math.max(1, Math.min(3, Math.floor(args.maxRounds ?? 2)))
  const generateMissing = args.generateMissing ?? generateMissingAssessmentItems
  const generateItem = args.generateItem ?? generateAssessmentItemSuggestion
  let working = args.assessment
  let generated = 0
  let regenerated = 0
  let providerPaused = false
  let completedRounds = 0

  for (let round = 1; round <= maxRounds; round += 1) {
    completedRounds = round
    if (args.signal?.aborted) break

    const missing = working.items.filter((item) => !item.prompt.trim() && item.authorshipState === 'empty' && item.locked !== true && item.qaState !== 'locked')
    if (missing.length) {
      args.onProgress?.({ phase: 'generate', round, message: `Generating ${missing.length} empty item${missing.length === 1 ? '' : 's'}.` })
      const summary = await generateMissing({
        assessment: working,
        demo: args.demo,
        itemIds: missing.map((item) => item.id),
        concurrency: 2,
        signal: args.signal,
        onSuggestion: (item) => {
          working = replaceItem(working, item)
          generated += 1
          args.onProgress?.({ phase: 'generate', round, itemId: item.id, itemNumber: item.itemNumber, message: `Generated Item ${item.itemNumber}.` })
        },
      })
      if (summary.errors.some((entry) => /429|quota|rate.?limit|provider limit|api key|credential|authentication required|not configured|rejected the (?:structured )?request configuration/i.test(entry.message))) {
        providerPaused = true
      }
      await args.onCheckpoint?.(working)
      if (providerPaused || args.signal?.aborted) break
    }

    args.onProgress?.({ phase: 'review', round, message: 'Running deterministic paper QA.' })
    const blockers = assessmentAutomationBlockers(working)
    if (!blockers.errors.length && !working.items.some((item) => !item.prompt.trim())) {
      args.onProgress?.({ phase: 'ready', round, message: 'No structural blockers remain.' })
      return { assessment: working, review: blockers.review, generated, regenerated, rounds: completedRounds, providerPaused: false, unresolvedItemIds: [], globalBlockerCount: 0 }
    }

    if (!blockers.repairableItemIds.length) {
      return {
        assessment: working,
        review: blockers.review,
        generated,
        regenerated,
        rounds: completedRounds,
        providerPaused: false,
        unresolvedItemIds: blockers.unresolvedItemIds,
        globalBlockerCount: blockers.globalErrors.length,
      }
    }

    args.onProgress?.({ phase: 'repair', round, message: `Regenerating ${blockers.repairableItemIds.length} blocked AI item${blockers.repairableItemIds.length === 1 ? '' : 's'}.` })
    for (const itemId of blockers.repairableItemIds) {
      if (args.signal?.aborted) break
      const current = working.items.find((item) => item.id === itemId)
      if (!current) continue
      const unlocked = unlockAssessmentItem(current)
      try {
        const suggestion = await generateItem({
          assessment: working,
          item: unlocked,
          demo: args.demo,
          alternative: true,
          teacherContext: args.teacherContext ?? working.instructions,
          signal: args.signal,
        })
        const replacement = applyAssessmentItemSuggestion(unlocked, suggestion, { alternative: true, source: 'repair' })
        working = replaceItem(working, replacement)
        regenerated += 1
        args.onProgress?.({ phase: 'repair', round, itemId, itemNumber: current.itemNumber, message: `Regenerated blocked Item ${current.itemNumber}.` })
      } catch (error) {
        if (providerBoundary(error)) {
          providerPaused = true
          args.onProgress?.({ phase: 'paused', round, itemId, itemNumber: current.itemNumber, message: 'AI preparation paused at a provider/quota boundary; saved work is preserved.' })
          break
        }
      }
    }
    await args.onCheckpoint?.(working)
    if (providerPaused || args.signal?.aborted) break
  }

  const blockers = assessmentAutomationBlockers(working)
  return {
    assessment: working,
    review: blockers.review,
    generated,
    regenerated,
    rounds: completedRounds,
    providerPaused,
    unresolvedItemIds: blockers.unresolvedItemIds,
    globalBlockerCount: blockers.globalErrors.length,
  }
}
