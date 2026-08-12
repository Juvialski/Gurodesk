import type { AssessmentV2PointBucket, QuestionType } from '../types/assessment'
import type { TosRecord } from '../types/tos'
import {
  QUESTION_TYPE_POINT_RULES,
  plannerEligibleTypesForCpd,
  validateAndFinalizeMasterPlan,
  validateAssessmentV2Setup,
  type AssessmentV2Setup,
} from './assessmentGenerationV2'
import { supabase } from './supabase'

type Row = Record<string, unknown>
type ProviderEntry = {
  bucketId: string
  questionType: QuestionType
  pointsPossible: number
  taskIntent: string
  visualRequirement: 'none' | 'required'
  visualIntent: string
}

function clean(value: unknown, max = 2000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }

function localBucketPlan(bucket: AssessmentV2PointBucket, setup: AssessmentV2Setup, learningArea: string, bucketIndex = 0): ProviderEntry[] {
  const rawEligible = plannerEligibleTypesForCpd(setup.allowedTypes, bucket.cpdKey, learningArea)
    .map((questionType) => ({ questionType, ...QUESTION_TYPE_POINT_RULES[questionType] }))
  // Rotate types based on bucketIndex to ensure diverse representation across selected formats
  const rotateCount = rawEligible.length > 0 ? bucketIndex % rawEligible.length : 0
  const rotated = [...rawEligible.slice(rotateCount), ...rawEligible.slice(0, rotateCount)]
  const eligible = rotated.sort((left, right) => right.preferred - left.preferred)
  const total = bucket.pointsAllocated
  const dp: Array<Array<{ questionType: QuestionType; points: number }> | null> = new Array(total + 1).fill(null)
  dp[0] = []
  for (let current = 0; current <= total; current += 1) {
    if (!dp[current]) continue
    for (const type of eligible) {
      const values = Array.from({ length: type.max - type.min + 1 }, (_, offset) => type.min + offset)
        .sort((a, b) => Math.abs(a - type.preferred) - Math.abs(b - type.preferred) || b - a)
      for (const points of values) {
        if (current + points > total || dp[current + points]) continue
        dp[current + points] = [...dp[current]!, { questionType: type.questionType, points }]
      }
    }
  }
  const result = dp[total]
  if (!result) throw new Error(`The ${bucket.cognitiveLabel} point allocation cannot be planned from the selected question types.`)
  return result.map((entry) => ({
    bucketId: bucket.id,
    questionType: entry.questionType,
    pointsPossible: entry.points,
    taskIntent: `Create a ${bucket.cognitiveLabel.toLocaleLowerCase('en')} task aligned only to: ${bucket.competencyText}`,
    visualRequirement: 'none' as const,
    visualIntent: '',
  }))
}

function interleaveByBucket(groups: ProviderEntry[][]) {
  const result: ProviderEntry[] = []
  const queues = groups.map((group) => [...group])
  while (queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const entry = queue.shift()
      if (entry) result.push(entry)
    }
  }
  return result
}

function providerBuckets(buckets: AssessmentV2PointBucket[], setup: AssessmentV2Setup, learningArea: string) {
  return buckets.map((bucket) => ({
    id: bucket.id,
    rowId: bucket.rowId,
    competencyId: bucket.competencyId,
    competencyText: bucket.competencyText,
    cognitiveCategoryId: bucket.cognitiveCategoryId,
    cognitiveLabel: bucket.cognitiveLabel,
    cpdKey: bucket.cpdKey,
    pointsAllocated: bucket.pointsAllocated,
    eligibleTypes: plannerEligibleTypesForCpd(setup.allowedTypes, bucket.cpdKey, learningArea).map((questionType) => ({
      questionType,
      minPoints: QUESTION_TYPE_POINT_RULES[questionType].min,
      maxPoints: QUESTION_TYPE_POINT_RULES[questionType].max,
      preferredPoints: QUESTION_TYPE_POINT_RULES[questionType].preferred,
    })),
  }))
}

async function invokePlanner(body: Row, signal?: AbortSignal) {
  if (!supabase) throw new Error('Assessment master planner is unavailable in this workspace.')
  const response = await supabase.functions.invoke('assessment-master-planner', { body, signal })
  if (!response.error) return (response.data ?? {}) as Row
  const errorValue = response.error as unknown as { message?: string; context?: { json?: () => Promise<unknown> } }
  let message = clean(errorValue.message, 600) || 'The master assessment planner could not complete the request.'
  try {
    const payload = typeof errorValue.context?.json === 'function' ? await errorValue.context.json() : null
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) message = clean((payload as Row).error, 600) || message
  } catch { /* response body may already be consumed */ }
  throw new Error(message)
}

export type MasterPlannerResult = {
  pointBuckets: AssessmentV2PointBucket[]
  plan: NonNullable<ReturnType<typeof validateAndFinalizeMasterPlan>>
  model: string
  fallbackUsed: boolean
  providerRequestCount: number
}

export async function createAssessmentMasterPlan(args: {
  tos: TosRecord
  setup: AssessmentV2Setup
  demo: boolean
  title?: string
  instructions?: string
  signal?: AbortSignal
}): Promise<MasterPlannerResult> {
  const setupValidation = validateAssessmentV2Setup(args.tos, args.setup)
  if (!setupValidation.ready) throw new Error(setupValidation.errors[0]?.message ?? 'Assessment setup is not ready for generation.')
  const pointBuckets = setupValidation.pointBuckets

  if (args.demo || !supabase) {
    const raw = { entries: interleaveByBucket(pointBuckets.map((bucket, index) => localBucketPlan(bucket, args.setup, args.tos.content.learningArea, index))) }
    const plan = validateAndFinalizeMasterPlan(raw, {
      pointBuckets,
      allowedTypes: args.setup.allowedTypes,
      learningArea: args.tos.content.learningArea,
      totalPoints: args.setup.totalPoints,
      plannerModel: 'demo-deterministic-master-planner',
      visualPolicy: args.setup.visualPolicy,
    })
    return { pointBuckets, plan, model: plan.plannerModel, fallbackUsed: false, providerRequestCount: 0 }
  }

  const data = await invokePlanner({
    sourceTosId: args.tos.id,
    totalPoints: args.setup.totalPoints,
    visualPolicy: args.setup.visualPolicy,
    allowedTypes: args.setup.allowedTypes,
    title: clean(args.title, 240),
    instructions: [clean(args.instructions, 3000), clean(args.setup.generationInstructions, 3000)].filter(Boolean).join('\nPlanning guidance: ').slice(0, 5000),
    pointBuckets: providerBuckets(pointBuckets, args.setup, args.tos.content.learningArea),
  }, args.signal)

  const model = clean(data.model, 120) || 'unknown'
  const fallbackUsed = data.fallbackUsed === true
  const plan = validateAndFinalizeMasterPlan({ entries: data.entries }, {
    pointBuckets,
    allowedTypes: args.setup.allowedTypes,
    learningArea: args.tos.content.learningArea,
    totalPoints: args.setup.totalPoints,
    plannerModel: model,
    plannerFallbackUsed: fallbackUsed,
    visualPolicy: args.setup.visualPolicy,
  })
  return {
    pointBuckets,
    plan,
    model,
    fallbackUsed,
    providerRequestCount: Number.isSafeInteger(Number(data.providerRequestCount)) ? Number(data.providerRequestCount) : 1,
  }
}
