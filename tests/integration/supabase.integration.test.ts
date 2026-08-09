import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase as applicationSupabase } from '../../src/lib/supabase'
import {
  archiveAssessmentDocument,
  createAssessmentFromFinalTos,
  duplicateAssessmentDocument,
  loadAssessmentDocument,
  loadAssessmentDocuments,
  saveAssessmentDocument,
} from '../../src/lib/assessmentRepository'
import {
  createResultSession,
  loadResultSession,
  loadResultSessions,
  saveClassLearner,
  saveResultSession,
} from '../../src/lib/resultsRepository'
import { loadRemediationPlans, saveRemediationPlan } from '../../src/lib/remediationRepository'
import { analyzeResultSession } from '../../src/lib/itemAnalysis'
import { buildRemediationPlanTargets, buildRemediationSignals } from '../../src/lib/remediation'
import { calculateResultTotals } from '../../src/lib/resultsScoring'
import type { AssessmentRecord } from '../../src/types/assessment'
import type { TosRecord } from '../../src/types/tos'
import type { AssessmentResultSession, ResultItemOutcome } from '../../src/types/results'
import {
  assertSafeTestTarget,
  createLocalTestHarness,
  localSupabaseConfig,
  resolveCanonicalFixture,
  type CanonicalCurriculumFixture,
  type TestHarness,
} from './supabaseTestHarness'
import {
  makeFinalAssessment,
  makeLockedDraft,
  makeTosFixture,
  scoreLearner,
} from './fixtures'

const localConfig = localSupabaseConfig()
if (!localConfig) {
  throw new Error('Phase 5.5 integration tests require an isolated local Supabase URL, anon key, and service-role key. Refusing to report a skipped integration gate as green.')
}

/** Set the application repository's real client to one of the test JWTs. */
async function useApplicationTeacher(teacher: TestHarness['teachers'][number]) {
  if (!applicationSupabase) throw new Error('The application Supabase client is not configured.')
  const { error } = await applicationSupabase.auth.setSession({
    access_token: teacher.accessToken,
    refresh_token: teacher.refreshToken,
  })
  if (error) throw error
}

async function expectRejected(action: () => Promise<unknown>, pattern: RegExp) {
  let error: unknown
  try {
    await action()
  } catch (caught) {
    error = caught
  }
  expect(error, 'expected the guarded operation to reject').toBeTruthy()
  expect(String((error as { message?: unknown })?.message ?? error)).toMatch(pattern)
}

function makeTosRecord(
  row: { id: unknown },
  assignmentId: string,
  teacherId: string,
  content: Record<string, unknown>,
): TosRecord {
  return {
    id: String(row.id),
    userId: teacherId,
    assignmentId,
    title: String(content.title),
    schoolYear: String(content.schoolYear),
    academicPeriodLabel: String(content.gradingTermLabel),
    status: 'final',
    content: content as TosRecord['content'],
    versionNumber: 1,
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  }
}

describe('Phase 5.5 local Supabase integration', () => {
  let harness: TestHarness
  let curriculum: CanonicalCurriculumFixture
  let sourceTos: TosRecord
  let draftAssessment: AssessmentRecord
  let lockedDraft: AssessmentRecord
  let finalAssessment: AssessmentRecord
  let resultSession: AssessmentResultSession

  beforeAll(async () => {
    // Keep this assertion close to the network setup so a future refactor
    // cannot accidentally turn a missing env variable into a production call.
    assertSafeTestTarget(localConfig?.url ?? '')
    if (!applicationSupabase) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.')
    harness = await createLocalTestHarness()
    curriculum = await resolveCanonicalFixture(harness.service)

    const teacher = harness.teachers[0]
    const assignment = harness.assignments[0]
    await useApplicationTeacher(teacher)
    const tosFixture = makeTosFixture(curriculum)
    const tosRow = await (async () => {
      const { data, error } = await teacher.client.rpc('save_tos_document', {
        p_document_id: null,
        p_assignment_id: assignment.id,
        p_title: String(tosFixture.content.title),
        p_school_year: assignment.schoolYear,
        p_academic_period_label: String(tosFixture.content.gradingTermLabel),
        p_status: 'final',
        p_structured_content: tosFixture.content,
        p_rows: tosFixture.rows,
        p_change_note: 'Phase 5.5 integration fixture',
      })
      if (error || !data) throw new Error(`create finalized fixture TOS: ${error?.message ?? 'no row returned'}`)
      return Array.isArray(data) ? data[0] as { id: unknown } : data as { id: unknown }
    })()
    sourceTos = makeTosRecord(tosRow, assignment.id, teacher.id, tosFixture.content)
    draftAssessment = await createAssessmentFromFinalTos(sourceTos, teacher.id, false)
    expect(draftAssessment.status).toBe('draft')
    expect(draftAssessment.items).toHaveLength(3)
  })

  afterAll(async () => {
    await harness?.cleanup()
    await applicationSupabase?.auth.signOut()
  })

  it('uses two real auth JWT sessions and enforces owner isolation', async () => {
    const teacherA = harness.teachers[0]
    const teacherB = harness.teachers[1]
    await useApplicationTeacher(teacherA)
    const own = await loadAssessmentDocument(draftAssessment.id, teacherA.id, false)
    expect(own?.id).toBe(draftAssessment.id)

    await useApplicationTeacher(teacherB)
    expect(await loadAssessmentDocuments(teacherB.id, false)).toEqual([])
    expect(await loadAssessmentDocument(draftAssessment.id, teacherB.id, false)).toBeNull()

    // The second client really authenticated with a distinct user, rather than
    // merely passing a different userId into an unauthed repository call.
    const { data: session } = await teacherB.client.auth.getSession()
    expect(session.session?.user.id).toBe(teacherB.id)
    expect(teacherB.id).not.toBe(teacherA.id)
    await useApplicationTeacher(teacherA)
  })

  it('performs new and existing assessment saves through the transactional RPC', async () => {
    const teacher = harness.teachers[0]
    await useApplicationTeacher(teacher)
    const savedExisting = await saveAssessmentDocument({
      ...draftAssessment,
      title: 'Phase 5.5 existing draft save',
      instructions: 'Saved through the existing-document path.',
      items: draftAssessment.items.map((item, index) => index === 0 ? {
        ...item,
        prompt: 'Edited through the existing-document save path.',
        points: 2,
        pointsPossible: 2,
      } : item),
    }, false)
    expect(savedExisting.id).toBe(draftAssessment.id)
    expect(savedExisting.title).toBe('Phase 5.5 existing draft save')
    expect(savedExisting.items[0]).toMatchObject({
      prompt: 'Edited through the existing-document save path.',
      points: 2,
      pointsPossible: 2,
    })
    expect(savedExisting.versionNumber).toBeGreaterThanOrEqual(draftAssessment.versionNumber)
    draftAssessment = savedExisting

    // The beforeAll call above exercised p_document_id = null.  This explicit
    // assertion keeps the new-document path visible in the behavior contract.
    const { data: assessmentRow, error } = await teacher.client
      .from('assessment_documents')
      .select('document_id,source_tos_document_id,source_tos_version_number,total_items')
      .eq('document_id', draftAssessment.id)
      .single()
    expect(error).toBeNull()
    expect(assessmentRow?.source_tos_document_id).toBe(sourceTos.id)
    expect(assessmentRow?.source_tos_version_number).toBe(1)
    expect(assessmentRow?.total_items).toBe(3)

    const duplicate = await duplicateAssessmentDocument(savedExisting, false)
    expect(duplicate.id).not.toBe(savedExisting.id)
    expect(duplicate.items.map((item) => item.mapping)).toEqual(savedExisting.items.map((item) => item.mapping))
    await archiveAssessmentDocument(duplicate.id, teacher.id, false)
    expect((await loadAssessmentDocuments(teacher.id, false)).some((item) => item.id === duplicate.id)).toBe(false)
  })

  it('creates, saves, lists, and reloads a deterministic 40-item assessment', async () => {
    const teacher = harness.teachers[0]
    const assignment = harness.assignments[0]
    await useApplicationTeacher(teacher)
    const fixture = makeTosFixture(curriculum, 'Phase 5.5 40-item TOS', 40)
    const { data, error } = await teacher.client.rpc('save_tos_document', {
      p_document_id: null,
      p_assignment_id: assignment.id,
      p_title: String(fixture.content.title),
      p_school_year: assignment.schoolYear,
      p_academic_period_label: String(fixture.content.gradingTermLabel),
      p_status: 'final',
      p_structured_content: fixture.content,
      p_rows: fixture.rows,
      p_change_note: 'Phase 5.5 40-item integration fixture',
    })
    if (error || !data) throw new Error(`create 40-item TOS: ${error?.message ?? 'no row returned'}`)
    const row = (Array.isArray(data) ? data[0] : data) as { id: unknown }
    const tos = makeTosRecord(row, assignment.id, teacher.id, fixture.content)

    const created = await createAssessmentFromFinalTos(tos, teacher.id, false, 'Phase 5.5 40-item assessment')
    expect(created.items).toHaveLength(40)
    expect(created.items.map((item) => item.itemNumber)).toEqual(Array.from({ length: 40 }, (_, index) => index + 1))
    expect(new Set(created.items.map((item) => item.id)).size).toBe(40)
    const saved = await saveAssessmentDocument({ ...created, instructions: 'Forty-item round-trip fixture.' }, false)
    expect(saved.id).toBe(created.id)
    expect(saved.items.map((item) => item.id)).toEqual(created.items.map((item) => item.id))
    expect((await loadAssessmentDocument(saved.id, teacher.id, false))?.items).toHaveLength(40)
    expect((await loadAssessmentDocuments(teacher.id, false)).some((item) => item.id === saved.id)).toBe(true)
  })

  it('uses the intended PostgREST relationship without PGRST201 ambiguity', async () => {
    const teacher = harness.teachers[0]
    await useApplicationTeacher(teacher)
    if (!applicationSupabase) throw new Error('Application client missing.')

    // documents.id relates to assessment_documents through both the document
    // and source-TOS columns. The application must select the document FK
    // explicitly so both list and individual repository reads remain valid.
    const explicit = await applicationSupabase
      .from('documents')
      .select('*, assessment_documents:assessment_documents!assessment_documents_document_id_fkey(*, assessment_items(*))')
      .eq('id', draftAssessment.id)
      .maybeSingle()
    expect(explicit.error).toBeNull()
    expect(explicit.error?.code).not.toBe('PGRST201')
    const relation = explicit.data?.assessment_documents as Record<string, unknown> | Record<string, unknown>[] | null
    expect(relation).toBeTruthy()
    const metadata = Array.isArray(relation) ? relation[0] : relation
    expect(metadata?.source_tos_document_id).toBe(sourceTos.id)
    expect(Array.isArray(metadata?.assessment_items)).toBe(true)

    const loaded = await loadAssessmentDocument(draftAssessment.id, teacher.id, false)
    const listed = await loadAssessmentDocuments(teacher.id, false)
    expect(loaded?.id).toBe(draftAssessment.id)
    expect(listed.some((assessment) => assessment.id === draftAssessment.id)).toBe(true)
  })

  it('rejects assignment/source changes and protects a locked draft item', async () => {
    const teacher = harness.teachers[0]
    await useApplicationTeacher(teacher)
    const otherAssignment = harness.assignments[1]
    await expectRejected(
      () => saveAssessmentDocument({ ...draftAssessment, assignmentId: otherAssignment.id }, false),
      /assignment and source cannot change|teacher-owned assignment/i,
    )
    await expectRejected(
      () => saveAssessmentDocument({
        ...draftAssessment,
        sourceTos: { ...draftAssessment.sourceTos, id: crypto.randomUUID() },
      }, false),
      /assignment and source cannot change/i,
    )
    await expectRejected(
      () => saveAssessmentDocument({
        ...draftAssessment,
        items: draftAssessment.items.map((item, index) => index === 0 ? {
          ...item,
          mapping: { ...item.mapping, cognitiveCategoryId: 'tampered-category' },
        } : item),
      }, false),
      /mappings do not match|mapping/i,
    )
    await expectRejected(
      () => saveAssessmentDocument({
        ...draftAssessment,
        items: draftAssessment.items.map((item, index) => index === 0 ? {
          ...item,
          mapping: { ...item.mapping, competencyId: crypto.randomUUID() },
        } : item),
      }, false),
      /mappings do not match|mapping/i,
    )
    await expectRejected(
      () => saveAssessmentDocument({
        ...draftAssessment,
        items: draftAssessment.items.map((item, index) => ({ ...item, itemNumber: index + 2 })),
      }, false),
      /contiguous|numbering/i,
    )
    await expectRejected(
      () => saveAssessmentDocument({
        ...draftAssessment,
        items: draftAssessment.items.map((item, index) => ({ ...item, itemNumber: index === 1 ? 1 : item.itemNumber })),
      }, false),
      /duplicate|contiguous|numbering/i,
    )
    await expectRejected(
      () => saveAssessmentDocument({
        ...draftAssessment,
        items: draftAssessment.items.map((item, index) => index === 0 ? { ...item, pointsPossible: -1, points: -1 } : item),
      }, false),
      /finite nonnegative|points/i,
    )

    await useApplicationTeacher(harness.teachers[1])
    await expectRejected(
      () => createAssessmentFromFinalTos(sourceTos, harness.teachers[1].id, false),
      /finalized TOS|not found|teacher-owned/i,
    )
    await useApplicationTeacher(teacher)

    lockedDraft = makeLockedDraft(draftAssessment)
    const savedLocked = await saveAssessmentDocument(lockedDraft, false)
    expect(savedLocked.items[0].locked).toBe(true)
    lockedDraft = savedLocked
    await expectRejected(
      () => saveAssessmentDocument({
        ...lockedDraft,
        items: lockedDraft.items.map((item, index) => index === 0 ? { ...item, prompt: 'Attempted locked edit.' } : item),
      }, false),
      /locked assessment item cannot be changed/i,
    )

    const unlocked = await saveAssessmentDocument({
      ...lockedDraft,
      items: lockedDraft.items.map((item, index) => index === 0 ? {
        ...item,
        locked: false,
        qaState: 'needs_review',
        prompt: 'Explicitly unlocked and safely edited.',
      } : item),
    }, false)
    expect(unlocked.items[0]).toMatchObject({ locked: false, prompt: 'Explicitly unlocked and safely edited.' })
    lockedDraft = unlocked
  })

  it('rejects edits after finalization and preserves the finalized source/item snapshot', async () => {
    const teacher = harness.teachers[0]
    await useApplicationTeacher(teacher)
    const freshDraft = await createAssessmentFromFinalTos(sourceTos, teacher.id, false, 'Phase 5.5 final assessment')
    finalAssessment = makeFinalAssessment(freshDraft)
    finalAssessment = await saveAssessmentDocument(finalAssessment, false)
    expect(finalAssessment.status).toBe('final')
    expect(finalAssessment.items.map((item) => item.questionType)).toEqual(['multiple_choice', 'problem_solving', 'essay'])

    await expectRejected(
      () => saveAssessmentDocument({ ...finalAssessment, title: 'Attempted finalized edit.' }, false),
      /only draft assessment documents can be edited/i,
    )
    const reloaded = await loadAssessmentDocument(finalAssessment.id, teacher.id, false)
    expect(reloaded?.status).toBe('final')
    expect(reloaded?.title).toBe(finalAssessment.title)
    expect(reloaded?.sourceTos.id).toBe(sourceTos.id)
    expect(reloaded?.items.map((item) => item.id)).toEqual(finalAssessment.items.map((item) => item.id))
    expect(reloaded?.items.map((item) => item.answer.type)).toEqual(['multiple_choice', 'problem_solving', 'essay'])
    expect(reloaded?.totalPoints).toBe(16)
    expect(reloaded?.settings?.allowedTypes).toEqual(expect.arrayContaining(['multiple_choice', 'problem_solving', 'essay']))
  })

  it('round-trips results, partial-credit totals, aggregation, and remediation persistence', async () => {
    const teacher = harness.teachers[0]
    await useApplicationTeacher(teacher)
    const assignment = harness.assignments[0]
    const learnerA = await saveClassLearner({ assignmentId: assignment.id, sectionName: assignment.sectionName, displayName: 'Learner A', localReference: 'P55-A', status: 'active' }, teacher.id, false)
    const learnerB = await saveClassLearner({ assignmentId: assignment.id, sectionName: assignment.sectionName, displayName: 'Learner B', localReference: 'P55-B', status: 'active' }, teacher.id, false)
    expect(learnerA.id).not.toBe(learnerB.id)

    resultSession = await createResultSession({
      assessmentId: finalAssessment.id,
      assignmentId: assignment.id,
      sectionName: assignment.sectionName,
      administrationDate: '2026-08-09',
      title: 'Phase 5.5 results round trip',
      entryMode: 'answer_sheet',
      learnerIds: [learnerA.id, learnerB.id],
    }, teacher.id, false)
    expect(resultSession.assessmentSnapshot.assessmentId).toBe(finalAssessment.id)
    expect(resultSession.learners).toHaveLength(2)

    const participantA = resultSession.learners.find((learner) => learner.learnerId === learnerA.id)
    const participantB = resultSession.learners.find((learner) => learner.learnerId === learnerB.id)
    expect(participantA).toBeTruthy()
    expect(participantB).toBeTruthy()
    const outcomesA = scoreLearner(resultSession, false, participantA!)
    const outcomesB = scoreLearner(resultSession, true, participantB!)
    const totalsA = calculateResultTotals(outcomesA, 16)
    expect(outcomesA.map((outcome) => [outcome.earnedPoints, outcome.possiblePoints])).toEqual([[1, 1], [3, 5], [8, 10]])
    expect(totalsA).toMatchObject({ rawScore: 12, possiblePoints: 16, percentage: 75, correctItems: 1, teacherScoredItems: 2 })
    expect(totalsA.rawScore).not.toBe(totalsA.correctItems)
    expect(calculateResultTotals(outcomesB, 16).rawScore).toBe(16)

    await useApplicationTeacher(harness.teachers[1])
    await expectRejected(
      () => saveResultSession({ session: resultSession, outcomes: [...outcomesA, ...outcomesB], scoreOnlyOutcomes: [] }, harness.teachers[1].id, false, 'draft'),
      /not found|owner|result session/i,
    )
    await useApplicationTeacher(teacher)

    const excessive: ResultItemOutcome[] = [...outcomesA, ...outcomesB].map((outcome, index) => index === 0
      ? { ...outcome, earnedPoints: outcome.possiblePoints + 1 }
      : outcome)
    await expectRejected(
      () => saveResultSession({ session: resultSession, outcomes: excessive, scoreOnlyOutcomes: [] }, teacher.id, false, 'draft'),
      /earned points|possible points|exceed/i,
    )

    const saved = await saveResultSession({
      session: resultSession,
      outcomes: [...outcomesA, ...outcomesB],
      scoreOnlyOutcomes: [],
    }, teacher.id, false, 'final')
    expect(saved.status).toBe('final')
    await expectRejected(
      () => saveResultSession({ session: saved, outcomes: [...outcomesA, ...outcomesB], scoreOnlyOutcomes: [] }, teacher.id, false, 'draft'),
      /only draft result sessions can be saved/i,
    )
    const loaded = await loadResultSession(saved.id, teacher.id, false)
    expect(loaded?.itemOutcomes).toHaveLength(6)
    expect(loaded?.assessmentSnapshot.totalPossiblePoints).toBe(16)
    const summaries = await loadResultSessions(teacher.id, false, { assignmentId: assignment.id, sectionName: assignment.sectionName })
    const summary = summaries.find((candidate) => candidate.id === saved.id)
    expect(summary).toMatchObject({ learnerCount: 2, encodedLearnerCount: 2, responseCount: 6 })

    const analysis = analyzeResultSession(loaded!)
    expect(analysis.available).toBe(true)
    expect(analysis.competencies).toHaveLength(1)
    expect(analysis.competencies[0]).toMatchObject({ mappedItems: 3, earnedPoints: 28, pointsPossibleForAll: 32, normalizedPointAchievement: 0.875 })
    expect(analysis.cognitiveCategories).toHaveLength(1)
    expect(analysis.cognitiveCategories[0]).toMatchObject({ mappedItems: 3, earnedPoints: 28, pointsPossibleForAll: 32, normalizedPointAchievement: 0.875 })
    const signals = buildRemediationSignals(analysis, {
      threshold: { percentageThreshold: 0.9, basis: 'point_facility', comparison: 'below' },
    })
    expect(signals.classSignals).toHaveLength(1)
    expect(signals.classSignals[0].evidenceValue).toBe(0.875)
    const targets = buildRemediationPlanTargets(signals)
    expect(targets[0].itemNumbers).toEqual([1, 2, 3])

    const plan = await saveRemediationPlan({
      resultSessionId: saved.id,
      scope: 'whole_class',
      selectedParticipantIds: [],
      targets,
      teacherSelectedTarget: targets[0].competencyText,
      plannedActivity: 'Reteach the mapped competency using worked examples.',
      scheduledFor: '2026-08-12',
      followUpEvidence: 'Short exit ticket.',
      notes: 'Review after the next lesson.',
      teacherReviewed: false,
      optionalAssistantSuggestion: null,
    }, teacher.id, false, { threshold: 0.9, thresholdBasis: 'point_facility', thresholdComparison: 'below' })
    expect(plan.reviewState).toBe('draft')
    expect(plan.threshold).toBe(0.9)
    const persisted = await loadRemediationPlans(teacher.id, saved.id, false)
    expect(persisted).toHaveLength(1)
    expect(persisted[0].targets[0].itemNumbers).toEqual([1, 2, 3])
    expect(persisted[0].targets[0].evidenceValue).toBe(0.875)

    const reviewed = await saveRemediationPlan({ ...plan, teacherReviewed: true }, teacher.id, false)
    expect(reviewed.reviewState).toBe('teacher_reviewed')
    const reviewedRows = await loadRemediationPlans(teacher.id, saved.id, false)
    expect(reviewedRows[0].teacherReviewed).toBe(true)

    await useApplicationTeacher(harness.teachers[1])
    expect(await loadResultSession(saved.id, harness.teachers[1].id, false)).toBeNull()
    expect(await loadRemediationPlans(harness.teachers[1].id, saved.id, false)).toEqual([])
    await useApplicationTeacher(teacher)
  })

  it('enforces cross-teacher read and write isolation across every owner domain', async () => {
    const teacherA = harness.teachers[0]
    const teacherB = harness.teachers[1]
    const assignmentA = harness.assignments[0]
    await useApplicationTeacher(teacherA)

    const { data: lesson, error: lessonError } = await teacherA.client.from('documents').insert({
      user_id: teacherA.id,
      assignment_id: assignmentA.id,
      document_type: 'lesson_plan',
      title: 'Phase 5.5 RLS lesson',
      school_year: assignmentA.schoolYear,
      academic_period_label: 'Term 1',
      status: 'draft',
      structured_content: { title: 'Phase 5.5 RLS lesson' },
    }).select('id').single()
    if (lessonError || !lesson) throw new Error(`create RLS lesson fixture: ${lessonError?.message ?? 'no row returned'}`)
    const { data: lessonVersion, error: versionError } = await teacherA.client.from('document_versions').insert({
      document_id: lesson.id,
      version_number: 1,
      structured_content: { title: 'Phase 5.5 RLS lesson' },
      change_note: 'RLS fixture',
    }).select('id').single()
    if (versionError || !lessonVersion) throw new Error(`create RLS lesson history: ${versionError?.message ?? 'no row returned'}`)
    const { data: template, error: templateError } = await teacherA.client.from('document_templates').insert({
      user_id: teacherA.id,
      name: 'Phase 5.5 RLS template',
      document_type: 'lesson_plan',
      file_type: 'docx',
      original_filename: 'phase55-rls.docx',
      storage_path: `${teacherA.id}/phase55-rls.docx`,
      file_size_bytes: 16,
      source_hash: '',
      structure_json: [],
      mapping_json: [],
      is_default: false,
    }).select('id').single()
    if (templateError || !template) throw new Error(`create RLS template fixture: ${templateError?.message ?? 'no row returned'}`)

    const teacherAPlan = (await teacherA.client.from('remediation_plans').select('id').eq('result_session_id', resultSession.id).single()).data
    const teacherALearner = (await teacherA.client.from('class_learners').select('id').eq('assignment_id', assignmentA.id).limit(1).single()).data
    const teacherAOutcome = (await teacherA.client.from('result_item_outcomes').select('id').eq('result_session_id', resultSession.id).limit(1).single()).data
    const teacherAItem = (await teacherA.client.from('assessment_items').select('id').eq('assessment_document_id', finalAssessment.id).limit(1).single()).data
    if (!teacherAPlan || !teacherALearner || !teacherAOutcome || !teacherAItem) throw new Error('RLS fixtures were not persisted before isolation probes.')

    await useApplicationTeacher(teacherB)
    const targets = [
      { table: 'teacher_assignments', column: 'id', value: assignmentA.id, update: { is_active: false } },
      { table: 'documents', column: 'id', value: lesson.id, update: { title: 'Teacher B tamper' } },
      { table: 'documents', column: 'id', value: sourceTos.id, update: { title: 'Teacher B tamper' } },
      { table: 'documents', column: 'id', value: finalAssessment.id, update: { title: 'Teacher B tamper' } },
      { table: 'assessment_items', column: 'id', value: teacherAItem.id, update: { prompt: 'Teacher B tamper' } },
      { table: 'document_versions', column: 'id', value: lessonVersion.id, update: { change_note: 'Teacher B tamper' } },
      { table: 'class_learners', column: 'id', value: teacherALearner.id, update: { display_name: 'Teacher B tamper' } },
      { table: 'result_sessions', column: 'id', value: resultSession.id, update: { title: 'Teacher B tamper' } },
      { table: 'result_item_outcomes', column: 'id', value: teacherAOutcome.id, update: { teacher_feedback: 'Teacher B tamper' } },
      { table: 'remediation_plans', column: 'id', value: teacherAPlan.id, update: { notes: 'Teacher B tamper' } },
      { table: 'document_templates', column: 'id', value: template.id, update: { name: 'Teacher B tamper' } },
    ] as const

    for (const target of targets) {
      const before = await harness.service.from(target.table).select('*').eq(target.column, target.value).single()
      expect(before.error, `service setup read for ${target.table}`).toBeNull()
      const hidden = await teacherB.client.from(target.table).select(target.column).eq(target.column, target.value)
      expect(hidden.error, `Teacher B read of ${target.table}`).toBeNull()
      expect(hidden.data, `Teacher B must not read Teacher A ${target.table}`).toEqual([])
      const write = await teacherB.client.from(target.table).update(target.update).eq(target.column, target.value).select(target.column)
      if (!write.error) expect(write.data, `Teacher B must not update Teacher A ${target.table}`).toEqual([])
      const after = await harness.service.from(target.table).select('*').eq(target.column, target.value).single()
      expect(after.error, `service verification read for ${target.table}`).toBeNull()
      expect(after.data, `Teacher B write must not change Teacher A ${target.table}`).toEqual(before.data)
    }

    const hiddenTosRows = await teacherB.client.from('tos_competencies').select('row_id').eq('document_id', sourceTos.id)
    expect(hiddenTosRows.error).toBeNull()
    expect(hiddenTosRows.data).toEqual([])
    const hiddenParticipants = await teacherB.client.from('result_session_learners').select('id').eq('result_session_id', resultSession.id)
    expect(hiddenParticipants.error).toBeNull()
    expect(hiddenParticipants.data).toEqual([])
    const hiddenTargets = await teacherB.client.from('remediation_plan_targets').select('id').eq('remediation_plan_id', teacherAPlan.id)
    expect(hiddenTargets.error).toBeNull()
    expect(hiddenTargets.data).toEqual([])

    await useApplicationTeacher(teacherA)
    for (const target of targets) {
      const own = await teacherA.client.from(target.table).select(target.column).eq(target.column, target.value)
      expect(own.error, `Teacher A own read of ${target.table}`).toBeNull()
      expect(own.data, `Teacher A must read own ${target.table}`).toHaveLength(1)
    }
  })

  it('enforces zero-trust for unauthenticated (anon) requests and protects private tables', async () => {
    const anonClient = createClient(harness.config.url, harness.config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const privateTables = [
      'teacher_assignments',
      'documents',
      'profiles',
      'teacher_ai_credentials',
      'class_learners',
      'result_sessions',
      'remediation_plans',
    ] as const

    for (const table of privateTables) {
      const response = await anonClient.from(table).select('*')
      if (response.error) {
        expect(response.error.message).toBeTruthy()
      } else {
        expect(response.data).toEqual([])
      }
    }
  })
})
