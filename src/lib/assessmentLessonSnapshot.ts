import type { AssessmentCompetencySnapshot, AssessmentLessonSourceSnapshot } from '../types/assessment'
import type { LessonPlanContent, LessonPlanRecord } from '../types/lessonPlan'

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

export type LessonSnapshotSourceInput =
  | LessonPlanRecord
  | {
      id: string
      title?: string
      schoolYear?: string
      academicPeriodLabel?: string | null
      updatedAt?: string
      versionNumber?: number
      content: LessonPlanContent
    }

export function extractObjectivesFromText(text: string | null | undefined): string[] {
  if (!text || typeof text !== 'string') return []
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-*•\d.)\]]+/, '').trim())
    .filter((line) => line.length > 0)
}

/**
 * Creates a compact, authoritative, and immutable snapshot of a lesson plan
 * for historical preservation and assessment generation.
 *
 * It avoids copying the entire lesson plan tree (e.g. detailed lesson flows,
 * reflections, AI declarations) while preserving every standard, competency,
 * objective, and contextual field needed for test blueprinting.
 */
export function createLessonSourceSnapshot(
  input: LessonSnapshotSourceInput
): AssessmentLessonSourceSnapshot {
  const content = input.content
  const rawAlignments = Array.isArray(content?.curriculumAlignments) && content.curriculumAlignments.length > 0
    ? content.curriculumAlignments
    : content?.competency && content.competency.id
    ? [content.competency]
    : Array.isArray((content as any)?.competencies)
    ? (content as any).competencies
    : []

  const competencies: AssessmentCompetencySnapshot[] = rawAlignments
    .filter((comp: any) => comp && (Boolean(comp.id) || Boolean(comp.statement) || Boolean(comp.text)))
    .map((comp: any, index: number) => ({
      id: comp.id || `comp-${index + 1}`,
      code: comp.code ?? comp.competencyCode ?? null,
      text: comp.text || comp.statement || comp.title || '',
      sourcePage: comp.sourcePage ?? null,
      academicPeriodId: comp.academicPeriodId ?? null,
      curriculumPeriodId: comp.academicPeriodId ?? null,
      curriculumPeriodLabel: comp.curriculumPeriodLabel || content?.curriculumPeriodLabel || '',
      contentStandards: comp.contentStandards && comp.contentStandards.length > 0 ? [...comp.contentStandards] : undefined,
      performanceStandards: comp.performanceStandards && comp.performanceStandards.length > 0 ? [...comp.performanceStandards] : undefined,
    }))

  let learningObjectives: string[] = []
  if (Array.isArray((content as any)?.learningObjectives)) {
    learningObjectives = (content as any).learningObjectives.map((o: any) => String(o).trim()).filter(Boolean)
  } else if (typeof (content as any)?.learningObjectives === 'string') {
    learningObjectives = extractObjectivesFromText((content as any).learningObjectives)
  } else if (Array.isArray(content?.intentions?.learningObjectives)) {
    learningObjectives = (content.intentions.learningObjectives as any[]).map((o: any) => String(o).trim()).filter(Boolean)
  } else if (typeof content?.intentions?.learningObjectives === 'string') {
    learningObjectives = extractObjectivesFromText(content.intentions.learningObjectives)
    if (learningObjectives.length === 0 && content.intentions.learningObjectives.trim()) {
      learningObjectives.push(content.intentions.learningObjectives.trim())
    }
  }

  const contentStandardsSet = new Set<string>()
  const performanceStandardsSet = new Set<string>()

  for (const comp of rawAlignments) {
    if (Array.isArray(comp.contentStandards)) {
      comp.contentStandards.forEach((s: any) => {
        if (s && String(s).trim()) contentStandardsSet.add(String(s).trim())
      })
    }
    if (Array.isArray(comp.performanceStandards)) {
      comp.performanceStandards.forEach((s: any) => {
        if (s && String(s).trim()) performanceStandardsSet.add(String(s).trim())
      })
    }
  }

  const curriculumPeriodLabels: string[] = []
  if (content?.curriculumPeriodLabel?.trim()) {
    curriculumPeriodLabels.push(content.curriculumPeriodLabel.trim())
  }

  const rawResources = content?.learningExperience?.resources || content?.references || ''
  const resources = rawResources.trim() ? [rawResources.trim()] : undefined

  const versionNumber = Number.isSafeInteger((input as any).versionNumber) && (input as any).versionNumber > 0
    ? (input as any).versionNumber
    : undefined

  return {
    id: input.id,
    versionNumber,
    title: input.title || content?.lessonTitle || 'Lesson Plan',
    lessonTitle: content?.lessonTitle || input.title || '',
    lessonFocus: content?.lessonFocus || '',
    gradeLevel: content?.gradeLevel || '',
    learningArea: content?.learningArea || '',
    schoolYear: content?.schoolYear || input.schoolYear || '',
    gradingTermLabel: content?.gradingTermLabel || input.academicPeriodLabel || '',
    curriculumPeriodLabels,
    learningObjectives,
    competencies: clone(competencies),
    contentStandards: Array.from(contentStandardsSet),
    performanceStandards: Array.from(performanceStandardsSet),
    lessonPerformanceStandard: content?.performanceStandard?.trim() || undefined,
    resources,
    sourceUpdatedAt: input.updatedAt || undefined,
  }
}

/**
 * Type guard for AssessmentLessonSourceSnapshot.
 */
export function isLessonSourceSnapshot(value: unknown): value is AssessmentLessonSourceSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.competencies) &&
    Array.isArray(candidate.learningObjectives)
  )
}
