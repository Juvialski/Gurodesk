import type { AssessmentItem } from '../types/assessment'
import type { AssessmentVisualRequirement, AssessmentVisualStatus } from '../types/assessmentVisual'
import { normalizeAssessmentMathText } from './assessmentMathText'

const VISUAL_DEPENDENCY = /\b(?:shown|provided|given)\s+(?:in\s+)?(?:the\s+)?(?:visual|diagram|figure|graph)|\b(?:provided|shown)\s+(?:geometric\s+)?(?:polygon|shape)\b|\b(?:refer to|use|from)\s+(?:the\s+)?(?:visual|diagram|figure|graph)|\b(?:diagram|figure|graph)\s+(?:shows|illustrates|depicts)\b/iu
const HELPFUL_GEOMETRY = /\b(?:angle relationships?|adjacent angles?|vertical angles?|complementary angles?|supplementary angles?|interior angles?|exterior angles?|polygon|triangle|quadrilateral|pentagon|hexagon|heptagon|octagon|nonagon|decagon|parallel lines?|perpendicular lines?|transversal|congruen(?:t|ce)|similar triangles?|circle|radius|diameter|chord|arc|coordinate plane|cartesian|plot|graph(?:ing)?\s+(?:a|the|this)?\s*(?:function|relation|line|curve)|anggulo|poligon|tatsulok|parisukat|bilog|koordinat|grap)\b/iu
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
  return `visual-source-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function promptRequiresAssessmentVisual(prompt: string) {
  return VISUAL_DEPENDENCY.test(clean(prompt, 10_000))
}

export function assessmentContentWouldBenefitFromVisual(item: Pick<AssessmentItem, 'prompt' | 'competencySnapshot'>) {
  const prompt = clean(item.prompt, 10_000)
  return Boolean(prompt) && HELPFUL_GEOMETRY.test(`${prompt} ${clean(item.competencySnapshot?.text, 4_000)}`)
}

function defaultVisualIntent(item: Pick<AssessmentItem, 'prompt' | 'competencySnapshot'>) {
  const topic = clean(item.competencySnapshot?.text, 240) || clean(item.prompt, 240) || 'the mathematical relationship in the question'
  return `Create a clean, learner-safe diagram that clarifies ${topic}. Include only labels and measures needed by the prompt; do not reveal the answer.`.slice(0, 500)
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

/** Resolve legacy records, generated metadata, and conservative local heuristics. */
export function assessmentVisualPlanForItem(item: AssessmentItem): AssessmentVisualPlan {
  const sourceHash = assessmentVisualSourceHash(item)
  const storedRequirement = VISUAL_REQUIREMENTS.has(item.visualRequirement as AssessmentVisualRequirement) ? item.visualRequirement as AssessmentVisualRequirement : undefined
  const promptRequired = promptRequiresAssessmentVisual(item.prompt)
  const helpful = assessmentContentWouldBenefitFromVisual(item)
  const requirement: AssessmentVisualRequirement = promptRequired
    ? 'required'
    : storedRequirement === 'required' || storedRequirement === 'helpful'
      ? storedRequirement
      : helpful || Boolean(item.visual)
        ? 'helpful'
        : 'none'
  const heuristicUpgraded = requirement !== (storedRequirement ?? 'none')
  const intent = requirement === 'none' ? '' : clean(item.visualIntent) || defaultVisualIntent(item)
  const storedStatus = VISUAL_STATUSES.has(item.visualStatus as AssessmentVisualStatus) ? item.visualStatus as AssessmentVisualStatus : undefined
  const current = Boolean(item.visual) && (!item.visualSourceHash || item.visualSourceHash === sourceHash) && storedStatus !== 'stale'
  let status: AssessmentVisualStatus
  if (requirement === 'none') status = item.visual ? (current ? 'succeeded' : 'stale') : 'not_required'
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

export function withResolvedAssessmentVisualPlan(item: AssessmentItem): AssessmentItem {
  const plan = assessmentVisualPlanForItem(item)
  return {
    ...item,
    visualRequirement: plan.requirement,
    visualIntent: plan.intent,
    visualStatus: plan.status,
    visualAttempts: plan.attempts,
    visualError: plan.error || undefined,
    visualSourceHash: item.visual && !plan.current ? item.visualSourceHash : plan.sourceHash,
    visualUpdatedAt: plan.updatedAt || undefined,
  }
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
