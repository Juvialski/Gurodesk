import type { TosDocumentTemplate, TosTemplateAnalysisResult, TosTemplateElement, TosTemplateMapping } from '../types/tosTemplate'
import { sha256Hex } from './docxTemplate'
import { supabase } from './supabase'

const BUCKET = 'document-templates'
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function mapTemplate(row: Record<string, unknown>): TosDocumentTemplate {
  return {
    id: String(row.id), userId: String(row.user_id), name: String(row.name), documentType: 'tos', fileType: 'xlsx',
    originalFilename: String(row.original_filename), storagePath: String(row.storage_path), fileSizeBytes: Number(row.file_size_bytes ?? 0), sourceHash: String(row.source_hash ?? ''),
    elements: Array.isArray(row.structure_json) ? row.structure_json as TosTemplateElement[] : [],
    mappings: Array.isArray(row.mapping_json) ? row.mapping_json as TosTemplateMapping[] : [],
    isDefault: Boolean(row.is_default), analysisModel: row.analysis_model ? String(row.analysis_model) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}

async function edgeError(error: unknown, fallback: string) {
  const maybe = error as { message?: string; context?: Response } | null
  try { if (maybe?.context) { const payload = await maybe.context.clone().json() as { error?: string }; if (payload.error) return payload.error } } catch {}
  return maybe?.message || fallback
}

import { detectTosCandidates, prioritizeTosTemplateElements } from './xlsxTemplate'

export async function analyzeTosTemplate(elements: TosTemplateElement[]): Promise<TosTemplateAnalysisResult> {
  const safeElements = prioritizeTosTemplateElements(elements, 320)
    .map(({ id, kind, text, context, isFormula, isMerged, isMergedAnchor }) => ({ id, kind, text, context, isFormula, isMerged, isMergedAnchor }))

  if (!supabase) {
    return {
      mappings: detectTosCandidates(elements),
      model: 'deterministic-offline-detector',
      fallbackUsed: true,
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('tos-template-analyzer', { body: { elements: safeElements } })
    if (error) {
      const fallback = detectTosCandidates(elements)
      if (fallback.length > 0) return { mappings: fallback, model: 'deterministic-fallback', fallbackUsed: true }
      throw new Error(await edgeError(error, 'Unable to analyze this workbook.'))
    }
    if (data?.error) {
      const fallback = detectTosCandidates(elements)
      if (fallback.length > 0) return { mappings: fallback, model: 'deterministic-fallback', fallbackUsed: true }
      throw new Error(String(data.error))
    }
    return data as TosTemplateAnalysisResult
  } catch (err) {
    const fallback = detectTosCandidates(elements)
    if (fallback.length > 0) return { mappings: fallback, model: 'deterministic-fallback', fallbackUsed: true }
    throw err
  }
}

export async function listTosTemplates(userId: string): Promise<TosDocumentTemplate[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('document_templates').select('*').eq('user_id', userId).eq('document_type', 'tos').eq('file_type', 'xlsx').order('is_default', { ascending: false }).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapTemplate(row as Record<string, unknown>))
}

export async function saveNewTosTemplate(input: { id: string; userId: string; name: string; originalFilename: string; file: Blob; fileSizeBytes: number; sourceHash: string; elements: TosTemplateElement[]; mappings: TosTemplateMapping[]; analysisModel: string | null; makeDefault: boolean }) {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  if (!/^[0-9a-f]{64}$/i.test(input.sourceHash)) throw new Error('A valid SHA-256 master fingerprint is required.')
  const safeName = input.originalFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'tos-template.xlsx'
  const path = `${input.userId}/${input.id}/${safeName}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.file, { cacheControl: '3600', upsert: false, contentType: MIME })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.from('document_templates').insert({ id: input.id, user_id: input.userId, name: input.name.trim(), document_type: 'tos', file_type: 'xlsx', original_filename: input.originalFilename, storage_path: path, file_size_bytes: input.fileSizeBytes, source_hash: input.sourceHash, structure_json: input.elements, mapping_json: input.mappings, analysis_model: input.analysisModel, is_default: input.makeDefault }).select('*').single()
  if (error) { await supabase.storage.from(BUCKET).remove([path]).catch(() => {}); throw error }
  return mapTemplate(data as Record<string, unknown>)
}

export async function updateTosTemplate(template: TosDocumentTemplate) {
  if (!supabase) throw new Error('Custom templates require Supabase mode.')
  const { data, error } = await supabase.from('document_templates').update({ name: template.name.trim(), mapping_json: template.mappings, structure_json: template.elements, analysis_model: template.analysisModel, is_default: template.isDefault, updated_at: new Date().toISOString() }).eq('id', template.id).eq('user_id', template.userId).eq('document_type', 'tos').select('*').single()
  if (error) throw error
  return mapTemplate(data as Record<string, unknown>)
}

export async function clearDefaultTosTemplate(userId: string) { if (!supabase) throw new Error('Custom templates require Supabase mode.'); const { error } = await supabase.from('document_templates').update({ is_default: false }).eq('user_id', userId).eq('document_type', 'tos').eq('is_default', true); if (error) throw error }
export async function setDefaultTosTemplate(template: TosDocumentTemplate) { if (!supabase) throw new Error('Custom templates require Supabase mode.'); const { error } = await supabase.from('document_templates').update({ is_default: true }).eq('id', template.id).eq('user_id', template.userId).eq('document_type', 'tos'); if (error) throw error }
export async function deleteTosTemplate(template: TosDocumentTemplate) { if (!supabase) throw new Error('Custom templates require Supabase mode.'); const { error: fileError } = await supabase.storage.from(BUCKET).remove([template.storagePath]); if (fileError) throw fileError; const { error } = await supabase.from('document_templates').delete().eq('id', template.id).eq('user_id', template.userId).eq('document_type', 'tos'); if (error) throw error }
export async function downloadTosTemplateFile(template: TosDocumentTemplate) { if (!supabase) throw new Error('Custom templates require Supabase mode.'); if (!/^[0-9a-f]{64}$/i.test(template.sourceHash)) throw new Error('This XLSX master has no valid fingerprint. Re-upload it before export.'); const { data, error } = await supabase.storage.from(BUCKET).download(template.storagePath); if (error) throw error; const buffer = await data.arrayBuffer(); if (await sha256Hex(buffer) !== template.sourceHash) throw new Error('The stored XLSX master no longer matches its saved mapping. Re-upload or remap it.'); return buffer }
