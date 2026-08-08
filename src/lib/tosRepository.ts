import type { InstructionalPacingBundle, InstructionalPacingEntry, TosContent, TosRecord } from '../types/tos'
import { normalizeTosContent, recalculateTosContent, sourceWeightForRow } from './tosFactory'
import { supabase } from './supabase'

const DEMO_TOS_KEY = 'gurodesk.demo.tosDocuments.v1'
const DEMO_ASSIGNMENTS_KEY = 'gurodesk.demo.assignments.v1'
export function clearDemoTosDocuments() { localStorage.removeItem(DEMO_TOS_KEY) }
function readDemoTos(): TosRecord[] {
  try {
    const value = localStorage.getItem(DEMO_TOS_KEY)
    const assignments = localStorage.getItem(DEMO_ASSIGNMENTS_KEY)
    if (!value || !assignments) return []
    const activeAssignmentIds = new Set((JSON.parse(assignments) as Array<{ id?: string }>).map((item) => item.id).filter(Boolean))
    return (JSON.parse(value) as TosRecord[]).filter((item) => item.assignmentId && activeAssignmentIds.has(item.assignmentId))
  } catch {
    return []
  }
}
function writeDemoTos(records: TosRecord[]) { localStorage.setItem(DEMO_TOS_KEY, JSON.stringify(records)) }

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function safeDraftDecimal(value: string) {
  const clean = value.trim()
  const match = /^(?:\d+|\d+\.\d+|\.\d+)$/.exec(clean)
  if (!match) return null
  const [whole = '0', fraction = ''] = clean.startsWith('.') ? ['0', clean.slice(1)] : clean.split('.')
  if (fraction.length > 8 || `${whole}${fraction}`.replace(/^0+(?=\d)/, '').length > 28) return null
  return clean
}

function mapTosDocument(row: Record<string, unknown>, versionNumber = 0): TosRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
    title: String(row.title ?? ''),
    schoolYear: String(row.school_year ?? ''),
    academicPeriodLabel: row.academic_period_label ? String(row.academic_period_label) : null,
    status: String(row.status) as TosRecord['status'],
    content: normalizeTosContent(row.structured_content as TosContent),
    versionNumber,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function versionNumbers(documentIds: string[]) {
  const versions = new Map<string, number>()
  if (!supabase || !documentIds.length) return versions
  const { data, error } = await supabase.from('document_versions').select('document_id, version_number').in('document_id', documentIds)
  if (error) throw error
  for (const row of data ?? []) {
    const id = String(row.document_id)
    versions.set(id, Math.max(versions.get(id) ?? 0, Number(row.version_number)))
  }
  return versions
}

export async function loadTosDocuments(userId: string, demo: boolean): Promise<TosRecord[]> {
  if (demo || !supabase) return readDemoTos()
    .filter((item) => item.userId === userId && item.status !== 'archived')
    .map((item) => ({ ...item, content: normalizeTosContent(item.content) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const { data, error } = await supabase.from('documents').select('*').eq('user_id', userId).eq('document_type', 'tos').neq('status', 'archived').order('updated_at', { ascending: false })
  if (error) throw error
  const ids = (data ?? []).map((row) => String(row.id))
  const versions = await versionNumbers(ids)
  return (data ?? []).map((row) => mapTosDocument(row as Record<string, unknown>, versions.get(String(row.id)) ?? 0))
}

export async function loadTosDocument(id: string, userId: string, demo: boolean): Promise<TosRecord | null> {
  if (demo || !supabase) {
    const found = readDemoTos().find((item) => item.id === id && item.userId === userId)
    return found ? { ...found, content: normalizeTosContent(found.content) } : null
  }
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).eq('user_id', userId).eq('document_type', 'tos').maybeSingle()
  if (error) throw error
  if (!data) return null
  const versions = await versionNumbers([id])
  return mapTosDocument(data as Record<string, unknown>, versions.get(id) ?? 0)
}

type ResolvedCompetency = {
  id: string
  code: string | null
  text: string
  sourcePage: number | null
  curriculumPeriodLabel: string
}

async function resolveCompetency(row: TosContent['rows'][number], content: TosContent): Promise<ResolvedCompetency | null> {
  if (!supabase) return null
  let query = supabase.from('curriculum_competencies')
    .select('id, subject_id, academic_period_id, competency_code, competency_text, source_page')
    .eq('verification_status', 'verified')
  query = looksLikeUuid(row.competency.id) ? query.eq('id', row.competency.id) : query.eq('competency_text', row.competency.text)
  if (row.competency.sourcePage !== null) query = query.eq('source_page', row.competency.sourcePage)
  const { data, error } = await query.limit(8)
  if (error) throw error
  const matches: ResolvedCompetency[] = []
  for (const candidate of data ?? []) {
    const subjectResult = await supabase.from('curriculum_subjects').select('id, grade_level, name, curriculum_version_id').eq('id', String(candidate.subject_id)).single()
    if (subjectResult.error || !subjectResult.data) continue
    const subject = subjectResult.data
    if (String(subject.grade_level) !== content.gradeLevel || String(subject.name).toLocaleLowerCase('en') !== content.learningArea.toLocaleLowerCase('en')) continue
    const versionResult = await supabase.from('curriculum_versions').select('id, code').eq('id', String(subject.curriculum_version_id)).single()
    if (versionResult.error || !versionResult.data || (content.curriculumVersionCode && String(versionResult.data.code) !== content.curriculumVersionCode)) continue
    let periodLabel = ''
    if (candidate.academic_period_id) {
      const periodResult = await supabase.from('academic_periods').select('id, label').eq('id', String(candidate.academic_period_id)).single()
      if (periodResult.error || !periodResult.data) continue
      periodLabel = String(periodResult.data.label)
      if (!content.curriculumPeriodLabels.includes(periodLabel) && !content.curriculumPeriodIds.includes(String(candidate.academic_period_id))) continue
    }
    matches.push({
      id: String(candidate.id),
      code: candidate.competency_code ? String(candidate.competency_code) : null,
      text: String(candidate.competency_text),
      sourcePage: candidate.source_page === null ? null : Number(candidate.source_page),
      curriculumPeriodLabel: periodLabel,
    })
  }
  return matches.length === 1 ? matches[0] : null
}

async function linkRows(content: TosContent, requireAll: boolean) {
  const resolved = await Promise.all(content.rows.map(async (row) => ({ row, competency: await resolveCompetency(row, content) })))
  const missing = resolved.filter((item) => !item.competency).length
  if (requireAll && missing) throw new Error(`${missing} selected competenc${missing === 1 ? 'y is' : 'ies are'} stale or could not be resolved to the verified production curriculum. Reopen the picker before finalizing.`)
  return resolved.flatMap(({ row, competency }) => competency ? [{
    rowId: row.id,
    competencyId: competency.id,
    competencyCode: competency.code,
    competencyText: competency.text,
    sourcePage: competency.sourcePage,
    curriculumPeriodLabel: competency.curriculumPeriodLabel,
    rowOrder: row.sortOrder,
    instructionalMinutes: safeDraftDecimal(row.instructionalMinutes),
    sourceWeight: safeDraftDecimal(sourceWeightForRow(content, row)) ?? '0',
    computedWeightPercent: row.computedWeightPercent,
    itemCount: row.itemCount,
    itemStart: row.itemStart,
    itemEnd: row.itemEnd,
    cognitiveAllocations: row.cognitiveAllocations,
    notes: row.notes,
  }] : [])
}

export async function saveTosDocument(
  record: TosRecord,
  demo: boolean,
  options: { requireAllCompetencies?: boolean } = {},
): Promise<TosRecord> {
  const content = recalculateTosContent(record.content)
  const now = new Date().toISOString()
  if (demo || !supabase) {
    const documents = readDemoTos()
    const index = documents.findIndex((item) => item.id === record.id)
    if (index >= 0 && documents[index].status !== 'draft') throw new Error('Only draft TOS documents can be edited.')
    const saved: TosRecord = {
      ...record,
      id: record.id || crypto.randomUUID(),
      title: content.title,
      schoolYear: content.schoolYear,
      academicPeriodLabel: content.gradingTermLabel || null,
      content,
      versionNumber: (index >= 0 ? documents[index].versionNumber : 0) + 1,
      createdAt: record.createdAt || now,
      updatedAt: now,
    }
    if (index >= 0) documents[index] = saved
    else documents.push(saved)
    writeDemoTos(documents)
    return saved
  }
  if (!record.assignmentId) throw new Error('A teacher-owned assignment is required.')
  const rows = await linkRows(content, record.status === 'final' || options.requireAllCompetencies === true)
  const { data, error } = await supabase.rpc('save_tos_document', {
    p_document_id: record.id || null,
    p_assignment_id: record.assignmentId,
    p_title: content.title,
    p_school_year: content.schoolYear,
    p_academic_period_label: content.gradingTermLabel || null,
    p_status: record.status,
    p_structured_content: content,
    p_rows: rows,
    p_change_note: record.status === 'final' ? 'Teacher finalized TOS' : 'Teacher saved TOS draft',
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
  const versions = await versionNumbers([String(row.id)])
  return mapTosDocument(row, versions.get(String(row.id)) ?? 0)
}

export async function archiveTosDocument(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) {
    writeDemoTos(readDemoTos().map((item) => item.id === id && item.userId === userId ? { ...item, status: 'archived' as const, updatedAt: new Date().toISOString() } : item))
    return
  }
  const { error } = await supabase.from('documents').update({ status: 'archived' }).eq('id', id).eq('user_id', userId).eq('document_type', 'tos')
  if (error) throw error
}

export async function duplicateTosDocument(source: TosRecord, demo: boolean): Promise<TosRecord> {
  const title = `${source.title || 'Untitled TOS'} — Copy`
  return saveTosDocument({
    ...source, id: '', title, status: 'draft', versionNumber: 0, createdAt: '', updatedAt: '',
    content: recalculateTosContent({ ...source.content, title, rows: source.content.rows.map((row, index) => ({ ...row, id: crypto.randomUUID(), sortOrder: index + 1 })) }),
  }, demo, { requireAllCompetencies: true })
}

export async function loadVerifiedInstructionalPacing(schoolYear: string, curriculumSubjectId: string, demo: boolean): Promise<InstructionalPacingBundle> {
  const unavailable: InstructionalPacingBundle = { available: false, planId: null, planTitle: null, entries: [] }
  if (demo || !supabase || !looksLikeUuid(curriculumSubjectId)) return unavailable
  const { data: plans, error: planError } = await supabase.from('instructional_pacing_plans').select('id, title').eq('school_year', schoolYear).eq('curriculum_subject_id', curriculumSubjectId).eq('verification_status', 'verified').eq('status', 'active').order('created_at', { ascending: false }).limit(1)
  if (planError) throw planError
  const plan = plans?.[0]
  if (!plan) return unavailable
  const { data, error } = await supabase.from('instructional_pacing_entries').select('competency_id, grading_period_id, suggested_sessions, suggested_minutes, week_number, pacing_note').eq('pacing_plan_id', String(plan.id)).order('sequence')
  if (error) throw error
  return {
    available: true, planId: String(plan.id), planTitle: String(plan.title),
    entries: (data ?? []).map((row): InstructionalPacingEntry => ({
      competencyId: String(row.competency_id), gradingPeriodId: row.grading_period_id ? String(row.grading_period_id) : null,
      suggestedSessions: row.suggested_sessions === null ? null : Number(row.suggested_sessions), suggestedMinutes: row.suggested_minutes === null ? null : Number(row.suggested_minutes),
      weekNumber: row.week_number === null ? null : Number(row.week_number), pacingNote: row.pacing_note ? String(row.pacing_note) : null,
    })),
  }
}
