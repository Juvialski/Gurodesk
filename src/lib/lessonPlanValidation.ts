import type { LessonPlanContent, LessonPlanValidationResult } from '../types/lessonPlan'

function hasText(value: string, minimum = 8) {
  return value.trim().length >= minimum
}

export function validateLessonPlan(content: LessonPlanContent): LessonPlanValidationResult {
  const items = [
    {
      key: 'competency',
      label: 'Verified competency is attached',
      passed: Boolean(content.competency.id && hasText(content.competency.text, 12)),
      detail: 'Intentions must begin from a verified curriculum competency.',
    },
    {
      key: 'objectives',
      label: 'Teacher-authored learning objectives are clear',
      passed: hasText(content.intentions.learningObjectives, 20),
      detail: 'The teacher—not AI—must unpack or sequence the competency into manageable objectives.',
    },
    {
      key: 'experience',
      label: 'Learning experience is teachable and coherent',
      passed: hasText(content.learningExperience.preLessonActivity, 12) && hasText(content.learningExperience.lessonFlow, 40),
      detail: 'Another teacher should be able to understand the intended flow without guessing.',
    },
    {
      key: 'resources',
      label: 'Learning resources are identified',
      passed: hasText(content.learningExperience.resources, 5),
      detail: 'Resources should be relevant and aligned with the objectives.',
    },
    {
      key: 'context',
      label: 'Learner context or contextualization is considered',
      passed: hasText(content.learnerContext, 12) || hasText(content.learningExperience.integrationContextualization, 12),
      detail: 'Planning should respond to learner readiness, context, culture, or available resources.',
    },
    {
      key: 'assessment',
      label: 'Formative assessment is integrated',
      passed: hasText(content.assessingLearning.formativeAssessments, 20) && hasText(content.assessingLearning.evidenceOfLearning, 12),
      detail: 'Checks should generate evidence that can guide immediate instructional decisions.',
    },
    {
      key: 'ways-forward',
      label: 'Ways forward are actionable',
      passed: hasText(content.waysForward.nextSteps, 15),
      detail: 'Identify likely remediation, reteaching, enrichment, or next instructional steps.',
    },
    {
      key: 'ai-review',
      label: 'AI-assisted text has teacher review',
      passed: !content.aiDeclaration.used || content.aiDeclaration.reviewedByTeacher,
      detail: 'Any permitted AI support must remain subject to teacher review, validation, and adaptation.',
    },
  ]

  const score = Math.round((items.filter((item) => item.passed).length / items.length) * 100)
  return { ready: items.every((item) => item.passed), score, items }
}
