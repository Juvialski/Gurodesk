import type { AiSupportType } from '../types/lessonPlan'

export const LESSON_PLANNING_POLICY = {
  code: 'DO 016, s. 2026',
  title: 'Guidelines on Lesson Planning and Learning Design',
  sourceUrl: 'https://www.deped.gov.ph/wp-content/uploads/DO_s2026_016r.pdf',
  framework: 'ILAW',
  transitionNote: 'DLL/DLP may be used through Term 1 of SY 2026–2027; revised ILAW-aligned planning is fully implemented beginning Term 2.',
  aiRule: 'AI-generated planning suggestions are optional starting points. The teacher remains responsible for curriculum alignment, appropriateness, resource accuracy, adaptation, and the final instructional decisions.',
} as const

export const AI_SUPPORT_LABELS: Record<AiSupportType, string> = {
  refine_clarity: 'Refine clarity',
  organize_text: 'Organize text',
  grammar_spelling: 'Grammar & spelling',
  format_text: 'Format text',
  translate: 'Translate',
  suggest_learning_objectives: 'Objective suggestions',
  suggest_home_alternative: 'Home-learning suggestions',
  suggest_pre_lesson: 'Pre-lesson suggestions',
  suggest_lesson_flow: 'Lesson-flow suggestions',
  suggest_contextualization: 'Contextualization suggestions',
  suggest_inclusion: 'Inclusion suggestions',
  suggest_formative_assessment: 'Formative-assessment suggestions',
  suggest_evidence_of_learning: 'Evidence suggestions',
  suggest_next_steps: 'Next-step suggestions',
  suggest_extended_learning: 'Extended-learning suggestions',
  quick_draft: 'Quick Draft suggestions',
}

export const AI_SUPPORT_CATEGORIES: Record<AiSupportType, 'limited' | 'guided' | 'suggested'> = {
  refine_clarity: 'limited',
  organize_text: 'limited',
  grammar_spelling: 'guided',
  format_text: 'guided',
  translate: 'guided',
  suggest_learning_objectives: 'suggested',
  suggest_home_alternative: 'suggested',
  suggest_pre_lesson: 'suggested',
  suggest_lesson_flow: 'suggested',
  suggest_contextualization: 'suggested',
  suggest_inclusion: 'suggested',
  suggest_formative_assessment: 'suggested',
  suggest_evidence_of_learning: 'suggested',
  suggest_next_steps: 'suggested',
  suggest_extended_learning: 'suggested',
  quick_draft: 'suggested',
}

export function buildAiDeclaration(operations: AiSupportType[], reviewedByTeacher: boolean) {
  const unique = [...new Set(operations)]
  if (!unique.length) {
    return {
      used: false,
      categories: [] as Array<'limited' | 'guided' | 'suggested'>,
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
    statement: `AI assistance was used for planning suggestions and/or text support (${support}). The teacher remains responsible for reviewing, adapting, validating, and approving the final lesson plan.`,
    reviewedByTeacher,
  }
}
