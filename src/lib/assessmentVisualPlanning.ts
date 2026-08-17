import type { AssessmentItem, AssessmentRecord, AssessmentVisualPolicy } from '../types/assessment'
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
const HELPFUL_GEOMETRY = /\b(?:angle relationships?|adjacent angles?|vertical angles?|complementary angles?|supplementary angles?|linear pairs?|interior angles?|exterior angles?|parallel lines?|perpendicular lines?|transversal|regular polygons?|irregular polygons?|convex polygons?|non[- ]?convex polygons?|concave polygons?|congruen(?:t|ce)|similar triangles?|circle (?:parts?|relationships?|theorems?)|radius\s+(?:and|to)\s+diameter|chords?\s+(?:and|with)\s+arcs?|coordinate plane|cartesian (?:plane|graph)|plot(?:ting)?\s+(?:points?|a|the|this)|graph(?:ing)?\s+(?:a|the|this)?\s*(?:function|relation|line|curve)|angulo|poligon|tatsulok|parisukat|koordinat|grap)\b/iu
const REQUIRED_VISUAL_COMPETENCY = /(?:\b(?:visuali[sz]e|illustrate|draw|construct|sketch|plot|graph|locate|measure|analy[sz]e|compare|classify|identify|determine)\b[\s\S]{0,120}\b(?:angles?|polygons?|triangles?|quadrilaterals?|circles?|parallel lines?|perpendicular lines?|transversal|coordinate plane|cartesian|number line|geometric figures?|symmetry|rotation|reflection|translation)\b|\b(?:angle relationships?|parallel lines?\s+(?:and|with)\s+(?:a\s+)?transversal|perpendicular relationships?|coordinate plane|cartesian graph|graph(?:ing)?\s+(?:a|the|this)?\s*(?:function|relation|line|curve)|transformations?\s+of\s+geometric figures?|line or rotational symmetry)\b)/iu
const VISUAL_REQUIREMENTS = new Set<AssessmentVisualRequirement>(['none', 'helpful', 'required'])
const VISUAL_STATUSES = new Set<AssessmentVisualStatus>(['not_required', 'pending', 'running', 'succeeded', 'failed', 'stale'])

const AUTOMATIC_VISUAL_LEARNING_AREAS = /(?:^|\b)(?:mathematics|math|calculus|science|physics|chemistry|biology|geometry|statistics|stem|tle)(?:\b|$)/iu

export function assessmentLearningAreaSupportsAutomaticVisuals(learningArea: unknown) {
  return AUTOMATIC_VISUAL_LEARNING_AREAS.test(clean(learningArea, 240))
}

function normalizedVisualPolicy(value: AssessmentVisualPolicy | undefined): AssessmentVisualPolicy {
  return value === 'off' || value === 'more_visuals' ? value : 'balanced'
}

function policyBudget(itemCount: number, policy: AssessmentVisualPolicy) {
  const count = Math.max(0, Math.floor(itemCount))
  if (policy === 'off' || count < 1) return 0
  if (policy === 'more_visuals') return Math.ceil(count / 2)
  // Balanced deliberately uses floor, so papers with 1-3 items receive no
  // automatic visual and a five-item paper receives at most one.
  return Math.floor(count / 4)
}

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

export function assessmentContentWouldBenefitFromVisual(item: Pick<AssessmentItem, 'prompt' | 'competencySnapshot'>, learningArea: unknown = 'Mathematics') {
  if (!assessmentLearningAreaSupportsAutomaticVisuals(learningArea)) return false
  const prompt = clean(item.prompt, 10_000)
  return Boolean(prompt) && HELPFUL_GEOMETRY.test(prompt + ' ' + clean(item.competencySnapshot?.text, 4_000))
}

function defaultVisualIntent(item: Pick<AssessmentItem, 'prompt' | 'competencySnapshot'>) {
  const topic = clean(item.competencySnapshot?.text, 240) || clean(item.prompt, 240) || 'the mathematical relationship in the question'
  return ('Create a clean, learner-safe diagram that clarifies ' + topic + '. Include only labels and measures needed by the prompt; do not reveal the answer.').slice(0, 500)
}

function requiredVisualIntent(item: Pick<AssessmentItem, 'competencySnapshot'>) {
  const topic = clean(item.competencySnapshot?.text, 260) || 'the mapped mathematical competency'
  return (`Create the essential mathematical diagram for a question about ${topic}. Put at least one necessary given, label, measure, position, or relationship only in the diagram so the learner cannot answer from the written stem alone. Do not reveal the answer.`).slice(0, 500)
}

export type AssessmentRequiredVisualReservationOptions = {
  ratio?: number
  cap?: number
  learningArea?: string
  visualPolicy?: AssessmentVisualPolicy
}

/**
 * Reserve a small, deterministic set of EMPTY blueprint slots as truly visual
 * questions before Gemini writes the stems. Reserved questions must later be
 * authored so the diagram is part of the problem data, never page decoration.
 */
export function reserveAssessmentRequiredVisualSlots(items: readonly AssessmentItem[], options: AssessmentRequiredVisualReservationOptions = {}) {
  const source = [...items]
  const policy = normalizedVisualPolicy(options.visualPolicy)
  const autoEnabled = assessmentLearningAreaSupportsAutomaticVisuals(options.learningArea ?? 'Mathematics') && policy !== 'off'
  const ratio = Number.isFinite(Number(options.ratio)) ? Math.max(0, Math.min(1, Number(options.ratio))) : undefined
  const budget = !autoEnabled ? 0 : options.cap !== undefined
    ? Math.max(0, Math.floor(Number(options.cap) || 0))
    : ratio !== undefined
      ? Math.max(0, Math.floor(source.length * ratio))
      : policyBudget(source.length, policy)
  const alreadyRequired = source.filter((item) => item.visualRequirement === 'required' && (!item.prompt.trim() || promptRequiresAssessmentVisual(item.prompt))).length
  const remaining = Math.max(0, budget - alreadyRequired)
  const candidates = source
    .filter((item) => autoEnabled && !item.prompt.trim() && !item.visual && item.authorshipState === 'empty' && REQUIRED_VISUAL_COMPETENCY.test(clean(item.competencySnapshot?.text, 4000)))
    .sort((left, right) => left.itemNumber - right.itemNumber || left.id.localeCompare(right.id, 'en'))
  const selectedCandidates: AssessmentItem[] = []
  const selectedIds = new Set<string>()
  const competencyIds = new Set<string>()
  // First distribute across competencies, choosing candidates nearest evenly
  // spaced paper positions instead of consuming the first eligible slots.
  const targets = Array.from({ length: remaining }, (_, index) => ((index + 1) * (source.length + 1)) / (remaining + 1))
  for (const target of targets) {
    const available = candidates.filter((item) => !selectedIds.has(item.id))
    if (!available.length) break
    const unusedCompetency = available.filter((item) => !competencyIds.has(competencyKey(item)))
    const pool = unusedCompetency.length ? unusedCompetency : available
    const chosen = [...pool].sort((left, right) => Math.abs(left.itemNumber - target) - Math.abs(right.itemNumber - target) || left.itemNumber - right.itemNumber || left.id.localeCompare(right.id, 'en'))[0]
    selectedCandidates.push(chosen)
    selectedIds.add(chosen.id)
    competencyIds.add(competencyKey(chosen))
  }
  const selected = new Set(selectedCandidates.map((item) => item.id))
  const itemsWithReservations = source.map((item) => {
    if (selected.has(item.id)) {
      return {
        ...item,
        visualRequirement: 'required' as const,
        visualIntent: requiredVisualIntent(item),
        visualStatus: 'pending' as const,
        visualAttempts: 0,
        visualError: undefined,
        visualSourceHash: undefined,
        visualUpdatedAt: new Date().toISOString(),
      }
    }
    if (!item.prompt.trim() && !item.visual && item.visualRequirement !== 'required') {
      return {
        ...item,
        visualRequirement: 'none' as const,
        visualIntent: '',
        visualStatus: 'not_required' as const,
        visualAttempts: 0,
        visualError: undefined,
        visualSourceHash: undefined,
        visualUpdatedAt: undefined,
      }
    }
    return item
  })
  return { items: itemsWithReservations, budget, reservedItemIds: [...selected] }
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
  learningArea?: string
  visualPolicy?: AssessmentVisualPolicy
}

function suppressedOptionalPlan(item: AssessmentItem, sourceHash: string) {
  /*
   * 'none + not_required' is a balance decision only for the exact question
   * content that produced it. Empty blueprint slots and newly generated/edited
   * questions must be reconsidered instead of inheriting stale suppression.
   */
  return Boolean(item.prompt.trim())
    && !item.visual
    && item.visualRequirement === 'none'
    && item.visualStatus === 'not_required'
    && item.visualSourceHash === sourceHash
}

/** Resolve legacy records, generated metadata, and conservative local heuristics. */
export function assessmentVisualPlanForItem(item: AssessmentItem, options: AssessmentVisualPlanOptions = {}): AssessmentVisualPlan {
  const sourceHash = assessmentVisualSourceHash(item)
  const storedRequirement = VISUAL_REQUIREMENTS.has(item.visualRequirement as AssessmentVisualRequirement) ? item.visualRequirement as AssessmentVisualRequirement : undefined
  const promptRequired = promptRequiresAssessmentVisual(item.prompt)
  const suppressed = !options.force && !options.ignoreSuppression && suppressedOptionalPlan(item, sourceHash) && !promptRequired
  const reservedRequired = !item.prompt.trim() && storedRequirement === 'required' && Boolean(clean(item.visualIntent))
  const policy = normalizedVisualPolicy(options.visualPolicy)
  const helpful = policy !== 'off' && assessmentContentWouldBenefitFromVisual(item, options.learningArea ?? 'Mathematics')
  // Empty slots may carry a server-persisted pre-generation REQUIRED reservation.
  // Once a question exists, only explicit learner-facing dependency makes it
  // required. Helpful/legacy planning remains available for teacher-authored
  // items, while auto-generated text-only items persist an exact suppression
  // hash so this heuristic cannot add cosmetic diagrams afterward.
  const requirement: AssessmentVisualRequirement = reservedRequired || promptRequired
    ? 'required'
    : suppressed
      ? 'none'
      : storedRequirement === 'required' || storedRequirement === 'helpful'
        ? 'helpful'
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
  learningArea?: string
  visualPolicy?: AssessmentVisualPolicy
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

const VISUAL_PROMPT_DUPLICATE_THRESHOLD = 0.82

function competencyKey(item: AssessmentItem) {
  return clean(item.competencySnapshot?.id, 180) || clean(item.competencySnapshot?.text, 240) || 'unmapped'
}

function optionalVisualBudget(itemCount: number, options: AssessmentVisualBalanceOptions) {
  const policy = normalizedVisualPolicy(options.visualPolicy)
  if (policy === 'off' || !assessmentLearningAreaSupportsAutomaticVisuals(options.learningArea ?? 'Mathematics')) return 0
  if (options.optionalCap !== undefined) return Math.max(0, Math.floor(Number(options.optionalCap) || 0))
  if (Number.isFinite(Number(options.optionalRatio))) {
    const ratio = Math.max(0, Math.min(1, Number(options.optionalRatio)))
    return Math.max(0, Math.floor(Math.max(0, itemCount) * ratio))
  }
  return policyBudget(itemCount, policy)
}

function planItem(item: AssessmentItem, plan: AssessmentVisualPlan, keep: boolean): AssessmentItem {
  // Preserve an explicit pre-generation REQUIRED reservation on an empty slot;
  // clear all other empty-slot visual metadata so stale planning cannot leak.
  if (!item.prompt.trim() && !item.visual) {
    if (item.visualRequirement === 'required' && clean(item.visualIntent)) {
      return {
        ...item,
        visualRequirement: 'required',
        visualIntent: clean(item.visualIntent),
        visualStatus: 'pending',
        visualAttempts: Math.max(0, Math.min(20, Math.floor(Number(item.visualAttempts) || 0))),
        visualError: undefined,
        visualSourceHash: undefined,
        visualUpdatedAt: item.visualUpdatedAt || undefined,
      }
    }
    return {
      ...item,
      visualRequirement: undefined,
      visualIntent: undefined,
      visualStatus: undefined,
      visualAttempts: undefined,
      visualError: undefined,
      visualSourceHash: undefined,
      visualUpdatedAt: undefined,
    }
  }
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
  const automaticRequiredCount = requiredEntries.filter(({ item }) => item.authorshipState === 'empty' || item.authorshipState === 'ai_suggestion').length
  const maxAttempts = Math.max(1, Math.min(20, Math.floor(options.maxAttempts ?? 2)))
  const optionalCandidates = entries
    .filter(({ plan, item }) => plan.requirement === 'helpful' && (options.force || !item.visual || !plan.current) && (options.force || plan.attempts < maxAttempts))
    .sort((left, right) => {
      const leftStored = left.item.visualRequirement === 'helpful' ? 0 : 1
      const rightStored = right.item.visualRequirement === 'helpful' ? 0 : 1
      return leftStored - rightStored || left.item.itemNumber - right.item.itemNumber || left.item.id.localeCompare(right.item.id, 'en')
    })
  const optionalLimit = options.force ? optionalCandidates.length : Math.max(0, optionalBudget - currentOptionalCount - automaticRequiredCount)
  const selectedOptional: typeof optionalCandidates = []
  const selectedCompetencies = new Set<string>()
  const selectedIds = new Set<string>()
  const select = (entry: typeof optionalCandidates[number]) => {
    if (selectedOptional.length >= optionalLimit || selectedIds.has(entry.item.id)) return
    selectedOptional.push(entry)
    selectedIds.add(entry.item.id)
    selectedCompetencies.add(competencyKey(entry.item))
  }

  // Choose around evenly spaced paper positions. Prefer a competency not yet
  // represented at each target, then a materially different prompt. This keeps
  // a visual-heavy topic from clustering diagrams at the start of the paper.
  const targets = Array.from({ length: optionalLimit }, (_, index) => ((index + 1) * (Math.max(1, source.length) + 1)) / (optionalLimit + 1))
  for (const target of targets) {
    const available = optionalCandidates.filter(({ item }) => !selectedIds.has(item.id))
    if (!available.length) break
    const unusedCompetency = available.filter(({ item }) => !selectedCompetencies.has(competencyKey(item)))
    const basePool = unusedCompetency.length ? unusedCompetency : available
    const distinctPrompt = basePool.filter(({ item }) => {
      const related = selectedOptional.filter(({ item: selectedItem }) => competencyKey(selectedItem) === competencyKey(item))
      return related.length === 0 || related.every(({ item: selectedItem }) => visualPromptSimilarity(selectedItem.prompt, item.prompt) < VISUAL_PROMPT_DUPLICATE_THRESHOLD)
    })
    // If every remaining candidate from an already represented competency is
    // near-identical, leave budget unused rather than add repetitive diagrams.
    if (!distinctPrompt.length) continue
    // If the first pool is only one near-identical competency cluster, keep
    // its stable first representative instead of choosing a target-nearest
    // duplicate (for example item 3 of eight identical prompts). Distinct
    // candidates still use the evenly-spaced paper targets below.
    const firstCandidate = basePool[0]
    const oneDuplicateCluster = selectedOptional.length === 0
      && basePool.length > 1
      && basePool.every(({ item }) => competencyKey(item) === competencyKey(firstCandidate.item)
        && visualPromptSimilarity(firstCandidate.item.prompt, item.prompt) >= VISUAL_PROMPT_DUPLICATE_THRESHOLD)
    const chosen = oneDuplicateCluster
      ? firstCandidate
      : [...distinctPrompt].sort((left, right) => {
          const distance = Math.abs(left.item.itemNumber - target) - Math.abs(right.item.itemNumber - target)
          if (distance !== 0) return distance
          const leftStored = left.item.visualRequirement === 'helpful' ? 0 : 1
          const rightStored = right.item.visualRequirement === 'helpful' ? 0 : 1
          return leftStored - rightStored || left.item.itemNumber - right.item.itemNumber || left.item.id.localeCompare(right.item.id, 'en')
        })[0]
    select(chosen)
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


/** Assessment-level guard: immutable finalized/archived papers are never
 * re-planned merely because they are reopened or navigated back from preview. */
export function resolveAssessmentVisualPlansForRecord(
  record: Pick<AssessmentRecord, 'status' | 'items' | 'learningArea' | 'settings'>,
  options: Omit<AssessmentVisualBalanceOptions, 'learningArea' | 'visualPolicy'> = {},
): AssessmentVisualBalance {
  if (record.status !== 'draft') {
    return { items: record.items, optionalBudget: 0, requiredItemIds: [], optionalItemIds: [], skippedOptionalItemIds: [] }
  }
  return resolveAssessmentVisualPlans(record.items, {
    ...options,
    learningArea: record.learningArea,
    visualPolicy: record.settings?.visualPolicy,
  })
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
