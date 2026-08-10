import type {
  CustomCurriculumChoice,
  CustomCurriculumImport,
  CustomCurriculumMode,
  CustomCurriculumReview,
  CustomCurriculumSourceKind,
} from '../types/customCurriculum'
import { normalizeCustomCurriculumReview } from './curriculumImport'
import { supabase } from './supabase'

const BUCKET = 'custom-curricula'

type CreateImportInput = {
  id: string
  userId: string
  sourceKind: CustomCurriculumSourceKind
  curriculumMode: CustomCurriculumMode
  baseCurriculumVersionId: string | null
  revisionOfVersionId?: string | null
  title: string
  organizationName: string
  schoolYear: string
  gradeLevel: string
  learningArea: string
  file?: File | null
  mimeType?: string | null
  sourceHash: string
  initialReview?: CustomCurriculumReview | null
}

function mapImport(row: Record<string, unknown>): CustomCurriculumImport {
  const fallback = {
    curriculumMode: row.curriculum_mode === 'hybrid' ? 'hybrid' as const : 'custom' as const,
    title: String(row.title ?? ''),
    organizationName: String(row.organization_name ?? ''),
    schoolYear: String(row.school_year ?? ''),
    gradeLevel: String(row.grade_level ?? ''),
    learningArea: String(row.learning_area ?? ''),
  }
  const analysisRaw = row.analysis_json && typeof row.analysis_json === 'object' && !Array.isArray(row.analysis_json) && Object.keys(row.analysis_json as object).length
    ? normalizeCustomCurriculumReview(row.analysis_json, fallback)
    : null
  const reviewRaw = row.review_json && typeof row.review_json === 'object' && !Array.isArray(row.review_json) && Object.keys(row.review_json as object).length
    ? normalizeCustomCurriculumReview(row.review_json, fallback)
    : null
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: String(row.status) as CustomCurriculumImport['status'],
    sourceKind: String(row.source_kind) as CustomCurriculumSourceKind,
    curriculumMode: String(row.curriculum_mode) as CustomCurriculumMode,
    baseCurriculumVersionId: row.base_curriculum_version_id ? String(row.base_curriculum_version_id) : null,
    revisionOfVersionId: row.revision_of_version_id ? String(row.revision_of_version_id) : null,
    title: String(row.title ?? ''),
    organizationName: String(row.organization_name ?? ''),
    schoolYear: String(row.school_year ?? ''),
    gradeLevel: String(row.grade_level ?? ''),
    learningArea: String(row.learning_area ?? ''),
    originalFilename: row.original_filename ? String(row.original_filename) : null,
    mimeType: row.mime_type ? String(row.mime_type) : null,
    storagePath: row.storage_path ? String(row.storage_path) : null,
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    sourceHash: String(row.source_hash ?? ''),
    analysis: analysisRaw,
    review: reviewRaw,
    analysisModel: row.analysis_model ? String(row.analysis_model) : null,
    fallbackUsed: Boolean(row.fallback_used),
    publishedVersionId: row.published_version_id ? String(row.published_version_id) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function edgeError(error: unknown, fallback: string) {
  const maybe = error as { message?: string; context?: Response } | null
  try {
    if (maybe?.context) {
      const payload = await maybe.context.clone().json() as { error?: string }
      if (payload.error) return payload.error
    }
  } catch {}
  return maybe?.message || fallback
}

export async function listCustomCurriculumImports(userId: string): Promise<CustomCurriculumImport[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('custom_curriculum_imports')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapImport(row as Record<string, unknown>))
}

export async function createCustomCurriculumImport(input: CreateImportInput): Promise<CustomCurriculumImport> {
  if (!supabase) throw new Error('Custom curricula require a signed-in Supabase workspace.')
  let storagePath: string | null = null
  if (input.file) {
    const safeFilename = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-140) || 'curriculum-source'
    storagePath = `${input.userId}/${input.id}/${safeFilename}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
      cacheControl: '3600',
      contentType: input.mimeType || input.file.type || 'application/octet-stream',
      upsert: false,
    })
    if (uploadError) throw uploadError
  }

  const initialReview = input.initialReview ?? null
  const { data, error } = await supabase.from('custom_curriculum_imports').insert({
    id: input.id,
    user_id: input.userId,
    status: initialReview ? 'analyzed' : 'draft',
    source_kind: input.sourceKind,
    curriculum_mode: input.curriculumMode,
    base_curriculum_version_id: input.baseCurriculumVersionId,
    revision_of_version_id: input.revisionOfVersionId ?? null,
    title: input.title.trim(),
    organization_name: input.organizationName.trim(),
    school_year: input.schoolYear,
    grade_level: input.gradeLevel,
    learning_area: input.learningArea,
    original_filename: input.file?.name ?? null,
    mime_type: input.mimeType ?? input.file?.type ?? null,
    storage_path: storagePath,
    file_size_bytes: input.file?.size ?? 0,
    source_hash: input.sourceHash,
    analysis_json: initialReview ?? {},
    review_json: initialReview ?? {},
  }).select('*').single()

  if (error) {
    if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    throw error
  }
  return mapImport(data as Record<string, unknown>)
}

export async function analyzeCustomCurriculumImport(importId: string, extractedText: string | null) {
  if (!supabase) throw new Error('Curriculum analysis requires a signed-in Supabase workspace.')
  const { data, error } = await supabase.functions.invoke('curriculum-import-analyzer', {
    body: { importId, extractedText },
  })
  if (error) throw new Error(await edgeError(error, 'Unable to analyze this curriculum.'))
  if (data?.error) throw new Error(String(data.error))
  return normalizeCustomCurriculumReview(data.review)
}

export async function saveCustomCurriculumReview(importId: string, userId: string, review: CustomCurriculumReview) {
  if (!supabase) throw new Error('Custom curricula require a signed-in Supabase workspace.')
  const { data, error } = await supabase.from('custom_curriculum_imports')
    .update({
      status: 'analyzed',
      title: review.title.trim(),
      organization_name: review.organizationName.trim(),
      school_year: review.schoolYear,
      grade_level: review.gradeLevel,
      learning_area: review.learningArea,
      curriculum_mode: review.curriculumMode,
      review_json: review,
      updated_at: new Date().toISOString(),
    })
    .eq('id', importId)
    .eq('user_id', userId)
    .neq('status', 'approved')
    .select('*')
    .single()
  if (error) throw error
  return mapImport(data as Record<string, unknown>)
}

export async function publishCustomCurriculum(importId: string, review: CustomCurriculumReview) {
  if (!supabase) throw new Error('Custom curricula require a signed-in Supabase workspace.')
  const { data, error } = await supabase.rpc('publish_custom_curriculum', {
    p_import_id: importId,
    p_review_json: review,
  })
  if (error) throw error
  return String(data)
}

export async function deleteCustomCurriculumImport(item: CustomCurriculumImport) {
  if (!supabase) throw new Error('Custom curricula require a signed-in Supabase workspace.')
  if (item.status === 'approved') throw new Error('Approved curriculum records are versioned and cannot be deleted. Archive the published version instead.')
  if (item.storagePath) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.storagePath])
    if (storageError) throw storageError
  }
  const { error } = await supabase.from('custom_curriculum_imports').delete().eq('id', item.id).eq('user_id', item.userId)
  if (error) throw error
}

export async function listCustomCurriculumChoices(userId: string, schoolYear?: string): Promise<CustomCurriculumChoice[]> {
  if (!supabase) return []
  let versionsQuery = supabase.from('curriculum_versions')
    .select('id, name, origin_kind, organization_name, revision_number, status, effective_from_school_year')
    .eq('owner_user_id', userId)
    .in('origin_kind', ['custom', 'hybrid'])
    .eq('approval_status', 'approved')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  if (schoolYear) versionsQuery = versionsQuery.eq('effective_from_school_year', schoolYear)
  const { data: versions, error: versionsError } = await versionsQuery
  if (versionsError) throw versionsError
  const versionRows = (versions ?? []) as Array<Record<string, unknown>>
  if (!versionRows.length) return []
  const ids = versionRows.map((row) => String(row.id))
  const { data: subjects, error: subjectsError } = await supabase.from('curriculum_subjects')
    .select('id, curriculum_version_id, grade_level, name')
    .in('curriculum_version_id', ids)
  if (subjectsError) throw subjectsError
  const versionMap = new Map(versionRows.map((row) => [String(row.id), row]))
  return (subjects ?? []).flatMap((subjectRaw) => {
    const subject = subjectRaw as Record<string, unknown>
    const version = versionMap.get(String(subject.curriculum_version_id))
    if (!version) return []
    return [{
      versionId: String(version.id),
      originKind: String(version.origin_kind) as 'custom' | 'hybrid',
      name: String(version.name),
      organizationName: version.organization_name ? String(version.organization_name) : null,
      revisionNumber: Number(version.revision_number ?? 1),
      gradeLevel: String(subject.grade_level),
      learningArea: String(subject.name),
      schoolYear: String(version.effective_from_school_year),
      status: String(version.status) as 'active' | 'superseded',
    } satisfies CustomCurriculumChoice]
  })
}

export async function archiveCustomCurriculum(versionId: string) {
  if (!supabase) throw new Error('Custom curricula require a signed-in Supabase workspace.')
  const { error } = await supabase.rpc('archive_custom_curriculum', { p_version_id: versionId })
  if (error) throw error
}
