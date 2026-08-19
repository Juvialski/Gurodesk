import { describe, expect, it } from 'vitest'
import { emptyLessonCompetencySnapshot } from '../../src/lib/lessonPlanAlignment'
import { buildLessonPlanExportModel } from '../../src/lib/lessonPlanExport'
import { createBlankLessonPlan } from '../../src/lib/lessonPlanFactory'
import type { Profile, TeacherAssignment } from '../../src/types/app'
import { createDefaultTeacherExportPreferences } from '../../src/types/export'

const assignment: TeacherAssignment = {
  id: 'assignment-m9',
  userId: 'teacher-m9',
  schoolYear: '2026–2027',
  gradeLevel: 'Grade 9',
  learningArea: 'Mathematics',
  sections: ['Newton'],
  isActive: true,
  curriculumSourceKind: 'official',
  curriculumVersionId: null,
}

const profile: Profile = {
  id: 'teacher-m9',
  email: 'teacher@deped.gov.ph',
  fullName: 'Juan Dela Cruz',
  schoolName: 'Rizal High School',
  region: 'NCR',
  division: 'Pasig City',
  district: 'Pasig City East',
  positionTitle: 'Teacher I',
  schoolYear: '2026–2027',
  onboardingCompleted: true,
}

const preferences = createDefaultTeacherExportPreferences(profile.id)

describe('Lesson Curriculum Presentation & Deduplication', () => {
  it('formats curriculum alignment with clear grouped hierarchy', () => {
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.id = 'lp-test-1'
    plan.title = 'Quadratic Equations and Functions'
    plan.content.lessonTitle = 'Quadratic Equations'
    plan.content.lessonFocus = 'Quadratic Equations'
    plan.content.lessonDate = '2026-08-25'
    plan.content.weekLabel = 'Week 1'

    const comp1 = emptyLessonCompetencySnapshot({
      id: 'm9-comp-1',
      code: 'M9AL-Ia-1',
      text: 'illustrates quadratic equations.',
      sourceTitle: 'Math 9 Guide',
      contentStandards: ['The learner demonstrates understanding of key concepts of quadratic equations.'],
      performanceStandards: ['The learner is able to investigate mathematical relationships.'],
    })

    const comp2 = emptyLessonCompetencySnapshot({
      id: 'm9-comp-2',
      code: 'M9AL-Ia-b-1',
      text: 'solves quadratic equations by: (a) extracting square roots; (b) factoring; (c) completing the square; and (d) using the quadratic formula.',
      sourceTitle: 'Math 9 Guide',
      contentStandards: ['The learner demonstrates understanding of key concepts of quadratic equations.'], // Duplicate
      performanceStandards: ['The learner is able to investigate mathematical relationships.'], // Duplicate
    })

    plan.content.competency = comp1
    plan.content.primaryCompetencyId = 'm9-comp-1'
    plan.content.curriculumAlignments = [comp1, comp2]

    const model = buildLessonPlanExportModel(plan, profile, preferences)
    const intentions = model.ilaw.intentions
    const compField = intentions.find((f) => f.key === 'competency-standards')

    expect(compField).toBeDefined()
    const body = compField!.body

    // 1. Primary Learning Competency
    expect(body).toContain('### Primary Learning Competency')
    expect(body).toContain('M9AL-Ia-1: illustrates quadratic equations.')

    // 2. Supporting Learning Competencies
    expect(body).toContain('### Supporting Learning Competencies')
    expect(body).toContain('• M9AL-Ia-b-1: solves quadratic equations by: (a) extracting square roots')

    // 3. Content Standards (deduplicated)
    expect(body).toContain('### Content Standards')
    expect(body).toContain('• The learner demonstrates understanding of key concepts of quadratic equations.')

    // 4. Performance Standards (deduplicated)
    expect(body).toContain('### Performance Standards')
    expect(body).toContain('• The learner is able to investigate mathematical relationships.')

    // Verify duplicate standard appears exactly once in the body
    const contentStdMatches = body.match(/The learner demonstrates understanding of key concepts of quadratic equations/g)
    expect(contentStdMatches).toHaveLength(1)

    const perfStdMatches = body.match(/The learner is able to investigate mathematical relationships/g)
    expect(perfStdMatches).toHaveLength(1)
  })

  it('formats Filipino headings when language is Filipino', () => {
    const filAssignment: TeacherAssignment = {
      id: 'assignment-fil7',
      userId: 'teacher-fil7',
      schoolYear: '2026–2027',
      gradeLevel: 'Grade 7',
      learningArea: 'Filipino',
      sections: ['Sampaguita'],
      isActive: true,
      curriculumSourceKind: 'official',
      curriculumVersionId: null,
    }

    const filProfile: Profile = {
      id: 'teacher-fil7',
      email: 'teacher.fil@deped.gov.ph',
      fullName: 'Maria Santos',
      schoolName: 'Rizal High School',
      region: 'NCR',
      division: 'Pasig City',
      district: 'Pasig City East',
      positionTitle: 'Teacher I',
      schoolYear: '2026–2027',
      onboardingCompleted: true,
    }

    const plan = createBlankLessonPlan(filAssignment.userId, filAssignment)
    plan.id = 'lp-filipino-1'
    plan.title = 'Pang-abay na Pamanahon at Panlunan'
    plan.content.lessonTitle = 'Pang-abay'
    plan.content.lessonFocus = 'Pang-abay'
    plan.content.learningArea = 'Filipino'
    plan.content.lessonDate = '2026-08-25'
    plan.content.weekLabel = 'Unang Linggo'

    const compFil = emptyLessonCompetencySnapshot({
      id: 'fil7-comp-1',
      code: 'F7WG-Ia-d-1',
      text: 'Nagagamit nang wasto ang mga pahayag sa pagbibigay ng mga patunay.',
      sourceTitle: 'Filipino 7 Gabay',
      contentStandards: ['Naipamamalas ng mag-aaral ang pag-unawa sa mga akdang pampanitikan ng Mindanao.'],
      performanceStandards: ['Naisasagawa ng mag-aaral ang isang makatotohanang proyektong panturismo.'],
    })

    plan.content.competency = compFil
    plan.content.primaryCompetencyId = 'fil7-comp-1'
    plan.content.curriculumAlignments = [compFil]

    const model = buildLessonPlanExportModel(plan, filProfile, preferences)
    const intentions = model.ilaw.intentions
    const compField = intentions.find((f) => f.key === 'competency-standards')

    expect(compField).toBeDefined()
    const body = compField!.body

    expect(body).toContain('### Pangunahing Kasanayang Pampagkatuto')
    expect(body).toContain('### Mga Pamantayang Pangnilalaman')
    expect(body).toContain('### Mga Pamantayan sa Pagganap')
  })
})
