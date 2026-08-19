import { describe, expect, it } from 'vitest'
import { emptyLessonCompetencySnapshot } from '../../src/lib/lessonPlanAlignment'
import { buildLessonPlanExportModel, buildLessonPlanMultiSessionExportModel } from '../../src/lib/lessonPlanExport'
import { createBlankLessonPlan } from '../../src/lib/lessonPlanFactory'
import type { Profile, TeacherAssignment } from '../../src/types/app'
import { createDefaultTeacherExportPreferences } from '../../src/types/export'
import type { LessonPlanRecord } from '../../src/types/lessonPlan'

const assignment: TeacherAssignment = {
  id: 'assignment-1',
  userId: 'teacher-1',
  schoolYear: '2026–2027',
  gradeLevel: 'Grade 9',
  learningArea: 'Science',
  sections: ['Diamond'],
  isActive: true,
  curriculumSourceKind: 'official',
  curriculumVersionId: null,
}

const profile: Profile = {
  id: 'teacher-1',
  email: 'maria.santos@deped.gov.ph',
  fullName: 'Maria Santos',
  schoolName: 'Mabini National High School',
  region: 'Region IV-A CALABARZON',
  division: 'Division of Batangas',
  district: 'Batangas City East District',
  positionTitle: 'Teacher I',
  schoolYear: '2026–2027',
  onboardingCompleted: true,
}

const preferences = createDefaultTeacherExportPreferences(profile.id)

function createSamplePlan(overrides?: Partial<LessonPlanRecord['content']>): LessonPlanRecord {
  const plan = createBlankLessonPlan(assignment.userId, assignment)
  plan.id = 'plan-123'
  plan.title = 'Photosynthesis and Cellular Respiration'
  plan.content.lessonTitle = 'Photosynthesis and Cellular Respiration'
  plan.content.lessonFocus = 'Photosynthesis and Cellular Respiration'
  plan.content.lessonDate = '2026-08-20'
  plan.content.weekLabel = 'Week 4 — August 17–21, 2026'
  plan.content.schoolYear = '2026–2027'
  plan.content.curriculumPeriodLabel = 'Quarter 1'
  plan.content.gradingTermLabel = 'First Quarter'
  plan.content.durationMinutes = 60
  plan.content.competency = emptyLessonCompetencySnapshot({
    id: 'comp-1',
    code: 'S9LT-lgb-27',
    text: 'Differentiate basic features of photosynthesis and respiration.',
    sourceTitle: 'Science 9 Curriculum Guide',
    contentStandards: ['The learners demonstrate understanding of the structure and function of plant parts.'],
    performanceStandards: ['The learners should be able to design and conduct a simple investigation.'],
  })
  plan.content.curriculumAlignments = [plan.content.competency]
  plan.content.primaryCompetencyId = 'comp-1'
  plan.content.intentions.learningObjectives = 'Identify the raw materials and products of photosynthesis and cellular respiration.'
  plan.content.learningExperience.lessonFlow = '1. Introduction: Review leaf structure. 2. Direct Instruction: Diagram light reaction.'

  if (overrides) {
    Object.assign(plan.content, overrides)
  }
  return plan
}

describe('Lesson Plan Metadata Workflow & Exports', () => {
  it('correctly includes lessonDate and weekLabel in single-session export model', () => {
    const plan = createSamplePlan({
      lessonDate: '2026-08-20',
      weekLabel: 'Week 4 — August 17–21, 2026',
    })

    const model = buildLessonPlanExportModel(plan, profile, preferences)

    expect(model.lesson.lessonDate).toBe('August 20, 2026')
    expect(model.lesson.weekLabel).toBe('Week 4 — August 17–21, 2026')
    expect(model.lesson.schoolYear).toBe('2026–2027')
    expect(model.identity.schoolName).toBe('Mabini National High School')
    expect(model.identity.district).toBe('Batangas City East District')
  })

  it('correctly includes lessonDate and weekLabel in multi-session export model', () => {
    const plan = createSamplePlan({
      lessonDate: '2026-08-20',
      weekLabel: 'Week 4 — August 17–21, 2026',
    })

    const multiModel = buildLessonPlanMultiSessionExportModel(plan, profile, preferences)

    expect(multiModel.lesson.lessonDate).toBe('August 20, 2026')
    expect(multiModel.lesson.weekLabel).toBe('Week 4 — August 17–21, 2026')
    expect(multiModel.documentTitle).toContain('DAILY LESSON LOG')
  })

  it('handles historical records with empty lessonDate or weekLabel without crashing', () => {
    const historicalPlan = createSamplePlan({
      lessonDate: '',
      weekLabel: '',
    })

    const model = buildLessonPlanExportModel(historicalPlan, profile, preferences)
    expect(model.lesson.lessonDate).toBe('Not specified')
    expect(model.lesson.weekLabel).toBe('Not specified')

    const multiModel = buildLessonPlanMultiSessionExportModel(historicalPlan, profile, preferences)
    expect(multiModel.lesson.lessonDate).toBe('Not specified')
    expect(multiModel.lesson.weekLabel).toBe('Not specified')
  })
})
