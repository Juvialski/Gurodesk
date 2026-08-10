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


function blockerIssuesForItem(review: AssessmentFinalReview, itemId: string) {
  return structuralHardErrors(review).filter((issue) => issue.itemId === itemId)
}

function duplicatePeerContext(assessment: AssessmentRecord, messages: string[]) {
  const numbers = [...new Set(messages.flatMap((message) => [...message.matchAll(/Item\s+(\d+)/giu)].map((match) => Number(match[1]))))]
  return numbers.flatMap((itemNumber) => {
    const peer = assessment.items.find((item) => item.itemNumber === itemNumber)
    return peer?.prompt.trim() ? [`Avoid duplicating this existing prompt from Item ${itemNumber}: ${peer.prompt.trim().slice(0, 320)}`] : []
  }).slice(0, 2)
}

function blockerRepairContext(assessment: AssessmentRecord, itemId: string, teacherContext: string, round: number) {
  const review = reviewAssessmentForFinalization(assessment)
  const issues = blockerIssuesForItem(review, itemId)
  const messages = issues.map((issue) => `${issue.code}: ${issue.message}`)
  const visualIssue = issues.some((issue) => /visual|diagram|figure|graph|polygon|convex|regular/i.test(`${issue.code} ${issue.message}`))
  const duplicateIssue = issues.some((issue) => /duplicate/i.test(issue.code))
  return [
    teacherContext.trim(),
    'AUTOMATIC REPAIR REQUIREMENTS (must be satisfied in this replacement):',
    ...messages.slice(0, 6).map((message) => `- ${message}`),
    ...(visualIssue ? [round >= 2
      ? '- A previous visual repair did not clear QA. Prefer a self-contained text-only replacement with visual:null when the competency can be assessed without a figure. In that case, remove every visual/diagram/figure/graph reference from the learner prompt. If a visual is essential, replace it completely and make its geometry agree exactly with every claim in the prompt.'
      : '- If the learner prompt refers to a visual, attach a valid structured visual that agrees exactly with the prompt. If a visual is not necessary, rewrite the prompt so it is fully self-contained and contains no visual/diagram/figure/graph reference.'] : []),
    ...(duplicateIssue ? ['- Make this item materially different in wording, scenario, and evidence from nearby items while preserving the fixed competency, cognitive category, question type, and points.'] : []),
    ...duplicatePeerContext(assessment, messages),
  ].filter(Boolean).join('\n').slice(0, 1200)
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
  repairFailures: Array<{ itemId: string; itemNumber: number; message: string }>
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
  const maxRounds = Math.max(1, Math.min(3, Math.floor(args.maxRounds ?? 3)))
  const generateMissing = args.generateMissing ?? generateMissingAssessmentItems
  const generateItem = args.generateItem ?? generateAssessmentItemSuggestion
  let working = args.assessment
  let generated = 0
  let regenerated = 0
  let providerPaused = false
  let completedRounds = 0
  const repairFailures: Array<{ itemId: string; itemNumber: number; message: string }> = []

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
      return { assessment: working, review: blockers.review, generated, regenerated, rounds: completedRounds, providerPaused: false, unresolvedItemIds: [], globalBlockerCount: 0, repairFailures }
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
        repairFailures,
      }
    }

    args.onProgress?.({ phase: 'repair', round, message: `Unlocking and regenerating ${blockers.repairableItemIds.length} blocked AI item${blockers.repairableItemIds.length === 1 ? '' : 's'}.` })

    // The Edge Function reloads the item from Supabase and refuses AI work on a
    // persisted locked row. Unlock every machine-owned blocker and checkpoint
    // that state *before* calling Gemini. A local-only unlock looks correct in
    // React but the server will still reject it as locked.
    for (const itemId of blockers.repairableItemIds) {
      const current = working.items.find((item) => item.id === itemId)
      if (current) working = replaceItem(working, unlockAssessmentItem(current))
    }
    await args.onCheckpoint?.(working)

    for (const itemId of blockers.repairableItemIds) {
      if (args.signal?.aborted) break
      const current = working.items.find((item) => item.id === itemId)
      if (!current) continue
      const repairContext = blockerRepairContext(working, itemId, args.teacherContext ?? working.instructions, round)
      try {
        const suggestion = await generateItem({
          assessment: working,
          item: current,
          demo: args.demo,
          alternative: true,
          teacherContext: repairContext,
          signal: args.signal,
        })
        const replacement = applyAssessmentItemSuggestion(current, suggestion, { alternative: true, source: 'repair' })
        working = replaceItem(working, replacement)
        regenerated += 1
        for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === itemId) repairFailures.splice(index, 1)
        args.onProgress?.({ phase: 'repair', round, itemId, itemNumber: current.itemNumber, message: `Regenerated blocked Item ${current.itemNumber}.` })
      } catch (error) {
        if (providerBoundary(error)) {
          providerPaused = true
          args.onProgress?.({ phase: 'paused', round, itemId, itemNumber: current.itemNumber, message: 'AI preparation paused at a provider/quota boundary; saved work is preserved.' })
          break
        }
        const message = String((error as { message?: unknown })?.message ?? error ?? 'Unknown repair failure')
        for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === itemId) repairFailures.splice(index, 1)
        repairFailures.push({ itemId, itemNumber: current.itemNumber, message })
        args.onProgress?.({ phase: 'repair', round, itemId, itemNumber: current.itemNumber, message: `Item ${current.itemNumber} repair failed: ${message}` })
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
    repairFailures,
  }
}
