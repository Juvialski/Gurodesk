import type {
  AssessmentCognitiveCategorySnapshot,
  AssessmentCompetencySnapshot,
  AssessmentCoveragePlan,
  AssessmentCoveragePlanEntry,
  AssessmentCoveragePlanLesson,
  AssessmentLessonSourceSnapshot,
} from '../types/assessment'

export const DEFAULT_LESSON_COGNITIVE_CATEGORIES: readonly AssessmentCognitiveCategorySnapshot[] = [
  { id: 'remembering', label: 'Remembering', shortLabel: 'REM' },
  { id: 'understanding', label: 'Understanding', shortLabel: 'UND' },
  { id: 'applying', label: 'Applying', shortLabel: 'APP' },
  { id: 'analyzing', label: 'Analyzing', shortLabel: 'ANA' },
  { id: 'evaluating', label: 'Evaluating', shortLabel: 'EVA' },
  { id: 'creating', label: 'Creating', shortLabel: 'CRE' },
]

export type AggregatedCompetency = AssessmentCompetencySnapshot & {
  sourceLessonIds: string[]
}

export type AggregatedObjective = {
  text: string
  normalizedKey: string
  sourceLessonIds: string[]
}

/**
 * Deduplicate competencies across multiple lessons using their canonical ID first.
 * Preserves every source lesson contributing to a merged competency.
 * Never silently merges different competencies even if wording is similar.
 */
export function deduplicateCompetencies(
  lessons: readonly AssessmentLessonSourceSnapshot[]
): AggregatedCompetency[] {
  const map = new Map<string, AggregatedCompetency>()

  for (const lesson of lessons) {
    for (const comp of lesson.competencies) {
      if (!comp || !comp.id) continue
      const existing = map.get(comp.id)
      if (!existing) {
        map.set(comp.id, {
          ...comp,
          contentStandards: comp.contentStandards ? [...comp.contentStandards] : undefined,
          performanceStandards: comp.performanceStandards ? [...comp.performanceStandards] : undefined,
          sourceLessonIds: [lesson.id],
        })
      } else {
        if (!existing.sourceLessonIds.includes(lesson.id)) {
          existing.sourceLessonIds.push(lesson.id)
        }
        if (comp.contentStandards) {
          const current = new Set(existing.contentStandards ?? [])
          comp.contentStandards.forEach((s) => current.add(s))
          existing.contentStandards = Array.from(current)
        }
        if (comp.performanceStandards) {
          const current = new Set(existing.performanceStandards ?? [])
          comp.performanceStandards.forEach((s) => current.add(s))
          existing.performanceStandards = Array.from(current)
        }
      }
    }
  }

  return Array.from(map.values())
}

function normalizeObjectiveText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Aggregates free-form learning objectives across lessons with conservative
 * text normalization for duplicate suppression while tracking source lessons.
 */
export function aggregateLearningObjectives(
  lessons: readonly AssessmentLessonSourceSnapshot[]
): AggregatedObjective[] {
  const map = new Map<string, AggregatedObjective>()

  for (const lesson of lessons) {
    for (const objText of lesson.learningObjectives) {
      const trimmed = objText.trim()
      if (!trimmed) continue
      const key = normalizeObjectiveText(trimmed)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          text: trimmed,
          normalizedKey: key,
          sourceLessonIds: [lesson.id],
        })
      } else {
        if (!existing.sourceLessonIds.includes(lesson.id)) {
          existing.sourceLessonIds.push(lesson.id)
        }
      }
    }
  }

  return Array.from(map.values())
}

/**
 * Stable Hamilton / Largest-Remainder allocation for integers.
 * Ensures the sum of allocated integers equals `total` exactly.
 */
export function allocateLargestRemainder(
  total: number,
  weights: readonly number[]
): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error('Total items to allocate must be a nonnegative safe integer.')
  }
  if (weights.length === 0) return []
  if (total === 0) return weights.map(() => 0)

  const nonNegativeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const sum = nonNegativeWeights.reduce((acc, val) => acc + val, 0)

  if (sum <= 0) {
    const base = Math.floor(total / weights.length)
    const remainder = total - base * weights.length
    return weights.map((_, index) => base + (index < remainder ? 1 : 0))
  }

  const exactQuotas = nonNegativeWeights.map((w) => (total * w) / sum)
  const baseCounts = exactQuotas.map((q) => Math.floor(q))
  let remaining = total - baseCounts.reduce((acc, val) => acc + val, 0)

  const remainders = exactQuotas.map((quota, index) => ({
    index,
    fraction: quota - baseCounts[index],
  }))

  // Sort by fractional remainder descending; ties broken stably by original index
  remainders.sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  const result = [...baseCounts]
  for (const item of remainders) {
    if (remaining <= 0) break
    result[item.index] += 1
    remaining -= 1
  }

  return result
}

export type CoverageAllocationOptions = {
  lessons: readonly AssessmentLessonSourceSnapshot[]
  totalItems: number
  lessonWeights?: Record<string, number>
  cognitiveCategories?: readonly AssessmentCognitiveCategorySnapshot[]
}

/**
 * Deterministically constructs an Assessment Coverage Plan for a multi-lesson unit quiz.
 * Allocates integer items across lessons using largest-remainder distribution,
 * then maps items to lesson competencies and cognitive categories.
 */
export function allocateLessonCoverage(
  options: CoverageAllocationOptions
): AssessmentCoveragePlan {
  const { lessons, totalItems } = options
  if (!lessons || lessons.length === 0) {
    throw new Error('At least one lesson source snapshot is required to build a coverage plan.')
  }
  if (!Number.isSafeInteger(totalItems) || totalItems < 1) {
    throw new Error('Total items must be a positive integer.')
  }

  const categories = options.cognitiveCategories && options.cognitiveCategories.length > 0
    ? options.cognitiveCategories
    : DEFAULT_LESSON_COGNITIVE_CATEGORIES

  // Calculate lesson weights (defaults to 1 per lesson)
  const weights = lessons.map((l) => {
    const raw = options.lessonWeights?.[l.id]
    return raw !== undefined && Number.isFinite(raw) && raw > 0 ? raw : 1
  })

  // 1. Allocate item slots to each lesson
  const lessonItemCounts = allocateLargestRemainder(totalItems, weights)

  const planLessons: AssessmentCoveragePlanLesson[] = lessons.map((lesson, index) => ({
    lessonId: lesson.id,
    title: lesson.title,
    lessonTitle: lesson.lessonTitle,
    weight: weights[index],
    allocatedItemCount: lessonItemCounts[index],
    competencyCount: lesson.competencies.length,
  }))

  const entries: AssessmentCoveragePlanEntry[] = []
  let itemNumberCursor = 1

  // 2. For each lesson with > 0 items, distribute items across its competencies & cognitive categories
  lessons.forEach((lesson, lessonIndex) => {
    const allocatedForLesson = lessonItemCounts[lessonIndex]
    if (allocatedForLesson <= 0) return

    const competencies = lesson.competencies.length > 0
      ? lesson.competencies
      : [{
          id: `topic-${lesson.id}`,
          code: null,
          text: lesson.lessonFocus || lesson.lessonTitle || lesson.title,
          sourcePage: null,
          academicPeriodId: null,
          curriculumPeriodId: null,
          curriculumPeriodLabel: lesson.gradingTermLabel || '',
        }]

    // Equal allocation across competencies in this lesson
    const compWeights = competencies.map(() => 1)
    const compItemCounts = allocateLargestRemainder(allocatedForLesson, compWeights)

    competencies.forEach((comp, compIndex) => {
      const compItems = compItemCounts[compIndex]
      if (compItems <= 0) return

      // Distribute compItems across cognitive categories
      const catWeights = categories.map(() => 1)
      const catItemCounts = allocateLargestRemainder(compItems, catWeights)

      categories.forEach((cat, catIndex) => {
        const count = catItemCounts[catIndex]
        if (count <= 0) return

        const itemNumbers: number[] = []
        for (let i = 0; i < count; i += 1) {
          itemNumbers.push(itemNumberCursor)
          itemNumberCursor += 1
        }

        const entryId = `cov-${lesson.id}-${comp.id}-${cat.id}`
        entries.push({
          id: entryId,
          sourceLessonId: lesson.id,
          lessonTitle: lesson.lessonTitle || lesson.title,
          competencyId: comp.id,
          competencyCode: comp.code ?? null,
          competencyStatement: comp.text,
          cognitiveCategoryId: cat.id,
          cognitiveCategoryLabel: cat.label,
          targetItemCount: count,
          targetPoints: count,
          allocatedItemNumbers: itemNumbers,
          sourceObjectiveTexts: lesson.learningObjectives.slice(0, 3),
        })
      })
    })
  })

  // Ensure total allocated matches totalItems
  const totalAllocated = entries.reduce((sum, e) => sum + e.targetItemCount, 0)
  if (totalAllocated !== totalItems) {
    throw new Error(`Internal error: Coverage allocation mismatch. Expected ${totalItems}, got ${totalAllocated}.`)
  }

  return {
    lessons: planLessons,
    entries,
    totalItems,
  }
}
