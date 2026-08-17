import type { TeacherAssignment } from '../types/app'
import type {
  LegacyLessonPlanContentV1,
  LessonPlanContent,
  LessonPlanRecord,
  LessonPlanStatus,
} from '../types/lessonPlan'
import {
  emptyLessonCompetencySnapshot,
  isLessonCompetencySnapshotEmpty,
  normalizeLegacyLessonCompetencySnapshot,
  normalizeLessonCompetencySnapshot,
  syncLessonCompetencyProjection,
} from './lessonPlanAlignment'

export { emptyLessonCompetencySnapshot } from './lessonPlanAlignment'

export function createBlankLessonContent(assignment: TeacherAssignment): LessonPlanContent {
  return {
    schemaVersion: 2,
    framework: 'ILAW',
    policyCode: 'DO 016, s. 2026',
    lessonPlanFormat: 'ilaw',
    lessonTitle: '',
    lessonFocus: '',
    lessonFocusSource: 'teacher',
    lessonFocusSourceId: null,
    lessonLanguage: 'Auto',
    teachingApproaches: [],
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
    curriculumAlignments: [],
    primaryCompetencyId: null,
    alignmentMode: 'curriculum_aligned',
    alignmentPurpose: 'regular',
    alignmentNote: '',
    competency: emptyLessonCompetencySnapshot(),
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

export function normalizeLessonContent(
  content: LessonPlanContent | LegacyLessonPlanContentV1,
  status: LessonPlanStatus = 'draft',
): LessonPlanContent {
  const source = structuredClone(content)
  const legacy = source.schemaVersion === 1
  const sourceCompetency = legacy
    ? normalizeLegacyLessonCompetencySnapshot(source.competency)
    : normalizeLessonCompetencySnapshot(source.competency)
  const legacyAlignments = isLessonCompetencySnapshotEmpty(sourceCompetency) ? [] : [sourceCompetency]
  const current = legacy ? null : source
  const curriculumAlignments = current?.curriculumAlignments ?? legacyAlignments
  const primaryCompetencyId = current?.primaryCompetencyId ?? (
    curriculumAlignments.find((alignment) => alignment.id.trim())?.id ?? null
  )

  const normalized: LessonPlanContent = {
    ...source,
    schemaVersion: 2,
    lessonPlanFormat: current?.lessonPlanFormat === 'daily_lesson_log'
      ? 'daily_lesson_log'
      : current?.lessonPlanFormat === 'ilaw'
        ? 'ilaw'
        : undefined,
    lessonFocus: current?.lessonFocus ?? source.lessonTitle,
    lessonFocusSource: current?.lessonFocusSource ?? 'teacher',
    lessonFocusSourceId: current?.lessonFocusSourceId ?? null,
    lessonLanguage: current?.lessonLanguage ?? 'Auto',
    teachingApproaches: [...(current?.teachingApproaches ?? [])],
    curriculumAlignments,
    primaryCompetencyId,
    alignmentMode: current?.alignmentMode ?? (curriculumAlignments.length ? 'curriculum_aligned' : 'topic_only'),
    alignmentPurpose: current?.alignmentPurpose ?? 'regular',
    alignmentNote: current?.alignmentNote ?? '',
    competency: sourceCompetency,
    sections: [...source.sections],
    resourcesVerifiedByTeacher: source.resourcesVerifiedByTeacher ?? status === 'final',
    intentions: { ...source.intentions },
    learningExperience: { ...source.learningExperience },
    assessingLearning: { ...source.assessingLearning },
    waysForward: { ...source.waysForward },
    aiSuggestionReview: source.aiSuggestionReview
      ? {
          pendingSections: [...source.aiSuggestionReview.pendingSections],
          lastQuickDraftAt: source.aiSuggestionReview.lastQuickDraftAt,
        }
      : { pendingSections: [], lastQuickDraftAt: null },
    aiDeclaration: {
      ...source.aiDeclaration,
      categories: [...(source.aiDeclaration?.categories ?? [])],
      operations: [...(source.aiDeclaration?.operations ?? [])],
      reviewedByTeacher: source.aiDeclaration?.reviewedByTeacher ?? false,
      used: source.aiDeclaration?.used ?? false,
      statement: source.aiDeclaration?.statement ?? 'No AI assistance was used in the preparation of this lesson plan.',
    },
  }

  return syncLessonCompetencyProjection(normalized)
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
