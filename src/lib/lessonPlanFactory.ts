import type { TeacherAssignment } from '../types/app'
import type { LessonPlanContent, LessonPlanRecord } from '../types/lessonPlan'

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
