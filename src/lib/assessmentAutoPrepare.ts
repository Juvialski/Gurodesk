import type { AssessmentItem, AssessmentRecord } from '../types/assessment'
import { applyAssessmentItemSuggestion, assessmentItemNeedsQuestionGeneration, enrichAssessmentVisualsSequentially, generateAssessmentItemSuggestion, generateAssessmentVisualSuggestion, generateMissingAssessmentItems, type AssessmentItemCandidate } from './assessmentGeneration'
import { unlockAssessmentItem } from './assessmentItemLifecycle'
import { reviewAssessmentForFinalization, type AssessmentFinalReview } from './assessmentFinalReview'
import { assessmentVisualPlanForItem, assessmentVisualSourceHash, resolveAssessmentVisualPlans } from './assessmentVisualPlanning'

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

function visualOnlyBlockerIssues(review: AssessmentFinalReview, itemId: string) {
  const issues = blockerIssuesForItem(review, itemId)
  if (!issues.length) return []
  const visualIssues = issues.filter((issue) => /visual|diagram|figure|graph|polygon|cartesian/i.test(`${issue.code} ${issue.message}`))
  return visualIssues.length === issues.length ? visualIssues : []
}

function candidateForVisualRepair(item: AssessmentItem, issues: Array<{ code: string; message: string }>): AssessmentItemCandidate {
  const issueSummary = issues.map((issue) => `${issue.code}: ${issue.message}`).join(' | ').slice(0, 360)
  return {
    questionType: item.questionType,
    prompt: item.prompt,
    answer: item.answer,
    rationale: item.rationale ?? '',
    referencedResources: [],
    visualRequirement: 'required',
    visualIntent: `Create only the diagram needed by the existing learner prompt. Repair these deterministic issues: ${issueSummary}`.slice(0, 500),
  }
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
  const duplicateIssue = issues.some((issue) => /duplicate/i.test(issue.code))
  return [
    teacherContext.trim(),
    'AUTOMATIC REPAIR REQUIREMENTS (must be satisfied in this replacement):',
    ...messages.slice(0, 6).map((message) => `- ${message}`),
    ...(duplicateIssue ? ['- Make this item materially different in wording, scenario, and evidence from nearby items while preserving the fixed competency, cognitive category, question type, and points.'] : []),
    ...duplicatePeerContext(assessment, messages),
  ].filter(Boolean).join('\n').slice(0, 1200)
}

export type AssessmentAutoPrepareProgress = {
  phase: 'generate' | 'visual' | 'repair' | 'review' | 'ready' | 'paused'
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
  generateVisual?: typeof generateAssessmentVisualSuggestion
  enrichVisuals?: typeof enrichAssessmentVisualsSequentially
}): Promise<AssessmentAutoPrepareResult> {
  const maxRounds = Math.max(1, Math.min(3, Math.floor(args.maxRounds ?? 3)))
  const generateMissing = args.generateMissing ?? generateMissingAssessmentItems
  const generateItem = args.generateItem ?? generateAssessmentItemSuggestion
  const generateVisual = args.generateVisual ?? generateAssessmentVisualSuggestion
  const enrichVisuals = args.enrichVisuals ?? enrichAssessmentVisualsSequentially
  // Resolve the whole paper before the first pass. This persists optional
  // candidates that are intentionally skipped as none/not_required, while
  // required prompts and existing teacher visuals remain untouched.
  const initialVisualBalance = resolveAssessmentVisualPlans(args.assessment.items, { learningArea: args.assessment.learningArea, visualPolicy: args.assessment.settings?.visualPolicy })
  let working: AssessmentRecord = { ...args.assessment, items: initialVisualBalance.items }
  let generated = 0
  let regenerated = 0
  let providerPaused = false
  let completedRounds = 0
  const repairFailures: Array<{ itemId: string; itemNumber: number; message: string }> = []
  const visualRepairAttempted = new Set<string>()
  const questionRepairAttempted = new Set<string>()

  for (let round = 1; round <= maxRounds; round += 1) {
    completedRounds = round
    if (args.signal?.aborted) break

    const missing = working.items.filter(assessmentItemNeedsQuestionGeneration)
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
          for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === item.id) repairFailures.splice(index, 1)
          args.onProgress?.({ phase: 'generate', round, itemId: item.id, itemNumber: item.itemNumber, message: `Generated Item ${item.itemNumber}.` })
        },
      })
      for (const failure of summary.errors) {
        const failedItem = working.items.find((item) => item.id === failure.itemId)
        if (!failedItem) continue
        for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === failure.itemId) repairFailures.splice(index, 1)
        repairFailures.push({ itemId: failure.itemId, itemNumber: failedItem.itemNumber, message: `Question generation failed: ${failure.message}` })
      }
      if (summary.providerPaused || summary.errors.some((entry) => /429|quota|rate.?limit|provider limit|api key|credential|authentication required|not configured|rejected the (?:structured )?request configuration/i.test(entry.message))) {
        providerPaused = true
      }
      await args.onCheckpoint?.(working)
      if (providerPaused || args.signal?.aborted) break
    }

    const visualBalance = resolveAssessmentVisualPlans(working.items, { learningArea: working.learningArea, visualPolicy: working.settings?.visualPolicy })
    working = { ...working, items: visualBalance.items }
    await args.onCheckpoint?.(working)
    const visualIds = new Set([...visualBalance.requiredItemIds, ...visualBalance.optionalItemIds])
    const visualCandidates = working.items.filter((item) => visualIds.has(item.id) && !item.locked && item.qaState !== 'locked' && assessmentVisualPlanForItem(item).eligible)
    if (visualCandidates.length) {
      args.onProgress?.({ phase: 'visual', round, message: `Enriching ${visualCandidates.length} diagram${visualCandidates.length === 1 ? '' : 's'} sequentially.` })
      const visualSummary = await enrichVisuals({
        assessment: working,
        demo: args.demo,
        itemIds: visualCandidates.map((item) => item.id),
        signal: args.signal,
        generate: generateVisual,
        onItem: (item, outcome) => {
          working = replaceItem(working, item)
          args.onProgress?.({ phase: 'visual', round, itemId: item.id, itemNumber: item.itemNumber, message: outcome.status === 'success' ? `Added the visual for Item ${item.itemNumber}.` : `Item ${item.itemNumber} kept its question; visual enrichment needs review.` })
        },
      })
      await args.onCheckpoint?.(working)
      if (visualSummary.providerPaused || args.signal?.aborted) {
        providerPaused = true
        break
      }
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

    let attemptedRepairThisRound = false
    for (const itemId of blockers.repairableItemIds) {
      if (args.signal?.aborted) break
      const current = working.items.find((item) => item.id === itemId)
      if (!current) continue
      const repairContext = blockerRepairContext(working, itemId, args.teacherContext ?? working.instructions, round)
      try {
        const visualIssues = visualOnlyBlockerIssues(blockers.review, itemId)
        if (visualIssues.length) {
          if (visualRepairAttempted.has(itemId)) {
            const message = 'Dedicated visual repair already reached its one automatic retry limit; the question was preserved unchanged.'
            for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === itemId) repairFailures.splice(index, 1)
            repairFailures.push({ itemId, itemNumber: current.itemNumber, message })
            args.onProgress?.({ phase: 'repair', round, itemId, itemNumber: current.itemNumber, message: `Item ${current.itemNumber} visual still needs review; the question was not regenerated.` })
            continue
          }
          visualRepairAttempted.add(itemId)
          attemptedRepairThisRound = true
          const candidate = candidateForVisualRepair(current, visualIssues)
          const visualResult = await generateVisual({ assessment: working, item: current, candidate, visualIntent: candidate.visualIntent, issues: visualIssues.map((issue) => `${issue.code}: ${issue.message}`), demo: args.demo, signal: args.signal })
          if (!visualResult.visual) throw new Error('Dedicated visual generation returned no usable diagram.')
          const visualUpdatedAt = new Date().toISOString()
          working = replaceItem(working, { ...current, visual: visualResult.visual, visualRequirement: 'required', visualIntent: candidate.visualIntent, visualStatus: 'succeeded', visualAttempts: (current.visualAttempts ?? 0) + 1, visualError: undefined, visualSourceHash: assessmentVisualSourceHash(current), visualUpdatedAt, locked: false, qaState: 'generated' })
          regenerated += 1
          for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === itemId) repairFailures.splice(index, 1)
          args.onProgress?.({ phase: 'repair', round, itemId, itemNumber: current.itemNumber, message: `Repaired only the visual for Item ${current.itemNumber}; question text and answer were preserved.` })
        } else {
          if (questionRepairAttempted.has(itemId)) {
            const message = 'Question repair already reached its one automatic retry limit; the saved question was preserved for teacher review.'
            for (let index = repairFailures.length - 1; index >= 0; index -= 1) if (repairFailures[index].itemId === itemId) repairFailures.splice(index, 1)
            repairFailures.push({ itemId, itemNumber: current.itemNumber, message })
            args.onProgress?.({ phase: 'repair', round, itemId, itemNumber: current.itemNumber, message: `Item ${current.itemNumber} still needs teacher review; no second automatic question replacement was attempted.` })
            continue
          }
          questionRepairAttempted.add(itemId)
          attemptedRepairThisRound = true
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
        }
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
    // If every remaining AI-owned blocker has already consumed its one bounded
    // repair path, another full QA round cannot improve the paper. Return it to
    // teacher review instead of repeating the same messages/provider work.
    if (!attemptedRepairThisRound) break
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
