import type { AiSupportType } from '../types/lessonPlan'

export const LESSON_PLANNING_POLICY = {
  code: 'DO 016, s. 2026',
  title: 'Guidelines on Lesson Planning and Learning Design',
  sourceUrl: 'https://www.deped.gov.ph/wp-content/uploads/DO_s2026_016r.pdf',
  framework: 'ILAW',
  transitionNote: 'DLL/DLP may be used through Term 1 of SY 2026–2027; revised ILAW-aligned planning is fully implemented beginning Term 2.',
  aiRule: 'AI is auxiliary only. The teacher must make core instructional decisions. Fully AI-generated lesson plans are not allowed.',
} as const

export const AI_SUPPORT_LABELS: Record<AiSupportType, string> = {
  refine_clarity: 'Refine clarity',
  organize_text: 'Organize text',
  grammar_spelling: 'Grammar & spelling',
  format_text: 'Format text',
  translate: 'Translate',
}

export const AI_SUPPORT_CATEGORIES: Record<AiSupportType, 'limited' | 'guided'> = {
  refine_clarity: 'limited',
  organize_text: 'limited',
  grammar_spelling: 'guided',
  format_text: 'guided',
  translate: 'guided',
}

export function buildAiDeclaration(operations: AiSupportType[], reviewedByTeacher: boolean) {
  const unique = [...new Set(operations)]
  if (!unique.length) {
    return {
      used: false,
      categories: [] as Array<'limited' | 'guided'>,
      operations: unique,
      statement: 'No AI assistance was used in the preparation of this lesson plan.',
      reviewedByTeacher,
    }
  }

  const categories = [...new Set(unique.map((item) => AI_SUPPORT_CATEGORIES[item]))]
  const support = unique.map((item) => AI_SUPPORT_LABELS[item].toLowerCase()).join(', ')
  return {
    used: true,
    categories,
    operations: unique,
    statement: `AI assistance was used only for permitted support tasks (${support}) after the teacher made the core instructional decisions. All AI-assisted text was reviewed and adapted by the teacher.`,
    reviewedByTeacher,
  }
}
