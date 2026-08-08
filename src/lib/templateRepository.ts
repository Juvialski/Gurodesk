import type {
  DocumentTemplate,
  DocumentTemplateElement,
  DocumentTemplateMapping,
  DocumentTemplateType,
  TemplateAnalysisResult,
} from '../types/documentTemplate'
import { supabase } from './supabase'

const TEMPLATE_BUCKET = 'document-templates'

function mapTemplate(row: Record<string, unknown>): DocumentTemplate {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    documentType: String(row.document_type) as DocumentTemplate['documentType'],
    fileType: String(row.file_type) as DocumentTemplate['fileType'],
    originalFilename: String(row.original_filename),
    storagePath: String(row.storage_path),
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    sourceHash: String(row.source_hash ?? ''),
    elements: Array.isArray(row.structure_json) ? row.structure_json as DocumentTemplateElement[] : [],
    mappings: Array.isArray(row.mapping_json) ? row.mapping_json as DocumentTemplateMapping[] : [],
    isDefault: Boolean(row.is_default),
    analysisModel: row.analysis_model ? String(row.analysis_model) : null,
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

export async function analyzeDocumentTemplate(elements: DocumentTemplateElement[], documentType: DocumentTemplateType): Promise<TemplateAnalysisResult> {
  if (!supabase) throw new Error('Template analysis requires a signed-in Supabase workspace.')
  const { data, error } = await supabase.functions.invoke('template-analyzer', {
    body: { documentType, elements },
  })
  if (error) throw new Error(await edgeError(error, 'Unable to analyze this template.'))
  if (data?.error) throw new Error(String(data.error))
  return data as TemplateAnalysisResult
}

export async function listDocumentTemplates(userId: string, documentType?: DocumentTemplateType): Promise<DocumentTemplate[]> {
  if (!supabase) return []
  let query = supabase.from('document_templates').select('*').eq('user_id', userId).order('is_default', { ascending: false }).order('updated_at', { ascending: false })
  if (documentType) query = query.eq('document_type', documentType)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapTemplate(row as Record<string, unknown>))
}

export async function saveNewDocumentTemplate(input: {
  id: string
  userId: string
  name: string
  documentType: DocumentTemplateType
  originalFilename: string
  file: Blob
  fileSizeBytes: number
  sourceHash: string
  elements: DocumentTemplateElement[]
  mappings: DocumentTemplateMapping[]
  analysisModel: string | null
  makeDefault: boolean
}): Promise<DocumentTemplate> {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'template.docx'
  const storagePath = `${input.userId}/${input.id}/${safeName}`
  const { error: uploadError } = await supabase.storage.from(TEMPLATE_BUCKET).upload(storagePath, input.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.from('document_templates').insert({
    id: input.id,
    user_id: input.userId,
    name: input.name.trim(),
    document_type: input.documentType,
    file_type: 'docx',
    original_filename: input.originalFilename,
    storage_path: storagePath,
    file_size_bytes: input.fileSizeBytes,
    source_hash: input.sourceHash,
    structure_json: input.elements,
    mapping_json: input.mappings,
    analysis_model: input.analysisModel,
    is_default: input.makeDefault,
  }).select('*').single()

  if (error) {
    await supabase.storage.from(TEMPLATE_BUCKET).remove([storagePath]).catch(() => {})
    throw error
  }
  return mapTemplate(data as Record<string, unknown>)
}

export async function updateDocumentTemplate(template: DocumentTemplate): Promise<DocumentTemplate> {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const { data, error } = await supabase.from('document_templates').update({
    name: template.name.trim(),
    mapping_json: template.mappings,
    structure_json: template.elements,
    analysis_model: template.analysisModel,
    is_default: template.isDefault,
    updated_at: new Date().toISOString(),
  }).eq('id', template.id).eq('user_id', template.userId).select('*').single()
  if (error) throw error
  return mapTemplate(data as Record<string, unknown>)
}

export async function clearDefaultDocumentTemplate(userId: string, documentType: DocumentTemplateType): Promise<void> {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const { error } = await supabase.from('document_templates').update({ is_default: false }).eq('user_id', userId).eq('document_type', documentType).eq('is_default', true)
  if (error) throw error
}

export async function setDefaultDocumentTemplate(template: DocumentTemplate): Promise<void> {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const { error } = await supabase.from('document_templates').update({ is_default: true }).eq('id', template.id).eq('user_id', template.userId)
  if (error) throw error
}

export async function deleteDocumentTemplate(template: DocumentTemplate): Promise<void> {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const { error: fileError } = await supabase.storage.from(TEMPLATE_BUCKET).remove([template.storagePath])
  if (fileError) throw fileError
  const { error } = await supabase.from('document_templates').delete().eq('id', template.id).eq('user_id', template.userId)
  if (error) throw error
}

export async function downloadDocumentTemplateFile(template: DocumentTemplate): Promise<ArrayBuffer> {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(template.storagePath)
  if (error) throw error
  return data.arrayBuffer()
}
