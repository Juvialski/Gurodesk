import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabase as applicationSupabase } from '../../src/lib/supabase'
import {
  createAssessmentFromFinalTos,
  loadAssessmentDocument,
  saveAssessmentDocument,
} from '../../src/lib/assessmentRepository'
import type { TosRecord } from '../../src/types/tos'
import {
  assertSafeTestTarget,
  createLocalTestHarness,
  localSupabaseConfig,
  resolveCanonicalFixture,
  type CanonicalCurriculumFixture,
  type TestHarness,
} from '../integration/supabaseTestHarness'
import { makeTosFixture } from '../integration/fixtures'

const localConfig = localSupabaseConfig()
if (!localConfig) {
  throw new Error('Standard assessment diagnostic requires the isolated local Supabase test environment.')
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
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
  }
}

function errorMessage(error: unknown) {
  return String((error as { message?: unknown })?.message ?? error)
}

describe.sequential('Stage 1.1 standard assessment round-trip diagnostic', () => {
  let harness: TestHarness
  let curriculum: CanonicalCurriculumFixture

  beforeAll(async () => {
    assertSafeTestTarget(localConfig?.url ?? '')
    if (!applicationSupabase) throw new Error('Application Supabase client is not configured.')
    harness = await createLocalTestHarness()
    curriculum = await resolveCanonicalFixture(harness.service)
  })

  afterAll(async () => {
    await applicationSupabase?.auth.signOut()
    await harness?.cleanup()
  })

  it('pinpoints the 40-item finalized-TOS failure stage without weakening the production contract', async () => {
    const teacher = harness.teachers[0]
    const assignment = harness.assignments[0]

    const { error: sessionError } = await applicationSupabase!.auth.setSession({
      access_token: teacher.accessToken,
      refresh_token: teacher.refreshToken,
    })
    expect(sessionError).toBeNull()

    const fixture = makeTosFixture(curriculum, 'Stage 1.1 diagnostic 40-item TOS', 40)
    const { data: tosData, error: tosError } = await teacher.client.rpc('save_tos_document', {
      p_document_id: null,
      p_assignment_id: assignment.id,
      p_title: String(fixture.content.title),
      p_school_year: assignment.schoolYear,
      p_academic_period_label: String(fixture.content.gradingTermLabel),
      p_status: 'final',
      p_structured_content: fixture.content,
      p_rows: fixture.rows,
      p_change_note: 'Stage 1.1 diagnostic fixture',
    })
    if (tosError || !tosData) {
      throw new Error(`[STAGE1.1:TOS_CREATE] ${tosError?.message ?? 'no row returned'}`)
    }

    const tosRow = (Array.isArray(tosData) ? tosData[0] : tosData) as { id: unknown }
    const tos = makeTosRecord(tosRow, assignment.id, teacher.id, fixture.content)

    const { data: sourceState, error: sourceError } = await teacher.client
      .from('documents')
      .select('id,user_id,assignment_id,document_type,status')
      .eq('id', tos.id)
      .single()
    if (sourceError) throw new Error(`[STAGE1.1:SOURCE_READ] ${sourceError.message}`)

    expect(sourceState).toMatchObject({
      id: tos.id,
      user_id: teacher.id,
      assignment_id: assignment.id,
      document_type: 'tos',
      status: 'final',
    })

    let created
    try {
      created = await createAssessmentFromFinalTos(
        tos,
        teacher.id,
        false,
        'Stage 1.1 diagnostic 40-item assessment',
      )
    } catch (error) {
      throw new Error(
        `[STAGE1.1:INITIAL_CREATE] ${errorMessage(error)} | source=${JSON.stringify(sourceState)}`,
      )
    }

    expect(created.mode).toBe('standard')
    expect(created.sourceType).toBe('tos')
    expect(created.sourceTos?.id).toBe(tos.id)
    expect(created.assignmentId).toBe(assignment.id)
    expect(created.items).toHaveLength(40)

    const { data: metadata, error: metadataError } = await teacher.client
      .from('assessment_documents')
      .select('document_id,user_id,assignment_id,source_tos_document_id,source_tos_version_number,total_items,mode,source_type,source_tos_content_snapshot,source_tos_raw_content_snapshot')
      .eq('document_id', created.id)
      .single()
    if (metadataError) throw new Error(`[STAGE1.1:METADATA_READ] ${metadataError.message}`)

    expect(metadata).toMatchObject({
      document_id: created.id,
      user_id: teacher.id,
      assignment_id: assignment.id,
      source_tos_document_id: tos.id,
      total_items: 40,
      mode: 'standard',
      source_type: 'tos',
    })

    expect(metadata.source_tos_raw_content_snapshot).toEqual(fixture.content)

    const reloaded = await loadAssessmentDocument(created.id, teacher.id, false)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.mode).toBe('standard')
    expect(reloaded?.sourceType).toBe('tos')
    expect(reloaded?.sourceTos?.id).toBe(tos.id)
    expect(reloaded?.assignmentId).toBe(assignment.id)
    expect(reloaded?.items).toHaveLength(40)

    const { data: sourceBeforeSecondSave } = await teacher.client
      .from('documents')
      .select('id,user_id,assignment_id,document_type,status')
      .eq('id', tos.id)
      .single()

    let saved
    try {
      saved = await saveAssessmentDocument({
        ...created,
        instructions: 'Stage 1.1 second-save round trip.',
      }, false)
    } catch (error) {
      const { data: metadataAtFailure } = await teacher.client
        .from('assessment_documents')
        .select('document_id,user_id,assignment_id,source_tos_document_id,source_tos_version_number,total_items,mode,source_type')
        .eq('document_id', created.id)
        .maybeSingle()

      throw new Error(
        `[STAGE1.1:SECOND_SAVE] ${errorMessage(error)} | source=${JSON.stringify(sourceBeforeSecondSave)} | metadata=${JSON.stringify(metadataAtFailure)} | created=${JSON.stringify({
          id: created.id,
          assignmentId: created.assignmentId,
          mode: created.mode,
          sourceType: created.sourceType,
          sourceTosId: created.sourceTos?.id ?? null,
          totalItems: created.items.length,
        })}`,
      )
    }

    expect(saved.id).toBe(created.id)
    expect(saved.mode).toBe('standard')
    expect(saved.sourceType).toBe('tos')
    expect(saved.sourceTos?.id).toBe(tos.id)
    expect(saved.assignmentId).toBe(assignment.id)
    expect(saved.items).toHaveLength(40)
  })
})
