import { describe, expect, it } from 'vitest'
import { buildLessonTemplateValues } from '../../src/lib/docxTemplate'
import { emptyLessonCompetencySnapshot, syncLessonCompetencyProjection } from '../../src/lib/lessonPlanAlignment'
import { buildLessonPlanExportModel } from '../../src/lib/lessonPlanExport'
import { createBlankLessonPlan, normalizeLessonContent } from '../../src/lib/lessonPlanFactory'
import type { Profile, TeacherAssignment } from '../../src/types/app'
import { createDefaultTeacherExportPreferences } from '../../src/types/export'
import type { LegacyLessonPlanContentV1, LessonPlanCompetencySnapshot, LessonPlanRecord } from '../../src/types/lessonPlan'

const assignment: TeacherAssignment = {
  id: 'assignment-export',
  userId: 'teacher-export',
  schoolYear: '2026-2027',
  gradeLevel: 'Grade 7',
  learningArea: 'Mathematics',
  sections: ['Rizal'],
  isActive: true,
  curriculumSourceKind: 'official',
  curriculumVersionId: null,
}

const profile: Profile = {
  id: assignment.userId,
  email: 'teacher@example.test',
  fullName: 'Teacher Example',
  schoolName: 'Example Integrated School',
  region: 'Region VII',
  division: 'Example Division',
  positionTitle: 'Teacher III',
  schoolYear: assignment.schoolYear,
  onboardingCompleted: true,
}

const preferences = createDefaultTeacherExportPreferences(assignment.userId)

function snapshot(id: string, text: string, overrides: Partial<LessonPlanCompetencySnapshot> = {}) {
  return emptyLessonCompetencySnapshot({
    id,
    code: `M7-${id}`,
    text,
    sourcePage: 30,
    sourceTitle: 'Verified curriculum guide',
    academicPeriodId: 'q1',
    curriculumPeriodLabel: 'Quarter 1',
    domainId: 'geometry',
    contentArea: 'Measurement and Geometry',
    contentStandards: ['The learner demonstrates understanding of polygons.'],
    performanceStandards: ['The learner applies polygon concepts accurately.'],
    ...overrides,
  })
}

function exportPlan(): LessonPlanRecord {
  const plan = createBlankLessonPlan(assignment.userId, assignment)
  plan.id = 'lesson-export'
  plan.title = 'Polygon lesson'
  plan.content.lessonTitle = 'Polygon lesson'
  plan.content.lessonFocus = 'Regular and irregular polygons'
  plan.content.teachingApproaches = ['Guided practice', 'Collaborative learning']
  return plan
}

describe('lesson-plan export compatibility', () => {
  it('exports a normalized legacy single-competency lesson without losing its snapshot', () => {
    const plan = exportPlan()
    const legacy = {
      ...plan.content,
      schemaVersion: 1,
      competency: {
        id: 'legacy-competency',
        code: 'M7GE-Ia-1',
        text: 'Classifies polygons according to the number of sides.',
        sourcePage: 17,
        sourceTitle: 'Historical verified curriculum guide',
      },
    } as unknown as LegacyLessonPlanContentV1
    const currentOnly = legacy as unknown as Record<string, unknown>
    for (const key of ['lessonFocus', 'lessonFocusSource', 'lessonFocusSourceId', 'curriculumAlignments', 'primaryCompetencyId', 'alignmentMode', 'alignmentPurpose', 'alignmentNote']) delete currentOnly[key]
    plan.content = normalizeLessonContent(legacy, 'final')

    const model = buildLessonPlanExportModel(plan, profile, preferences)

    expect(model.ilaw.intentions.find((item) => item.key === 'lesson-focus')?.body).toBe('Polygon lesson')
    expect(model.ilaw.intentions.find((item) => item.key === 'competency-standards')?.body)
      .toContain('M7GE-Ia-1: Classifies polygons according to the number of sides.')
  })

  it('exports a teacher topic with no curriculum alignment as explicitly unaligned', () => {
    const plan = exportPlan()
    plan.content.lessonTitle = ''
    plan.content.alignmentMode = 'topic_only'
    plan.content.alignmentPurpose = 'remediation'
    plan.content.alignmentNote = 'Revisit a prerequisite before the next unit.'

    const model = buildLessonPlanExportModel(plan, profile, preferences)
    const grounding = model.ilaw.intentions.find((item) => item.key === 'competency-standards')?.body ?? ''

    expect(model.ilaw.intentions.find((item) => item.key === 'lesson-focus')?.body).toBe('Regular and irregular polygons')
    expect(model.lesson.title).toBe('Regular and irregular polygons')
    expect(grounding).toContain('No verified curriculum competency attached')
    expect(grounding).toContain('remediation')
    expect(grounding).toContain('Alignment note: Revisit a prerequisite before the next unit.')
  })

  it('exports every selected competency, identifies the primary, and maps focus for custom DOCX templates', () => {
    const first = snapshot('one', 'Classifies polygons according to the number of sides.')
    const primary = snapshot('two', 'Distinguishes regular and irregular polygons.', {
      performanceStandards: ['The learner creates a practical design using polygons.'],
    })
    const plan = exportPlan()
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [first, primary],
      primaryCompetencyId: primary.id,
    })

    const model = buildLessonPlanExportModel(plan, profile, preferences)
    const grounding = model.ilaw.intentions.find((item) => item.key === 'competency-standards')?.body ?? ''
    const templateValues = buildLessonTemplateValues(model)

    expect(grounding).toContain('Additional competency 1: M7-one: Classifies polygons')
    expect(grounding).toContain('Primary competency: M7-two: Distinguishes regular and irregular polygons.')
    expect(templateValues.lessonFocus).toBe('Regular and irregular polygons')
    expect(templateValues.teachingApproaches).toBe('Guided practice\nCollaborative learning')
    expect(templateValues.competency).toContain('Distinguishes regular and irregular polygons.')
    expect(templateValues.performanceStandard).toContain('The learner creates a practical design using polygons.')
  })

  it('numbers additional competencies consecutively when the primary is first', () => {
    const primary = snapshot('primary', 'Classifies polygons according to the number of sides.')
    const additional = snapshot('additional', 'Distinguishes regular and irregular polygons.')
    const plan = exportPlan()
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [primary, additional],
      primaryCompetencyId: primary.id,
    })

    const grounding = buildLessonPlanExportModel(plan, profile, preferences)
      .ilaw.intentions.find((item) => item.key === 'competency-standards')?.body ?? ''

    expect(grounding).toContain('Primary competency: M7-primary')
    expect(grounding).toContain('Additional competency 1: M7-additional')
    expect(grounding).not.toContain('Additional competency 2')
  })
})
