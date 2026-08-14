import type { AssessmentItem, AssessmentRecord } from '../types/assessment'

export type AssessmentSourcePresentation = {
  label: string
  title: string
  protectionText: string
}

function compactLessonTitles(record: AssessmentRecord): string {
  const titles = (record.sourceLessons ?? []).map((lesson) => lesson.title?.trim()).filter(Boolean) as string[]
  if (record.sourceLesson?.title?.trim() && !titles.includes(record.sourceLesson.title.trim())) titles.unshift(record.sourceLesson.title.trim())
  if (!titles.length) return 'Selected lesson plans'
  if (titles.length === 1) return titles[0]
  return `${titles[0]} + ${titles.length - 1} more lesson${titles.length - 1 === 1 ? '' : 's'}`
}

export function assessmentSourcePresentation(record: AssessmentRecord): AssessmentSourcePresentation {
  if (record.mode === 'lesson_quiz') {
    return {
      label: 'Based on lesson plan',
      title: record.sourceLesson?.title?.trim() || compactLessonTitles(record),
      protectionText: 'Lesson coverage mapping stays protected.',
    }
  }

  if (record.mode === 'unit_quiz') {
    return {
      label: 'Based on lesson plans',
      title: compactLessonTitles(record),
      protectionText: 'Lesson coverage mappings stay protected.',
    }
  }

  if (record.mode === 'performance_task') {
    if (record.sourceType === 'lesson_plan') {
      return {
        label: 'Based on lesson plan',
        title: record.sourceLesson?.title?.trim() || compactLessonTitles(record),
        protectionText: 'Performance-task provenance and rubric alignment stay protected.',
      }
    }
    if (record.sourceType === 'multi_lesson_plan') {
      return {
        label: 'Based on lesson plans',
        title: compactLessonTitles(record),
        protectionText: 'Performance-task provenance and rubric alignment stay protected.',
      }
    }
    return {
      label: 'Based on finalized TOS',
      title: record.sourceTos?.title?.trim() || 'Finalized TOS',
      protectionText: 'Performance-task provenance and rubric alignment stay protected.',
    }
  }

  return {
    label: 'Based on finalized TOS',
    title: record.sourceTos?.title?.trim() || 'Finalized TOS',
    protectionText: 'TOS mapping stays protected.',
  }
}

export function assessmentItemSourcePresentation(item: AssessmentItem): {
  label: string
  lockLabel: string
} {
  if (item.mapping?.kind === 'lesson_coverage') {
    return {
      label: 'Based on lesson coverage',
      lockLabel: 'Lesson coverage mapping locked',
    }
  }
  return {
    label: 'Based on this TOS',
    lockLabel: 'TOS mapping locked',
  }
}
