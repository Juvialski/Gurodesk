import type { AssessmentItem } from '../types/assessment'
import type { AssessmentVisualRequirement, AssessmentVisualStatus } from '../types/assessmentVisual'
import { normalizeAssessmentMathText } from './assessmentMathText'

/*
 * A visual is required only when the learner is explicitly told to use a
 * figure that is part of the question. Merely mentioning a shape is not a
 * dependency: “What is a polygon?” remains a normal text-only question.
 */
const VISUAL_DEPENDENCY = /\b(?:shown|provided|given|displayed|illustrated)\s+(?:in\s+)?(?:the\s+)?(?:visual|diagram|figure|graph|polygon|shape)\b|\b(?:as|using|from|refer\s+to|use)\s+(?:the\s+)?(?:shown|provided|given|attached|following)\b|\b(?:refer\s+to|use|from)\s+(?:the\s+)?(?:visual|diagram|figure|graph)\b|\b(?:diagram|figure|graph)\s+(?:shows|illustrates|depicts)\b/iu

/*
 * Keep optional candidates to relationships/representations, not bare shape
 * nouns. The assessment-level selector applies a one-in-four budget.
 */
const HELPFUL_GEOMETRY = /\b(?:angle relationships?|adjacent angles?|vertical angles?|complementary angles?|supplementary angles?|interior angles?|exterior angles?|parallel lines?|perpendicular lines?|transversal|congruen(?:t|ce)|similar triangles?|circle|radius|diameter|chord|arc|coordinate plane|cartesian|plot|graph(?:ing)?\s+(?:a|the|this)?\s*(?:function|relation|line|curve)|angulo|poligon|tatsulok|parisukat|bilog|koordinat|grap)\b/iu
const VISUAL_REQUIREMENTS = new Set<AssessmentVisualRequirement>(['none', 'helpful', 'required'])
const VISUAL_STATUSES = new Set<AssessmentVisualStatus>(['not_required', 'pending', 'running', 'succeeded', 'failed', 'stale'])

function clean(value: unknown, limit = 500) {
  return typeof value === 'string' ? normalizeAssessmentMathText(value).trim().slice(0, limit) : ''
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right, 'en')).map(([key, entry]) => [key, stableValue(entry)]))
}

/** Small deterministic fingerprint for stale-result detection, not security. */
export function assessmentVisualSourceHash(item: Pick<AssessmentItem, 'questionType' | 'prompt' | 'answer'>) {
  const input = JSON.stringify(stableValue({ questionType: item.questionType, prompt: clean(item.prompt, 10_000), answer: item.answer }))
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return 'visual-source-v1-' + (hash >>> 0).toString(16).padStart(8, '0')
}

export function promptRequiresAssessmentVisual(prompt: string) {
  return VISUAL_DEPENDENCY.test(clean(prompt, 10_000))
}

export function assessmentContentWouldBenefitFromVisual(item: Pick<AssessmentItem, 'prompt' | 'competencySnapshot'>) {
  const prompt = clean(item.prompt, 10_000)
  return Boolean(prompt) && HELPFUL_GEOMETRY.test(prompt + ' ' + clean(item.competencySnapshot?.text, 4_000))
}

function defaultVisualIntent(item: Pick<AssessmentItem, 'prompt' | 'competencySnapshot'>) {
  const topic = clean(item.competencySnapshot?.text, 240) || clean(item.prompt, 240) || 'the mathematical relationship in the question'
  return ('Create a clean, learner-safe diagram that clarifies ' + topic + '. Include only labels and measures needed by the prompt; do not reveal the answer.').slice(0, 500)
}

export type AssessmentVisualPlan = {
  requirement: AssessmentVisualRequirement
  intent: string
  status: AssessmentVisualStatus
  attempts: number
  error: string
  sourceHash: string
  updatedAt: string
  eligible: boolean
  current: boolean
  heuristicUpgraded: boolean
}

type AssessmentVisualPlanOptions = {
  /** Explicit regenerate paths may recover a skipped optional plan. */
  force?: boolean
  /** Internal escape hatch used while resolving a previously skipped item. */
  ignoreSuppression?: boolean
}

function suppressedOptionalPlan(item: AssessmentItem) {
  /*
   * 'none + not_required' is our persisted decision that this optional visual
   * was intentionally skipped by the paper-level balance. It is distinct from
   * old records that omitted a plan entirely; a content edit clears the status.
   */
  return !item.visual && item.visualRequirement === 'none' && item.visualStatus === 'not_required'
}

/** Resolve legacy records, generated metadata, and conservative local heuristics. */
export function assessmentVisualPlanForItem(item: AssessmentItem, options: AssessmentVisualPlanOptions = {}): AssessmentVisualPlan {
  const sourceHash = assessmentVisualSourceHash(item)
  const storedRequirement = VISUAL_REQUIREMENTS.has(item.visualRequirement as AssessmentVisualRequirement) ? item.visualRequirement as AssessmentVisualRequirement : undefined
  const promptRequired = promptRequiresAssessmentVisual(item.prompt)
  const suppressed = !options.force && !options.ignoreSuppression && suppressedOptionalPlan(item) && !promptRequired
  const helpful = assessmentContentWouldBenefitFromVisual(item)
  const requirement: AssessmentVisualRequirement = promptRequired
    ? 'required'
    : suppressed
      ? 'none'
      : storedRequirement === 'required' || storedRequirement === 'helpful'
        ? storedRequirement
        : helpful || Boolean(item.visual)
          ? 'helpful'
          : 'none'
  const heuristicUpgraded = !suppressed && requirement !== (storedRequirement ?? 'none')
  const intent = requirement === 'none' ? '' : clean(item.visualIntent) || defaultVisualIntent(item)
  const storedStatus = VISUAL_STATUSES.has(item.visualStatus as AssessmentVisualStatus) ? item.visualStatus as AssessmentVisualStatus : undefined
  const current = Boolean(item.visual) && (!item.visualSourceHash || item.visualSourceHash === sourceHash) && storedStatus !== 'stale'
  let status: AssessmentVisualStatus
  if (suppressed) status = 'not_required'
  else if (requirement === 'none') status = item.visual ? (current ? 'succeeded' : 'stale') : 'not_required'
  else if (item.visual) status = current ? 'succeeded' : 'stale'
  else if (storedStatus === 'failed' && item.visualSourceHash === sourceHash) status = 'failed'
  else status = 'pending'
  return {
    requirement,
    intent,
    status,
    attempts: Math.max(0, Math.min(20, Math.floor(Number(item.visualAttempts) || 0))),
    error: clean(item.visualError, 600),
    sourceHash,
    updatedAt: clean(item.visualUpdatedAt, 80),
    eligible: requirement !== 'none' && !current,
    current,
    heuristicUpgraded,
  }
}

export type AssessmentVisualBalanceOptions = {
  /** Fraction of the paper that may receive optional visuals. Defaults to 1/4. */
  optionalRatio?: number
  /** Explicit cap used by tests or a teacher-controlled policy. */
  optionalCap?: number
  /** A failed optional request is not selected forever after this many tries. */
  maxAttempts?: number
  /** Manual regenerate/force paths may bypass the optional budget. */
  force?: boolean
}

export type AssessmentVisualBalance = {
  items: AssessmentItem[]
  optionalBudget: number
  requiredItemIds: string[]
  optionalItemIds: string[]
  skippedOptionalItemIds: string[]
}

function visualPromptTokens(value: unknown) {
  return new Set(clean(value, 10_000).toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/u).filter((token) => token.length > 1))
}

function visualPromptSimilarity(left: string, right: string) {
  const a = visualPromptTokens(left)
  const b = visualPromptTokens(right)
  if (a.size < 2 || b.size < 2) return 0
  const intersection = [...a].filter((token) => b.has(token)).length
  return (2 * intersection) / (a.size + b.size)
}

function competencyKey(item: AssessmentItem) {
  return clean(item.competencySnapshot?.id, 180) || clean(item.competencySnapshot?.text, 240) || 'unmapped'
}

function optionalVisualBudget(itemCount: number, options: AssessmentVisualBalanceOptions) {
  if (options.optionalCap !== undefined) return Math.max(0, Math.floor(Number(options.optionalCap) || 0))
  const ratio = Number.isFinite(Number(options.optionalRatio)) ? Math.max(0, Math.min(1, Number(options.optionalRatio))) : 0.25
  return Math.max(0, Math.ceil(Math.max(0, itemCount) * ratio))
}

function planItem(item: AssessmentItem, plan: AssessmentVisualPlan, keep: boolean): AssessmentItem {
  if (!keep && plan.requirement === 'helpful' && !item.visual) {
    return {
      ...item,
      visualRequirement: 'none',
      visualIntent: '',
      visualStatus: 'not_required',
      visualAttempts: plan.attempts,
      visualError: undefined,
      visualSourceHash: plan.sourceHash,
      visualUpdatedAt: plan.updatedAt || undefined,
    }
  }
  return {
    ...item,
    visualRequirement: plan.requirement,
    visualIntent: plan.intent,
    visualStatus: plan.status,
    visualAttempts: plan.attempts,
    visualError: plan.error || undefined,
    visualSourceHash: item.visual && !plan.current ? (item.visualSourceHash || plan.sourceHash) : plan.sourceHash,
    visualUpdatedAt: plan.updatedAt || undefined,
  }
}

/**
 * Resolve visual plans for a whole paper.
 *
 * Required visuals are never budgeted. Optional candidates receive at most
 * roughly one visual per four questions, with a deterministic first pass that
 * spreads selections across competencies and a second pass that rejects
 * near-identical prompts. Unselected optional candidates are persisted as
 * none/not_required, so they do not remain perpetually pending in the UI.
 */
export function resolveAssessmentVisualPlans(items: readonly AssessmentItem[], options: AssessmentVisualBalanceOptions = {}): AssessmentVisualBalance {
  const source = [...items]
  const entries = source.map((item) => ({ item, plan: assessmentVisualPlanForItem(item, options) }))
  const nonemptyCount = source.filter((item) => item.prompt.trim()).length
  const optionalBudget = optionalVisualBudget(nonemptyCount, options)
  const requiredEntries = entries.filter(({ plan }) => plan.requirement === 'required')
  const currentOptionalCount = entries.filter(({ plan }) => plan.requirement === 'helpful' && plan.current).length
  const maxAttempts = Math.max(1, Math.min(20, Math.floor(options.maxAttempts ?? 2)))
  const optionalCandidates = entries
    .filter(({ plan, item }) => plan.requirement === 'helpful' && (options.force || !item.visual || !plan.current) && (options.force || plan.attempts < maxAttempts))
    .sort((left, right) => {
      const leftStored = left.item.visualRequirement === 'helpful' ? 0 : 1
      const rightStored = right.item.visualRequirement === 'helpful' ? 0 : 1
      return leftStored - rightStored || left.item.itemNumber - right.item.itemNumber || left.item.id.localeCompare(right.item.id, 'en')
    })
  const optionalLimit = options.force ? optionalCandidates.length : Math.max(0, optionalBudget - currentOptionalCount)
  const selectedOptional: typeof optionalCandidates = []
  const selectedCompetencies = new Set<string>()
  const select = (entry: typeof optionalCandidates[number]) => {
    if (selectedOptional.length >= optionalLimit || selectedOptional.some(({ item }) => item.id === entry.item.id)) return
    selectedOptional.push(entry)
    selectedCompetencies.add(competencyKey(entry.item))
  }

  // First pass: one optional diagram per competency, in stable item order.
  for (const entry of optionalCandidates) {
    if (selectedOptional.length >= optionalLimit) break
    if (!selectedCompetencies.has(competencyKey(entry.item))) select(entry)
  }
  // Second pass: use remaining room only for materially different prompts.
  for (const entry of optionalCandidates) {
    if (selectedOptional.length >= optionalLimit) break
    if (selectedOptional.some(({ item }) => item.id === entry.item.id)) continue
    const key = competencyKey(entry.item)
    const related = selectedOptional.filter(({ item }) => competencyKey(item) === key)
    if (related.length === 0 || related.every(({ item }) => visualPromptSimilarity(item.prompt, entry.item.prompt) < 0.78)) select(entry)
  }

  const requiredItemIds = requiredEntries.map(({ item }) => item.id)
  const optionalItemIds = selectedOptional.map(({ item }) => item.id)
  const keepIds = new Set([...requiredItemIds, ...optionalItemIds])
  const skippedOptionalItemIds = optionalCandidates.filter(({ item }) => !keepIds.has(item.id)).map(({ item }) => item.id)
  const resolvedItems = entries.map(({ item, plan }) => {
    const keep = keepIds.has(item.id) || Boolean(item.visual)
    return planItem(item, plan, keep)
  })
  return { items: resolvedItems, optionalBudget, requiredItemIds, optionalItemIds, skippedOptionalItemIds }
}

/** Convenience for callers that only need the next deterministic work list. */
export function assessmentVisualItemIdsForAssessment(items: readonly AssessmentItem[], options: AssessmentVisualBalanceOptions = {}) {
  const balance = resolveAssessmentVisualPlans(items, options)
  return balance.items
    .filter((item) => balance.requiredItemIds.includes(item.id) || balance.optionalItemIds.includes(item.id))
    .filter((item) => assessmentVisualPlanForItem(item, options).eligible)
    .map((item) => item.id)
}

export function withResolvedAssessmentVisualPlan(item: AssessmentItem, options: AssessmentVisualPlanOptions = {}): AssessmentItem {
  const plan = assessmentVisualPlanForItem(item, options)
  return planItem(item, plan, true)
}

/** Preserve an old visual for teacher review, but never call it current after a
 * prompt, answer, or question-type edit. */
export function invalidateAssessmentVisualAfterContentEdit(previous: AssessmentItem, next: AssessmentItem): AssessmentItem {
  const previousHash = assessmentVisualSourceHash(previous)
  const nextHash = assessmentVisualSourceHash(next)
  if (previousHash === nextHash) return next
  const nextPlan = assessmentVisualPlanForItem({ ...next, visualSourceHash: nextHash, visualStatus: undefined })
  return {
    ...next,
    visualRequirement: nextPlan.requirement,
    visualIntent: nextPlan.intent,
    visualStatus: next.visual ? 'stale' : nextPlan.requirement === 'none' ? 'not_required' : 'pending',
    visualSourceHash: next.visual ? (previous.visualSourceHash || previousHash) : nextHash,
    visualError: undefined,
    visualUpdatedAt: new Date().toISOString(),
  }
}
