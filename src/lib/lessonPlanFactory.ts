import type { TeacherAssignment } from '../types/app'
import type { LessonPlanContent, LessonPlanRecord, LessonPlanStatus } from '../types/lessonPlan'

export function createBlankLessonContent(assignment: TeacherAssignment): LessonPlanContent {
  return {
    schemaVersion: 1,
    framework: 'ILAW',
    policyCode: 'DO 016, s. 2026',
    lessonTitle: '',
    gradeLevel: assignment.gradeLevel,
    learningArea: assignment.learningArea,
    sections: [...assignment.sections],
    schoolYear: assignment.schoolYear,
    curriculumPeriodLabel: '',
    gradingTermLabel: '',
    lessonDate: '',
    weekLabel: '',
    numberOfSessions: 1,
    durationMinutes: 60,
    references: '',
    resourcesVerifiedByTeacher: false,
    competency: { id: '', code: null, text: '', sourcePage: null, sourceTitle: null },
    performanceStandard: '',
    learnerContext: '',
    intentions: { learningObjectives: '' },
    learningExperience: {
      resources: '',
      homeBasedAlternative: '',
      preLessonActivity: '',
      lessonFlow: '',
      integrationContextualization: '',
      inclusionAccommodations: '',
    },
    assessingLearning: { formativeAssessments: '', evidenceOfLearning: '' },
    waysForward: { reflection: '', nextSteps: '', extendedLearning: '' },
    aiDeclaration: { used: false, categories: [], operations: [], statement: 'No AI assistance was used in the preparation of this lesson plan.', reviewedByTeacher: false },
    aiSuggestionReview: { pendingSections: [], lastQuickDraftAt: null },
  }
}

export function normalizeLessonContent(content: LessonPlanContent, status: LessonPlanStatus = 'draft'): LessonPlanContent {
  return {
    ...content,
    resourcesVerifiedByTeacher: content.resourcesVerifiedByTeacher ?? status === 'final',
    aiSuggestionReview: content.aiSuggestionReview ?? { pendingSections: [], lastQuickDraftAt: null },
    aiDeclaration: {
      ...content.aiDeclaration,
      categories: content.aiDeclaration?.categories ?? [],
      operations: content.aiDeclaration?.operations ?? [],
      reviewedByTeacher: content.aiDeclaration?.reviewedByTeacher ?? false,
      used: content.aiDeclaration?.used ?? false,
      statement: content.aiDeclaration?.statement ?? 'No AI assistance was used in the preparation of this lesson plan.',
    },
  }
}

export function createBlankLessonPlan(userId: string, assignment: TeacherAssignment): LessonPlanRecord {
  return {
    id: '',
    userId,
    assignmentId: assignment.id,
    title: '',
    schoolYear: assignment.schoolYear,
    academicPeriodLabel: null,
    status: 'draft',
    content: createBlankLessonContent(assignment),
    createdAt: '',
    updatedAt: '',
  }
}
