import { describe, expect, it } from 'vitest'
import { buildLessonTemplateValues } from '../../src/lib/docxTemplate'
import { emptyLessonCompetencySnapshot, syncLessonCompetencyProjection } from '../../src/lib/lessonPlanAlignment'
import { buildLessonPlanExportModel } from '../../src/lib/lessonPlanExport'
import { createBlankLessonPlan, normalizeLessonContent } from '../../src/lib/lessonPlanFactory'
import type { Profile, TeacherAssignment } from '../../src/types/app'
import { createDefaultTeacherExportPreferences, type TeacherExportPreferences } from '../../src/types/export'
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

    expect(grounding).toContain('### Supporting Learning Competencies')
    expect(grounding).toContain('• M7-one: Classifies polygons')
    expect(grounding).toContain('### Primary Learning Competency')
    expect(grounding).toContain('M7-two: Distinguishes regular and irregular polygons.')
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

    expect(grounding).toContain('### Primary Learning Competency')
    expect(grounding).toContain('M7-primary: Classifies polygons according to the number of sides.')
    expect(grounding).toContain('### Supporting Learning Competencies')
    expect(grounding).toContain('• M7-additional: Distinguishes regular and irregular polygons.')
  })

  it('builds a grounded Daily Lesson Log model with four session columns', () => {
    const plan = exportPlan()
    plan.content.lessonPlanFormat = 'daily_lesson_log'
    plan.content.intentions.learningObjectives = 'Session 1: Identify regular polygons.\nSession 2: Calculate sum of interior angles.\nSession 3: Solve complex polygon problems.\nSession 4: Present geometric real-world applications.'
    plan.content.learningExperience.preLessonActivity = 'Day 1: Shape identification.\nDay 2: Angle review.\nDay 3: Error analysis.\nDay 4: Self-check readiness.'
    plan.content.learningExperience.lessonFlow = '1. Concept modeling.\n2. Guided station work.\n3. Independent problem solving.\n4. Synthesis presentation.'
    plan.content.assessingLearning.formativeAssessments = 'Session 1: 5-item identification check.\nSession 2: Angle calculation board work.\nSession 3: 5-item formative quiz with answer key.\nSession 4: Performance rubric rating.'

    const multiPreferences: TeacherExportPreferences = {
      ...preferences,
      defaultTemplateId: 'gurodesk_ilaw_multisession',
    }

    const model = buildLessonPlanExportModel(plan, profile, multiPreferences)
    expect(model.templateLabel).toBe('Daily Lesson Log')
    expect(model.multiSession).toBeDefined()

    const multi = model.multiSession!
    expect(multi.sessionHeaders).toHaveLength(4)
    expect(multi.rows.length).toBeGreaterThanOrEqual(14)

    const objectivesRow = multi.rows.find((r) => r.key === 'objectives')
    expect(objectivesRow).toBeDefined()
    expect(objectivesRow?.sessions[0]).toContain('Identify regular polygons')
    expect(objectivesRow?.sessions[1]).toContain('Calculate sum of interior angles')

    const preLessonRow = multi.rows.find((r) => r.key === 'pre_lesson')
    expect(preLessonRow).toBeDefined()
    expect(preLessonRow?.sessions[0]).toContain('Shape identification')
    expect(preLessonRow?.sessions[1]).toContain('Angle review')

    const formativeRow = multi.rows.find((r) => r.key === 'formative_assessment')
    expect(formativeRow).toBeDefined()
    expect(formativeRow?.sessions[2]).toContain('5-item formative quiz')

    expect(multi.rubricItems).toHaveLength(9)
    expect(multi.rubricItems.some((item) => item.status === 'not_yet')).toBe(true)
    expect(multi.aiDeclarationStatement).toBe('No AI assistance was used in the preparation of this lesson plan.')
    expect(multi.coachingNotes).toBe('')
    expect(multi.referencesDetail.officialReferences).toEqual([])
    expect(multi.referencesDetail.lowTechAlternatives).toEqual([])
  })

  it('does not duplicate unstructured text across Daily Lesson Log sessions', () => {
    const plan = exportPlan()
    plan.content.lessonPlanFormat = 'daily_lesson_log'
    plan.content.intentions.learningObjectives = 'Learners classify polygons using observable attributes.'

    const model = buildLessonPlanExportModel(plan, profile, preferences)
    const objectives = model.multiSession?.rows.find((row) => row.key === 'objectives')

    expect(objectives?.sessions).toEqual(['Learners classify polygons using observable attributes.', '', '', ''])
    expect(model.lesson.sessions).toBe('1')
    expect(model.multiSession?.lesson.sessions).toBe('4')
  })

  it('correctly splits and dedupes multiline performance standards without loose orphan lines', () => {
    const plan = exportPlan()
    plan.content.curriculumAlignments = [
      snapshot('c1', 'Competency 1', {
        performanceStandards: [
          'convert units of measure from different systems of measure. (MG)',
          'find the volume of square and rectangular pyramids, and the volume of cylinders. (MG)',
        ],
      }),
    ]
    plan.content.performanceStandard =
      'convert units of measure from different systems of measure. (MG)\nfind the volume of square and rectangular pyramids, and the volume of cylinders. (MG)'

    const model = buildLessonPlanExportModel(plan, profile, preferences)
    const standardsBlock = model.ilaw.intentions.find((item) => item.key === 'competency-standards')?.body ?? ''

    expect(standardsBlock).toContain('### Performance Standards')
    // Should have exactly 2 bullets, not 3 or 4
    const bulletMatches = standardsBlock.match(/• convert units of measure/g)
    expect(bulletMatches).toHaveLength(1)
    const bulletMatches2 = standardsBlock.match(/• find the volume of square/g)
    expect(bulletMatches2).toHaveLength(1)
    // No line starting without bullet after Performance Standards heading
    const perfSection = standardsBlock.split('### Performance Standards')[1]
    const lines = perfSection.trim().split('\n').filter(Boolean)
    expect(lines).toEqual([
      '• convert units of measure from different systems of measure. (MG)',
      '• find the volume of square and rectangular pyramids, and the volume of cylinders. (MG)',
    ])
  })
})
