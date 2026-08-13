import type { LessonPlanContent, LessonPlanValidationResult } from '../types/lessonPlan'
import { getPrimaryLessonCompetency } from './lessonPlanAlignment'

function hasText(value: string, minimum = 8) {
  return value.trim().length >= minimum
}

export function validateLessonPlan(content: LessonPlanContent): LessonPlanValidationResult {
  const pendingSuggestions = content.aiSuggestionReview?.pendingSections ?? []
  const primaryCompetency = getPrimaryLessonCompetency(content)
  const verifiedAlignmentsAreValid = content.curriculumAlignments.length > 0
    && content.curriculumAlignments.every((alignment) =>
      alignment.verificationStatus === 'verified'
      && Boolean(alignment.id.trim())
      && hasText(alignment.text, 12),
    )
  const curriculumAlignmentIsValid = content.alignmentMode === 'curriculum_aligned'
    && verifiedAlignmentsAreValid
    && Boolean(primaryCompetency)
    && content.competency.id === primaryCompetency?.id
    && content.competency.text === primaryCompetency?.text
  const topicOnlyPurposeIsValid = content.alignmentMode === 'topic_only'
    && content.curriculumAlignments.length === 0
    && content.primaryCompetencyId === null
    && content.alignmentPurpose !== 'regular'
    && (content.alignmentPurpose !== 'other' || hasText(content.alignmentNote, 4))
  const items = [
    {
      key: 'lesson-focus',
      label: 'Lesson topic or focus is clear',
      passed: hasText(content.lessonFocus, 3),
      detail: 'State what learners will study, practice, review, or apply in this lesson.',
    },
    {
      key: 'competency',
      label: 'Curriculum alignment or teaching purpose is explicit',
      passed: curriculumAlignmentIsValid || topicOnlyPurposeIsValid,
      detail: content.alignmentMode === 'topic_only'
        ? 'Choose a non-regular purpose for an unaligned lesson. An “other” purpose also needs a short note.'
        : 'Attach verified competencies, choose a valid primary competency, and keep its source snapshot intact.',
    },
    {
      key: 'objectives',
      label: 'Learning objectives are clear and teacher-approved',
      passed: hasText(content.intentions.learningObjectives, 20),
      detail: 'AI may offer starting points, but the teacher approves the final objectives.',
    },
    {
      key: 'experience',
      label: 'Learning experience is teachable and coherent',
      passed: hasText(content.learningExperience.preLessonActivity, 12) && hasText(content.learningExperience.lessonFlow, 40),
      detail: 'The selected flow should be practical for the actual class and available time.',
    },
    {
      key: 'resources',
      label: 'Resources are verified by the teacher',
      passed: content.resourcesVerifiedByTeacher && hasText(content.learningExperience.resources, 3),
      detail: 'GuroDesk does not invent books, pages, devices, or materials. Confirm only resources you actually use, or select no additional resources.',
    },
    {
      key: 'context',
      label: 'Learner context or contextualization is considered',
      passed: hasText(content.learnerContext, 12) || hasText(content.learningExperience.integrationContextualization, 12),
      detail: 'Use class-level context only and avoid learner-identifying or sensitive data.',
    },
    {
      key: 'assessment',
      label: 'Formative assessment is integrated',
      passed: hasText(content.assessingLearning.formativeAssessments, 20) && hasText(content.assessingLearning.evidenceOfLearning, 12),
      detail: 'The teacher should confirm that the selected checks produce useful evidence of learning.',
    },
    {
      key: 'ways-forward',
      label: 'Ways forward are actionable',
      passed: hasText(content.waysForward.nextSteps, 15),
      detail: 'Confirm likely remediation, reteaching, enrichment, or next instructional steps.',
    },
    {
      key: 'suggestion-review',
      label: 'Quick Draft suggestions have been reviewed',
      passed: pendingSuggestions.length === 0,
      detail: pendingSuggestions.length ? `${pendingSuggestions.length} Quick Draft section${pendingSuggestions.length === 1 ? '' : 's'} still need teacher review.` : 'No unreviewed Quick Draft text remains.',
    },
    {
      key: 'ai-review',
      label: 'AI-assisted content has teacher review',
      passed: !content.aiDeclaration.used || content.aiDeclaration.reviewedByTeacher,
      detail: 'AI suggestions and revisions must be reviewed, adapted where needed, and approved by the teacher before finalization.',
    },
  ]

  const score = Math.round((items.filter((item) => item.passed).length / items.length) * 100)
  return { ready: items.every((item) => item.passed), score, items }
}
