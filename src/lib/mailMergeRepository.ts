import { supabase } from './supabase'
import { sha256Hex } from './docxTemplate'
import { inspectMailMerge, type MergeField } from './mailMerge'

export type SavedMergeTemplate = { id: string; name: string; type: 'docx' | 'xlsx'; filename: string; path: string; hash: string; mappings: Array<MergeField & { source: string }> }
function map(row: Record<string, unknown>): SavedMergeTemplate {
  return { id: String(row.id), name: String(row.name), type: row.file_type as 'docx' | 'xlsx', filename: String(row.original_filename), path: String(row.storage_path), hash: String(row.source_hash), mappings: row.mapping_json as SavedMergeTemplate['mappings'] }
}
export async function listMergeTemplates(userId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('document_templates').select('*').eq('user_id', userId).eq('document_type', 'teacher_document').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(map)
}
export async function saveMergeTemplate(userId: string, name: string, file: File, mappings: SavedMergeTemplate['mappings']) {
  if (!supabase) throw new Error('Sign in to save a reusable template.')
  const type = file.name.toLowerCase().endsWith('.docx') ? 'docx' : file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : null
  if (!type) throw new Error('Choose a DOCX or XLSX master template.')
  const buffer = await file.arrayBuffer(); const structure = inspectMailMerge(buffer, type)
  if (!structure.length) throw new Error('Add merge placeholders to the master before saving it.')
  if (name.trim().length < 1 || name.trim().length > 120) throw new Error('A template name must contain 1–120 characters.')
  const id = crypto.randomUUID(); const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120)
  const path = `${userId}/${id}/${filename}`
  const bucket = supabase.storage.from('document-templates')
  const mime = `application/vnd.openxmlformats-officedocument.${type === 'docx' ? 'wordprocessingml.document' : 'spreadsheetml.sheet'}`
  const uploaded = await bucket.upload(path, file, { upsert: false, contentType: mime })
  if (uploaded.error) throw uploaded.error
  const { data, error } = await supabase.from('document_templates').insert({ id, user_id: userId, name: name.trim(), document_type: 'teacher_document', file_type: type, original_filename: file.name, storage_path: path, file_size_bytes: file.size, source_hash: await sha256Hex(buffer), structure_json: structure, mapping_json: mappings, is_default: false }).select('*').single()
  if (error) { await bucket.remove([path]); throw error }
  return map(data)
}
export async function loadMergeMaster(template: SavedMergeTemplate): Promise<ArrayBuffer> {
  if (!supabase) throw new Error('Sign in to load this template.')
  const { data, error } = await supabase.storage.from('document-templates').download(template.path)
  if (error || !data) throw error ?? new Error('The template file is unavailable.')
  const buffer = await data.arrayBuffer()
  if (await sha256Hex(buffer) !== template.hash) throw new Error('The master template changed. Re-upload it and review its mappings.')
  inspectMailMerge(buffer, template.type)
  return buffer
}
