import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: supabaseMocks.from,
    functions: { invoke: supabaseMocks.invoke },
  },
}))

import {
  emptyLessonCompetencySnapshot,
  syncLessonCompetencyProjection,
} from '../../src/lib/lessonPlanAlignment'
import { createBlankLessonPlan } from '../../src/lib/lessonPlanFactory'
import {
  duplicateLessonPlan,
  loadLessonPlan,
  loadLessonPlans,
  runLessonAiSupport,
  saveLessonPlan,
} from '../../src/lib/repository'
import type { TeacherAssignment } from '../../src/types/app'
import type { LessonPlanRecord } from '../../src/types/lessonPlan'

const LESSON_PLANS_KEY = 'gurodesk.demo.lessonPlans.v1'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

const assignment: TeacherAssignment = {
  id: 'assignment-lesson-persistence',
  userId: 'teacher-persistence',
  schoolYear: '2026-2027',
  gradeLevel: 'Grade 7',
  learningArea: 'Mathematics',
  sections: ['Rizal'],
  isActive: true,
  curriculumSourceKind: 'official',
  curriculumVersionId: null,
}

function legacyLessonPlan(): LessonPlanRecord {
  const plan = createBlankLessonPlan(assignment.userId, assignment)
  const legacyContent = structuredClone(plan.content) as unknown as Record<string, unknown>
  legacyContent.schemaVersion = 1
  legacyContent.lessonTitle = 'Percentage increase and decrease'
  legacyContent.competency = {
    id: 'legacy-competency-1',
    code: 'M7NS-Ia-1',
    text: 'Solves problems involving percentage increase and decrease.',
    sourcePage: 42,
    sourceTitle: 'Verified curriculum source',
  }
  for (const key of [
    'lessonFocus',
    'lessonFocusSource',
    'lessonFocusSourceId',
    'curriculumAlignments',
    'primaryCompetencyId',
    'alignmentMode',
    'alignmentPurpose',
    'alignmentNote',
  ]) delete legacyContent[key]

  return {
    ...plan,
    id: 'legacy-plan-1',
    title: 'Legacy percentage lesson',
    content: legacyContent as unknown as LessonPlanRecord['content'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

function configureProductionLessonSave(
  plan: LessonPlanRecord,
  competencyResults: Array<{ data: Array<{ id: string }> | null; error: Error | null }>,
  existingCompetencyIds: string[] = [],
  linkInsertError: Error | null = null,
) {
  const events: string[] = []
  const linkInsert = vi.fn(async () => {
    events.push('insert')
    return { error: linkInsertError }
  })
  const linkDeleteChain = {
    eq: vi.fn(),
    in: vi.fn(async () => ({ error: null })),
  }
  linkDeleteChain.eq.mockReturnValue(linkDeleteChain)
  const linkDelete = vi.fn(() => {
    events.push('delete')
    return linkDeleteChain
  })
  const linkSelectEq = vi.fn(async () => ({
    data: existingCompetencyIds.map((competencyId) => ({ competency_id: competencyId })),
    error: null,
  }))
  const linkSelect = vi.fn(() => {
    events.push('select')
    return { eq: linkSelectEq }
  })
  let persistedContent = plan.content

  const documentChain = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(async () => ({
      data: {
        id: plan.id,
        user_id: plan.userId,
        assignment_id: plan.assignmentId,
        title: plan.title,
        school_year: plan.schoolYear,
        academic_period_label: plan.academicPeriodLabel,
        status: plan.status,
        structured_content: persistedContent,
        created_at: plan.createdAt,
        updated_at: plan.updatedAt,
      },
      error: null,
    })),
  }
  documentChain.eq.mockReturnValue(documentChain)
  documentChain.select.mockReturnValue(documentChain)
  const documents = {
    update: vi.fn((value: { structured_content: LessonPlanRecord['content'] }) => {
      persistedContent = value.structured_content
      return documentChain
    }),
  }

  let competencyResultIndex = 0
  const curriculumQuery = () => {
    const result = competencyResults[competencyResultIndex++] ?? { data: [], error: null }
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(async () => {
        events.push(`resolve:${result.data?.[0]?.id ?? 'none'}`)
        return result
      }),
    }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    return chain
  }

  const versionChain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => ({ data: [{ version_number: 2 }], error: null })),
    insert: vi.fn(async () => ({ error: null })),
  }
  versionChain.select.mockReturnValue(versionChain)
  versionChain.eq.mockReturnValue(versionChain)
  versionChain.order.mockReturnValue(versionChain)

  supabaseMocks.from.mockImplementation((table: string) => {
    if (table === 'documents') return documents
    if (table === 'curriculum_competencies') return curriculumQuery()
    if (table === 'lesson_plan_competencies') return { select: linkSelect, delete: linkDelete, insert: linkInsert }
    if (table === 'document_versions') return versionChain
    throw new Error(`Unexpected production test table: ${table}`)
  })

  return { documents, events, linkDelete, linkDeleteChain, linkInsert, linkSelect }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  supabaseMocks.from.mockReset()
  supabaseMocks.invoke.mockReset()
})

describe('lesson-plan persistence compatibility', () => {
  it('normalizes a legacy single-competency record in memory without rewriting storage', async () => {
    const legacy = legacyLessonPlan()
    localStorage.setItem(LESSON_PLANS_KEY, JSON.stringify([legacy]))
    const rawBefore = localStorage.getItem(LESSON_PLANS_KEY)

    const listed = await loadLessonPlans(assignment.userId, true)
    const opened = await loadLessonPlan(legacy.id, assignment.userId, true)

    expect(listed).toHaveLength(1)
    expect(opened?.content.schemaVersion).toBe(2)
    expect(opened?.content.lessonFocus).toBe('Percentage increase and decrease')
    expect(opened?.content.curriculumAlignments).toHaveLength(1)
    expect(opened?.content.curriculumAlignments[0]).toMatchObject(legacy.content.competency)
    expect(opened?.content.primaryCompetencyId).toBe('legacy-competency-1')
    expect(opened?.content.competency).toMatchObject(legacy.content.competency)
    expect(localStorage.getItem(LESSON_PLANS_KEY)).toBe(rawBefore)
  })

  it('saves and reloads a topic-only lesson without inventing an alignment', async () => {
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.title = 'Custom review lesson'
    plan.content.lessonTitle = 'Custom review lesson'
    plan.content.lessonFocus = 'Review of prerequisite fraction skills'
    plan.content.alignmentMode = 'topic_only'
    plan.content.alignmentPurpose = 'review'

    const saved = await saveLessonPlan(plan, true)
    const reloaded = await loadLessonPlan(saved.id, assignment.userId, true)

    expect(saved.content).toEqual(plan.content)
    expect(reloaded?.content.lessonFocus).toBe('Review of prerequisite fraction skills')
    expect(reloaded?.content.curriculumAlignments).toEqual([])
    expect(reloaded?.content.primaryCompetencyId).toBeNull()
    expect(reloaded?.content.alignmentMode).toBe('topic_only')
  })

  it('persists an explicitly saved legacy lesson as synchronized v2 content', async () => {
    const legacy = legacyLessonPlan()

    const saved = await saveLessonPlan(legacy, true)
    const stored = JSON.parse(localStorage.getItem(LESSON_PLANS_KEY) ?? '[]') as LessonPlanRecord[]

    expect(saved.content.schemaVersion).toBe(2)
    expect(saved.content.curriculumAlignments).toHaveLength(1)
    expect(saved.content.primaryCompetencyId).toBe('legacy-competency-1')
    expect(saved.content.competency).toEqual(saved.content.curriculumAlignments[0])
    expect(stored[0].content).toEqual(saved.content)
  })

  it('round-trips multiple alignments and duplicates them under a fresh draft identity', async () => {
    const first = emptyLessonCompetencySnapshot({
      id: 'competency-a',
      code: 'M7GE-Ia-1',
      text: 'Classifies polygons according to the number of sides.',
      sourcePage: 30,
      sourceTitle: 'Verified curriculum source',
      contentArea: 'Geometry',
    })
    const primary = emptyLessonCompetencySnapshot({
      id: 'competency-b',
      code: 'M7GE-Ia-2',
      text: 'Distinguishes regular and irregular polygons.',
      sourcePage: 31,
      sourceTitle: 'Verified curriculum source',
      contentArea: 'Geometry',
    })
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.title = 'Polygon lesson'
    plan.content.lessonTitle = 'Polygon lesson'
    plan.content.lessonFocus = 'Regular and irregular polygons'
    plan.content.lessonFocusSource = 'curriculum_derived'
    plan.content.lessonFocusSourceId = 'geometry-domain'
    plan.content.lessonLanguage = 'English + Filipino'
    plan.content.teachingApproaches = ['Guided practice', 'Collaborative learning']
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [first, primary],
      primaryCompetencyId: primary.id,
    })

    const saved = await saveLessonPlan(plan, true)
    const reloaded = await loadLessonPlan(saved.id, assignment.userId, true)
    const duplicate = await duplicateLessonPlan(saved, true)

    expect(reloaded?.content).toEqual(saved.content)
    expect(reloaded?.content.curriculumAlignments).toEqual([first, primary])
    expect(reloaded?.content.primaryCompetencyId).toBe(primary.id)
    expect(reloaded?.content.competency).toEqual(primary)
    expect(reloaded?.content.lessonFocusSource).toBe('curriculum_derived')
    expect(reloaded?.content.lessonFocusSourceId).toBe('geometry-domain')
    expect(reloaded?.content.lessonLanguage).toBe('English + Filipino')
    expect(reloaded?.content.teachingApproaches).toEqual(['Guided practice', 'Collaborative learning'])
    expect(duplicate.id).not.toBe(saved.id)
    expect(duplicate.status).toBe('draft')
    expect(duplicate.title).toBe('Polygon lesson (Copy)')
    expect(duplicate.content.lessonTitle).toBe('Polygon lesson (Copy)')
    expect(duplicate.content.lessonFocus).toBe(saved.content.lessonFocus)
    expect(duplicate.content.lessonFocusSource).toBe(saved.content.lessonFocusSource)
    expect(duplicate.content.lessonFocusSourceId).toBe(saved.content.lessonFocusSourceId)
    expect(duplicate.content.lessonLanguage).toBe(saved.content.lessonLanguage)
    expect(duplicate.content.teachingApproaches).toEqual(saved.content.teachingApproaches)
    expect(duplicate.content.curriculumAlignments).toEqual(saved.content.curriculumAlignments)
    expect(duplicate.content.primaryCompetencyId).toBe(saved.content.primaryCompetencyId)
  })

  it('does not rewrite other legacy records when a different lesson is saved', async () => {
    const legacy = legacyLessonPlan()
    localStorage.setItem(LESSON_PLANS_KEY, JSON.stringify([legacy]))
    const newPlan = createBlankLessonPlan(assignment.userId, assignment)
    newPlan.title = 'New topic-only plan'
    newPlan.content.lessonFocus = 'Teacher-created enrichment topic'
    newPlan.content.alignmentMode = 'topic_only'

    await saveLessonPlan(newPlan, true)

    const stored = JSON.parse(localStorage.getItem(LESSON_PLANS_KEY) ?? '[]') as Array<{ content: { schemaVersion: number } }>
    expect(stored).toHaveLength(2)
    expect(stored[0].content.schemaVersion).toBe(1)
    expect(stored[1].content.schemaVersion).toBe(2)
  })
})

describe('production lesson competency link mirror', () => {
  it('resolves every verified alignment before replacing links in one bulk insert', async () => {
    const firstId = '11111111-1111-4111-8111-111111111111'
    const primaryId = '22222222-2222-4222-8222-222222222222'
    const first = emptyLessonCompetencySnapshot({
      id: firstId,
      code: 'M7GE-Ia-1',
      text: 'Classifies polygons according to their number of sides.',
      sourcePage: 30,
      sourceTitle: 'Verified curriculum source',
    })
    const primary = emptyLessonCompetencySnapshot({
      id: primaryId,
      code: 'M7GE-Ia-2',
      text: 'Distinguishes regular and irregular polygons.',
      sourcePage: 31,
      sourceTitle: 'Verified curriculum source',
    })
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.id = '33333333-3333-4333-8333-333333333333'
    plan.title = 'Production polygon lesson'
    plan.createdAt = '2026-08-13T00:00:00.000Z'
    plan.updatedAt = plan.createdAt
    plan.content.lessonFocus = 'Regular and irregular polygons'
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [first, primary],
      primaryCompetencyId: primary.id,
    })
    const harness = configureProductionLessonSave(plan, [
      { data: [{ id: firstId }], error: null },
      { data: [{ id: primaryId }], error: null },
    ])

    await saveLessonPlan(plan, false)

    expect(harness.events).toEqual([`resolve:${firstId}`, `resolve:${primaryId}`, 'select', 'insert'])
    expect(harness.linkDelete).not.toHaveBeenCalled()
    expect(harness.linkSelect).toHaveBeenCalledTimes(1)
    expect(harness.linkInsert).toHaveBeenCalledTimes(1)
    expect(harness.linkInsert).toHaveBeenCalledWith([
      {
        document_id: plan.id,
        competency_id: firstId,
        competency_text_snapshot: first.text,
        competency_code_snapshot: first.code,
        source_page_snapshot: first.sourcePage,
      },
      {
        document_id: plan.id,
        competency_id: primaryId,
        competency_text_snapshot: primary.text,
        competency_code_snapshot: primary.code,
        source_page_snapshot: primary.sourcePage,
      },
    ])
  })

  it('deletes stale links for a topic-only save without inserting replacements', async () => {
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.id = '44444444-4444-4444-8444-444444444444'
    plan.title = 'Topic-only review'
    plan.createdAt = '2026-08-13T00:00:00.000Z'
    plan.updatedAt = plan.createdAt
    plan.content.lessonFocus = 'Teacher-created review topic'
    plan.content.alignmentMode = 'topic_only'
    plan.content.alignmentPurpose = 'review'
    const staleId = '77777777-7777-4777-8777-777777777777'
    const harness = configureProductionLessonSave(plan, [], [staleId])

    await saveLessonPlan(plan, false)

    expect(harness.events).toEqual(['select', 'delete'])
    expect(harness.linkDelete).toHaveBeenCalledTimes(1)
    expect(harness.linkDeleteChain.eq).toHaveBeenCalledWith('document_id', plan.id)
    expect(harness.linkDeleteChain.in).toHaveBeenCalledWith('competency_id', [staleId])
    expect(harness.linkInsert).not.toHaveBeenCalled()
  })

  it('does not delete existing links when verified-ID resolution errors', async () => {
    const competency = emptyLessonCompetencySnapshot({
      id: '55555555-5555-4555-8555-555555555555',
      text: 'Solves problems involving percentage increase and decrease.',
    })
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.id = '66666666-6666-4666-8666-666666666666'
    plan.createdAt = '2026-08-13T00:00:00.000Z'
    plan.updatedAt = plan.createdAt
    plan.content.lessonFocus = 'Percentage increase and decrease'
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [competency],
      primaryCompetencyId: competency.id,
    })
    const resolutionError = new Error('curriculum lookup failed')
    const harness = configureProductionLessonSave(plan, [{ data: null, error: resolutionError }])

    await expect(saveLessonPlan(plan, false)).rejects.toThrow('curriculum lookup failed')

    expect(harness.linkDelete).not.toHaveBeenCalled()
    expect(harness.linkInsert).not.toHaveBeenCalled()
    expect(harness.linkSelect).not.toHaveBeenCalled()
  })

  it('keeps existing links when a newly resolved assignment link is rejected', async () => {
    const competencyId = '88888888-8888-4888-8888-888888888888'
    const existingId = '99999999-9999-4999-8999-999999999999'
    const competency = emptyLessonCompetencySnapshot({
      id: competencyId,
      text: 'Classifies polygons according to their properties.',
    })
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    plan.createdAt = '2026-08-13T00:00:00.000Z'
    plan.updatedAt = plan.createdAt
    plan.content.lessonFocus = 'Classifying polygons'
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [competency],
      primaryCompetencyId: competency.id,
    })
    const insertError = new Error('assignment curriculum guard rejected link')
    const harness = configureProductionLessonSave(
      plan,
      [{ data: [{ id: competencyId }], error: null }],
      [existingId],
      insertError,
    )

    await expect(saveLessonPlan(plan, false)).rejects.toThrow(insertError.message)

    expect(harness.events).toEqual([`resolve:${competencyId}`, 'select', 'insert'])
    expect(harness.linkDelete).not.toHaveBeenCalled()
  })

  it('does not guess a foreign key when a local snapshot matches multiple curriculum versions', async () => {
    const competency = emptyLessonCompetencySnapshot({
      id: 'local-manifest-competency',
      code: 'M7GE-Ia-1',
      text: 'Classifies polygons according to their properties.',
      sourcePage: 21,
    })
    const plan = createBlankLessonPlan(assignment.userId, assignment)
    plan.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    plan.createdAt = '2026-08-13T00:00:00.000Z'
    plan.updatedAt = plan.createdAt
    plan.content.lessonFocus = 'Classifying polygons'
    plan.content = syncLessonCompetencyProjection({
      ...plan.content,
      curriculumAlignments: [competency],
      primaryCompetencyId: competency.id,
    })
    const harness = configureProductionLessonSave(plan, [{
      data: [
        { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
        { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
      ],
      error: null,
    }])

    const saved = await saveLessonPlan(plan, false)

    expect(saved.content.curriculumAlignments).toEqual([competency])
    expect(harness.events).toEqual(['resolve:cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'select'])
    expect(harness.linkInsert).not.toHaveBeenCalled()
    expect(harness.linkDelete).not.toHaveBeenCalled()
  })
})

describe('demo lesson AI grounding', () => {
  it('uses the teacher topic as focus and all supplied verified alignments as grounding', async () => {
    const response = await runLessonAiSupport({
      supportType: 'quick_draft',
      sectionKey: 'quick_draft',
      lessonContext: {
        gradeLevel: 'Grade 7',
        learningArea: 'Mathematics',
        lessonFocus: 'Regular and irregular polygons',
        primaryCompetency: {
          id: 'competency-a', code: 'M7GE-Ia-1', text: 'Classifies polygons.', sourcePage: 30, sourceTitle: 'Verified source',
        },
        additionalCompetencies: [{
          id: 'competency-b', code: 'M7GE-Ia-2', text: 'Distinguishes regular and irregular polygons.', sourcePage: 31, sourceTitle: 'Verified source',
        }],
        teacherIntent: '',
      },
    }, true)

    expect(response.draft?.lessonTitle).toBe('Regular and irregular polygons')
    expect(response.draft?.learningObjectives).toContain('Regular and irregular polygons')
    expect(response.draft?.learningObjectives).toContain('Classifies polygons.')
    expect(response.draft?.learningObjectives).toContain('Distinguishes regular and irregular polygons.')
  })

  it('supports a topic-only preview without representing the topic as verified curriculum', async () => {
    const response = await runLessonAiSupport({
      supportType: 'suggest_lesson_flow',
      sectionKey: 'lessonFlow',
      lessonContext: {
        gradeLevel: 'Grade 7',
        learningArea: 'Mathematics',
        lessonFocus: 'Locally developed numeracy review',
        primaryCompetency: null,
        additionalCompetencies: [],
        teacherIntent: '',
      },
    }, true)

    expect(response.suggestions?.[0]).toContain('teacher-provided topic')
    expect(response.suggestions?.[0]).not.toContain('verified curriculum')
  })
})
