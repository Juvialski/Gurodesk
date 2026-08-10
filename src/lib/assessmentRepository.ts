import type {
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentBlueprint,
  AssessmentItem,
  AssessmentRecord,
  AssessmentTosSnapshot,
  QuestionType,
} from '../types/assessment'
import type { AssessmentVisual } from '../types/assessmentVisual'
import type { TosContent, TosRecord } from '../types/tos'
import { createAssessmentBlueprint, duplicateAssessmentBlueprint, normalizeAssessmentBlueprint } from './assessmentBlueprint'
import { deriveAssessmentTotalPoints, normalizeItemPoints } from './assessmentScoring'
import { validateAssessmentForFinal } from './assessmentGeneration'
import { isAssessmentVisual } from './assessmentVisualValidation'
import { supabase } from './supabase'

const DEMO_ASSESSMENTS_KEY = 'gurodesk.demo.assessmentDocuments.v1'

type DbRow = Record<string, unknown>

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function readDemoAssessments(): AssessmentRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = localStorage.getItem(DEMO_ASSESSMENTS_KEY)
    if (!value) return []
    const parsed = JSON.parse(value) as AssessmentRecord[]
    return Array.isArray(parsed) ? parsed.map((item) => normalizeAssessmentBlueprint(item)) : []
  } catch {
    return []
  }
}

function writeDemoAssessments(records: AssessmentRecord[]) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(DEMO_ASSESSMENTS_KEY, JSON.stringify(records))
}

function text(value: unknown, fallback = '') {
  return value === null || value === undefined ? fallback : String(value)
}

function nullableText(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value)
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined || value === '' ? null : Number(value)
}

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : {}
}

function firstRelation(value: unknown): DbRow | null {
  if (Array.isArray(value)) return value.length ? asObject(value[0]) : null
  return value && typeof value === 'object' ? asObject(value) : null
}

function relationRows(value: unknown): DbRow[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object').map((item) => asObject(item))
}

/** Normalize only missing shape defaults; never recalculate a finalized source. */
function preserveTosContentSnapshot(value: unknown, fallback: Partial<TosContent> = {}): TosContent {
  const source = clone(asObject(value) as TosContent)
  return {
    ...source,
    schemaVersion: 1,
    title: source.title ?? fallback.title ?? '',
    assessmentTitle: source.assessmentTitle ?? fallback.assessmentTitle ?? '',
    sections: Array.isArray(source.sections) ? source.sections : [],
    gradeLevel: source.gradeLevel ?? fallback.gradeLevel ?? '',
    learningArea: source.learningArea ?? fallback.learningArea ?? '',
    schoolYear: source.schoolYear ?? fallback.schoolYear ?? '',
    gradingTermId: source.gradingTermId ?? fallback.gradingTermId ?? '',
    gradingTermLabel: source.gradingTermLabel ?? fallback.gradingTermLabel ?? '',
    curriculumVersionId: source.curriculumVersionId ?? fallback.curriculumVersionId ?? '',
    curriculumVersionCode: source.curriculumVersionCode ?? fallback.curriculumVersionCode ?? '',
    curriculumVersionName: source.curriculumVersionName ?? fallback.curriculumVersionName ?? '',
    curriculumSubjectId: source.curriculumSubjectId ?? fallback.curriculumSubjectId ?? '',
    curriculumPeriodIds: Array.isArray(source.curriculumPeriodIds) ? source.curriculumPeriodIds : [],
    curriculumPeriodLabels: Array.isArray(source.curriculumPeriodLabels) ? source.curriculumPeriodLabels : [],
    sourceTitle: source.sourceTitle ?? fallback.sourceTitle ?? '',
    sourceUrl: source.sourceUrl ?? fallback.sourceUrl ?? '',
    totalItems: Number(source.totalItems ?? fallback.totalItems ?? 0),
    weightingMethod: source.weightingMethod ?? fallback.weightingMethod ?? 'equal',
    cognitiveCategories: Array.isArray(source.cognitiveCategories) ? source.cognitiveCategories : [],
    rows: Array.isArray(source.rows) ? source.rows : [],
    notes: source.notes ?? fallback.notes ?? '',
    calculation: source.calculation ?? fallback.calculation ?? {
      engine: 'hamilton-largest-remainder-v1', valid: false, totalAllocated: 0, calculatedAt: null, warnings: [],
    },
  } as TosContent
}

function normalizeAnswer(value: unknown, questionType: QuestionType, choices: unknown): AssessmentAnswer {
  const answer = asObject(value)
  if (questionType === 'multiple_choice') {
    const sourceChoices = Array.isArray(answer.choices) ? answer.choices : Array.isArray(choices) ? choices : []
    return {
      type: 'multiple_choice',
      choices: sourceChoices.map((choice, index) => {
        const item = asObject(choice)
        return { id: text(item.id, `choice-${index + 1}`), text: text(item.text) }
      }),
      choiceId: text(answer.choiceId),
    }
  }
  if (questionType === 'true_false') {
    return { type: 'true_false', value: Boolean(answer.value) }
  }
  if (questionType === 'short_answer') {
    const values = Array.isArray(answer.acceptedAnswers)
      ? answer.acceptedAnswers
      : Array.isArray(answer.accepted) ? answer.accepted : []
    return {
      type: 'short_answer',
      acceptedAnswers: values.map(String),
      caseSensitive: answer.caseSensitive === true,
    }
  }
  if (questionType === 'identification') {
    const values = Array.isArray(answer.acceptedAnswers) ? answer.acceptedAnswers : Array.isArray(answer.accepted) ? answer.accepted : []
    return { type: 'identification', acceptedAnswers: values.map(String), caseSensitive: answer.caseSensitive === true }
  }
  if (questionType === 'fill_in_the_blank') {
    return {
      type: 'fill_in_the_blank',
      blanks: (Array.isArray(answer.blanks) ? answer.blanks : []).map((blank, index) => {
        const value = asObject(blank)
        return {
          id: text(value.id, `blank-${index + 1}`),
          acceptedAnswers: (Array.isArray(value.acceptedAnswers) ? value.acceptedAnswers : []).map(String),
          ...(value.caseSensitive !== undefined ? { caseSensitive: value.caseSensitive === true } : {}),
          ...(value.pointsPossible !== undefined ? { pointsPossible: Number(value.pointsPossible) } : {}),
        }
      }),
    }
  }
  if (questionType === 'numerical_answer') {
    return {
      type: 'numerical_answer',
      value: Number(answer.value ?? 0),
      ...(answer.tolerance !== undefined ? { tolerance: Number(answer.tolerance) } : {}),
      ...(answer.unit !== undefined ? { unit: String(answer.unit) } : {}),
      ...(answer.requireUnit !== undefined ? { requireUnit: answer.requireUnit === true } : {}),
    }
  }
  if (questionType === 'problem_solving') {
    return {
      type: 'problem_solving',
      finalAnswer: typeof answer.finalAnswer === 'number' ? answer.finalAnswer : text(answer.finalAnswer),
      solutionOutline: text(answer.solutionOutline),
      ...(Array.isArray(answer.subparts) ? { subparts: answer.subparts.map((subpart, index) => {
        const value = asObject(subpart)
        return {
          id: text(value.id, `part-${index + 1}`), prompt: text(value.prompt),
          ...(value.expectedAnswer !== undefined ? { expectedAnswer: typeof value.expectedAnswer === 'number' ? value.expectedAnswer : String(value.expectedAnswer) } : {}),
          pointsPossible: Number(value.pointsPossible ?? 1),
          ...(Array.isArray(value.scoringCriteria) ? { scoringCriteria: value.scoringCriteria as never } : {}),
        }
      }) } : {}),
      ...(Array.isArray(answer.scoringCriteria) ? { scoringCriteria: answer.scoringCriteria as never } : {}),
    }
  }
  if (questionType === 'matching') {
    return {
      type: 'matching',
      prompts: (Array.isArray(answer.prompts) ? answer.prompts : []).map((prompt, index) => { const value = asObject(prompt); return { id: text(value.id, `prompt-${index + 1}`), text: text(value.text) } }),
      choices: (Array.isArray(answer.choices) ? answer.choices : []).map((choice, index) => { const value = asObject(choice); return { id: text(value.id, `choice-${index + 1}`), text: text(value.text), ...(value.label !== undefined ? { label: String(value.label) } : {}) } }),
      mappings: (Array.isArray(answer.mappings) ? answer.mappings : []).map((mapping) => { const value = asObject(mapping); return { promptId: text(value.promptId), choiceId: text(value.choiceId), ...(value.pointsPossible !== undefined ? { pointsPossible: Number(value.pointsPossible) } : {}) } }),
      // Preserve the canonical generated wire shape: false is represented by
      // absence. Re-introducing `reusableChoices:false` during a reload makes
      // an otherwise unchanged locked Matching item JSON-distinct on the next
      // full assessment save, which correctly trips the database lock guard.
      ...(answer.reusableChoices === true ? { reusableChoices: true } : {}),
      ...(answer.pointsPerMatch !== undefined ? { pointsPerMatch: Number(answer.pointsPerMatch) } : {}),
      ...(answer.groupPointsPossible !== undefined ? { groupPointsPossible: Number(answer.groupPointsPossible) } : {}),
    }
  }
  if (questionType === 'multiple_select') {
    const sourceChoices = Array.isArray(answer.choices) ? answer.choices : Array.isArray(choices) ? choices : []
    return {
      type: 'multiple_select',
      choices: sourceChoices.map((choice, index) => { const value = asObject(choice); return { id: text(value.id, `choice-${index + 1}`), text: text(value.text) } }),
      choiceIds: (Array.isArray(answer.choiceIds) ? answer.choiceIds : []).map(String),
      scoringPolicy: 'all_or_nothing',
    }
  }
  if (questionType === 'essay') {
    return {
      type: 'essay',
      keyPoints: (Array.isArray(answer.keyPoints) ? answer.keyPoints : []).map(String),
      ...(Array.isArray(answer.rubric) ? { rubric: answer.rubric as never } : {}),
      ...(answer.expectedResponse !== undefined ? { expectedResponse: String(answer.expectedResponse) } : {}),
      ...(answer.scoringNotes !== undefined ? { scoringNotes: String(answer.scoringNotes) } : {}),
    }
  }
  return {
    type: 'constructed_response',
    expectedResponse: text(answer.expectedResponse ?? answer.expected),
    sampleResponse: text(answer.sampleResponse),
    ...(answer.rubricGuidance ? { rubricGuidance: String(answer.rubricGuidance) } : {}),
    ...(Array.isArray(answer.expectedElements) ? { expectedElements: answer.expectedElements.map(String) } : {}),
    ...(Array.isArray(answer.rubric) ? { rubric: answer.rubric as never } : {}),
  }
}

function mapItem(row: DbRow): AssessmentItem {
  const questionType = text(row.question_type, 'multiple_choice') as QuestionType
  const storedAnswer = asObject(row.answer)
  const storedVisual = isAssessmentVisual(storedAnswer._visual) ? storedAnswer._visual as AssessmentVisual : undefined
  return {
    id: text(row.id),
    itemNumber: Number(row.item_number),
    competencySnapshot: {
      id: text(row.canonical_competency_id),
      code: nullableText(row.competency_code_snapshot),
      text: text(row.competency_text_snapshot),
      sourcePage: nullableNumber(row.competency_source_page_snapshot),
      academicPeriodId: nullableText(row.competency_academic_period_id_snapshot),
      curriculumPeriodId: nullableText(row.competency_curriculum_period_id_snapshot),
      curriculumPeriodLabel: text(row.competency_period_label_snapshot),
    },
    cognitiveCategorySnapshot: {
      id: text(row.cognitive_category_id),
      label: text(row.cognitive_category_label_snapshot),
      shortLabel: text(row.cognitive_category_short_label_snapshot),
    },
    mapping: {
      rowId: text(row.tos_row_id),
      competencyId: text(row.canonical_competency_id),
      cognitiveCategoryId: text(row.cognitive_category_id),
      allocationItemStart: Number(row.allocation_item_start),
      allocationItemEnd: Number(row.allocation_item_end),
      allocationIndex: Number(row.allocation_index),
    },
    prompt: text(row.prompt),
    questionType,
    answer: normalizeAnswer(row.answer, questionType, row.choices),
    authorshipState: text(row.authorship_state, 'empty') as AssessmentAuthorshipState,
    rationale: text(row.rationale),
    teacherNotes: text(row.teacher_notes),
    pointsPossible: row.points_possible === null || row.points_possible === undefined ? normalizeItemPoints({ points: row.points === null || row.points === undefined ? 1 : Number(row.points) }) : Number(row.points_possible),
    points: row.points === null || row.points === undefined ? (row.points_possible === null || row.points_possible === undefined ? 1 : Number(row.points_possible)) : Number(row.points),
    qaState: text(row.qa_state, 'empty') as AssessmentItem['qaState'],
    locked: row.locked === true,
    history: Array.isArray(row.version_history) ? clone(row.version_history) as AssessmentItem['history'] : Array.isArray(row.qa_history) ? clone(row.qa_history) as AssessmentItem['history'] : [],
    ...(storedVisual ? { visual: clone(storedVisual) } : {}),
  }
}

function sourceSnapshotFromRow(
  metadata: DbRow,
  document: DbRow,
): AssessmentTosSnapshot {
  const content = preserveTosContentSnapshot(metadata.source_tos_content_snapshot, { schoolYear: text(document.school_year) })
  return {
    id: text(metadata.source_tos_document_id),
    versionNumber: Number(metadata.source_tos_version_number ?? 0),
    title: text(content.title, text(document.title)),
    status: 'final',
    assignmentId: nullableText(metadata.assignment_id ?? document.assignment_id),
    schoolYear: text(content.schoolYear, text(document.school_year)),
    academicPeriodLabel: nullableText(content.gradingTermLabel ?? document.academic_period_label),
    content,
  }
}

function mapAssessmentDocument(
  document: DbRow,
  metadata: DbRow,
  itemRows: DbRow[],
  versionNumber: number,
): AssessmentRecord {
  const sourceTos = sourceSnapshotFromRow(metadata, document)
  const content = sourceTos.content
  const record: AssessmentRecord = {
    id: text(document.id),
    userId: text(metadata.user_id ?? document.user_id),
    assignmentId: nullableText(metadata.assignment_id ?? document.assignment_id),
    title: text(document.title),
    instructions: text(metadata.instructions),
    gradeLevel: text(content.gradeLevel),
    learningArea: text(content.learningArea),
    schoolYear: text(content.schoolYear, text(document.school_year)),
    gradingTermId: text(content.gradingTermId),
    gradingTermLabel: text(content.gradingTermLabel, text(document.academic_period_label)),
    curriculumPeriodIds: Array.isArray(content.curriculumPeriodIds) ? content.curriculumPeriodIds.map(String) : [],
    curriculumPeriodLabels: Array.isArray(content.curriculumPeriodLabels) ? content.curriculumPeriodLabels.map(String) : [],
    totalItems: Number(metadata.total_items ?? content.totalItems ?? itemRows.length),
    totalPoints: deriveAssessmentTotalPoints(itemRows.map(mapItem)),
    settings: (asObject(metadata.settings ?? metadata.assessment_settings ?? asObject(document.structured_content).settings) as AssessmentRecord['settings']) ?? undefined,
    versionNumber,
    status: text(document.status, 'draft') as AssessmentRecord['status'],
    sourceTos,
    items: itemRows.map(mapItem).sort((a, b) => a.itemNumber - b.itemNumber),
    createdAt: text(document.created_at),
    updatedAt: text(document.updated_at),
  }
  return normalizeAssessmentBlueprint(record)
}

async function versionNumbers(documentIds: string[]) {
  const versions = new Map<string, number>()
  if (!supabase || !documentIds.length) return versions
  const { data, error } = await supabase
    .from('document_versions')
    .select('document_id, version_number')
    .in('document_id', documentIds)
  if (error) throw error
  for (const row of data ?? []) {
    const id = text(row.document_id)
    versions.set(id, Math.max(versions.get(id) ?? 0, Number(row.version_number)))
  }
  return versions
}

function mapNestedAssessment(document: DbRow, versionNumber: number): AssessmentRecord | null {
  const metadata = firstRelation(document.assessment_documents)
  if (!metadata) return null
  return mapAssessmentDocument(document, metadata, relationRows(metadata.assessment_items), versionNumber)
}

function assessmentContentMirror(record: AssessmentRecord) {
  return {
    schemaVersion: 1,
    sourceTos: clone(record.sourceTos),
    sourceTosDocumentId: record.sourceTos.id,
    sourceTosVersionNumber: record.sourceTos.versionNumber,
    title: record.title,
    instructions: record.instructions,
    gradeLevel: record.gradeLevel,
    learningArea: record.learningArea,
    schoolYear: record.schoolYear,
    gradingTermId: record.gradingTermId,
    gradingTermLabel: record.gradingTermLabel,
    curriculumPeriodIds: [...record.curriculumPeriodIds],
    curriculumPeriodLabels: [...record.curriculumPeriodLabels],
    totalItems: record.totalItems,
    totalPoints: deriveAssessmentTotalPoints(record.items),
    settings: clone(record.settings ?? {}),
    items: record.items.map((item) => itemWire(item)),
  }
}

function itemWire(item: AssessmentItem) {
  const answer = clone(item.answer) as unknown as Record<string, unknown>
  // The relational assessment_items projection predates visuals.  Keep this
  // additive, validated reserved key inside its JSON answer payload so the
  // existing RPC/mirror/version machinery persists it without a migration.
  delete answer._visual
  if (item.visual && isAssessmentVisual(item.visual)) answer._visual = clone(item.visual)
  return {
    id: item.id,
    itemNumber: item.itemNumber,
    competencySnapshot: clone(item.competencySnapshot),
    cognitiveCategorySnapshot: clone(item.cognitiveCategorySnapshot),
    mapping: clone(item.mapping),
    questionType: item.questionType,
    prompt: item.prompt ?? '',
    answer,
    pointsPossible: normalizeItemPoints(item),
    // Keep the legacy wire column aligned with the canonical value.  Older
    // RPCs only read `points`; the additive migration mirrors it into
    // points_possible for those callers.
    points: normalizeItemPoints(item),
    rationale: item.rationale ?? '',
    teacherNotes: item.teacherNotes ?? '',
    authorshipState: item.authorshipState,
    qaState: item.qaState ?? 'empty',
    locked: item.locked === true,
    history: clone(item.history ?? []).slice(-5),
  }
}

function assertSourceIsFinal(tos: TosRecord) {
  if (tos.status !== 'final') throw new Error('Assessments can only be created from a finalized TOS.')
  if (!tos.id) throw new Error('The finalized TOS needs a persisted document ID before assessment creation.')
}

/**
 * The visible finalized TOS JSON may contain a local-manifest fallback
 * competency ID.  Production's normalized `tos_competencies` projection is the
 * authority and already contains the verified canonical UUID/snapshots.  Resolve
 * the whole source in set queries before expanding it; never cast a fallback ID
 * or silently weaken the database FK/finalization checks.
 */
async function canonicalizeFinalTosForProduction(tos: TosRecord): Promise<TosRecord> {
  if (!supabase) return tos
  const { data: projectedRows, error: projectionError } = await supabase
    .from('tos_competencies')
    .select('row_id, competency_id, competency_code_snapshot, competency_text_snapshot, source_page_snapshot, curriculum_period_label_snapshot')
    .eq('document_id', tos.id)
    .order('row_order', { ascending: true })
  if (projectionError) throw projectionError
  const projections = (projectedRows ?? []) as unknown as DbRow[]
  const competencyIds = [...new Set(projections.map((row) => text(row.competency_id)).filter(Boolean))]
  if (!competencyIds.length || projections.length !== tos.content.rows.length) {
    throw new Error('The finalized TOS has no complete canonical relational competency projection.')
  }
  const { data: competencyRows, error: competencyError } = await supabase
    .from('curriculum_competencies')
    .select('id, competency_code, competency_text, source_page, academic_period_id, verification_status')
    .in('id', competencyIds)
  if (competencyError) throw competencyError
  const canonical = new Map((competencyRows ?? []).map((row) => [text(row.id), row as unknown as DbRow]))
  const projectionByRow = new Map(projections.map((row) => [text(row.row_id), row]))
  const rows = tos.content.rows.map((row) => {
    const projection = projectionByRow.get(row.id)
    const competency = projection ? canonical.get(text(projection.competency_id)) : undefined
    if (!projection || !competency || text(competency.verification_status) !== 'verified') {
      throw new Error(`Finalized TOS row ${row.sortOrder} is not linked to a verified canonical competency.`)
    }
    if (
      nullableText(projection.competency_code_snapshot) !== nullableText(competency.competency_code)
      || text(projection.competency_text_snapshot) !== text(competency.competency_text)
      || nullableNumber(projection.source_page_snapshot) !== nullableNumber(competency.source_page)
    ) {
      throw new Error(`Finalized TOS row ${row.sortOrder} has a stale canonical competency snapshot.`)
    }
    const period = nullableText(competency.academic_period_id) ?? row.competency.academicPeriodId
    return {
      ...row,
      competency: {
        ...row.competency,
        id: text(projection.competency_id),
        code: nullableText(projection.competency_code_snapshot ?? competency.competency_code),
        text: text(projection.competency_text_snapshot ?? competency.competency_text),
        sourcePage: nullableNumber(projection.source_page_snapshot ?? competency.source_page),
        academicPeriodId: period,
        curriculumPeriodId: period,
        curriculumPeriodLabel: text(projection.curriculum_period_label_snapshot, row.competency.curriculumPeriodLabel),
        verificationStatus: 'verified' as const,
      },
    }
  })
  return {
    ...tos,
    content: preserveTosContentSnapshot({ ...clone(tos.content), rows }),
  }
}

function mappingKey(item: AssessmentItem) {
  const fields = [
    item.itemNumber,
    item.competencySnapshot.id,
    item.competencySnapshot.code ?? '',
    item.competencySnapshot.text,
    item.competencySnapshot.sourcePage ?? '',
    item.competencySnapshot.academicPeriodId ?? '',
    item.competencySnapshot.curriculumPeriodId ?? '',
    item.competencySnapshot.curriculumPeriodLabel,
    item.cognitiveCategorySnapshot.id,
    item.cognitiveCategorySnapshot.label,
    item.cognitiveCategorySnapshot.shortLabel,
    item.mapping.rowId,
    item.mapping.competencyId,
    item.mapping.cognitiveCategoryId,
    item.mapping.allocationItemStart,
    item.mapping.allocationItemEnd,
    item.mapping.allocationIndex,
  ]
  return JSON.stringify(fields)
}

function assertBlueprintIntegrity(record: AssessmentRecord, existing?: AssessmentRecord | null, requireFinal = false) {
  if (!record.id || !record.userId) throw new Error('Assessment identity is required.')
  if (record.status === 'archived') throw new Error('Archived assessments cannot be edited.')
  if (existing && existing.status !== 'draft') throw new Error('Only draft assessments can be edited.')
  if (existing && (
    existing.assignmentId !== record.assignmentId
    || existing.sourceTos.id !== record.sourceTos.id
    || existing.sourceTos.versionNumber !== record.sourceTos.versionNumber
    || JSON.stringify(existing.sourceTos.content) !== JSON.stringify(record.sourceTos.content)
  )) throw new Error('Assessment assignment and finalized TOS snapshot are immutable.')
  if (!Number.isSafeInteger(record.totalItems) || record.totalItems < 1 || record.items.length !== record.totalItems) {
    throw new Error('Assessment items must exactly match the finalized TOS total.')
  }
  const expected = createAssessmentBlueprint({
    ...record.sourceTos,
    userId: record.userId,
    title: record.sourceTos.title,
    status: 'final',
    versionNumber: record.sourceTos.versionNumber,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  } as TosRecord)
  const seen = new Set<number>()
  for (const item of record.items) {
    if (!Number.isSafeInteger(item.itemNumber) || item.itemNumber < 1) {
      throw new Error('Assessment item numbering must use positive exact integers.')
    }
    if (seen.has(item.itemNumber)) {
      throw new Error('Assessment item numbering cannot contain duplicates.')
    }
    seen.add(item.itemNumber)
  }
  const orderedNumbers = [...seen].sort((a, b) => a - b)
  if (orderedNumbers.some((number, index) => number !== index + 1)) {
    throw new Error('Assessment item numbering must be contiguous from 1 with no gaps.')
  }
  for (const item of record.items) {
    const canonical = expected.items[item.itemNumber - 1]
    if (!canonical || mappingKey(canonical) !== mappingKey(item)) {
      throw new Error(`Assessment item ${item.itemNumber} no longer matches the finalized TOS mapping.`)
    }
  }
  if (requireFinal) validateAssessmentForFinal(record)
}

export async function loadAssessmentDocuments(userId: string, demo: boolean): Promise<AssessmentRecord[]> {
  if (demo || !supabase) {
    return readDemoAssessments()
      .filter((item) => item.userId === userId && item.status !== 'archived')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  const { data, error } = await supabase
    .from('documents')
    .select('*, assessment_documents:assessment_documents!assessment_documents_document_id_fkey(*, assessment_items(*))')
    .eq('user_id', userId)
    .eq('document_type', 'assessment')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as DbRow[]
  const versions = await versionNumbers(rows.map((row) => text(row.id)))
  return rows
    .map((row) => mapNestedAssessment(row, versions.get(text(row.id)) ?? 0))
    .filter((item): item is AssessmentRecord => Boolean(item))
}

export async function loadAssessmentDocument(id: string, userId: string, demo: boolean): Promise<AssessmentRecord | null> {
  if (demo || !supabase) {
    return readDemoAssessments().find((item) => item.id === id && item.userId === userId) ?? null
  }
  const { data, error } = await supabase
    .from('documents')
    .select('*, assessment_documents:assessment_documents!assessment_documents_document_id_fkey(*, assessment_items(*))')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('document_type', 'assessment')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const versions = await versionNumbers([id])
  return mapNestedAssessment(data as unknown as DbRow, versions.get(id) ?? 0)
}

export async function createAssessmentFromFinalTos(
  tos: TosRecord,
  userId: string,
  demo: boolean,
  title?: string,
  instructions?: string,
): Promise<AssessmentRecord> {
  assertSourceIsFinal(tos)
  const canonicalTos = demo || !supabase ? tos : await canonicalizeFinalTosForProduction(tos)
  const blueprint = createAssessmentBlueprint(canonicalTos, {
    userId,
    title: title?.trim() || undefined,
    instructions: instructions ?? '',
  })
  if (demo || !supabase) {
    assertBlueprintIntegrity(blueprint)
    writeDemoAssessments([...readDemoAssessments().filter((item) => item.id !== blueprint.id), blueprint])
    return blueprint
  }
  // The database allocates the document UUID inside the security-definer RPC;
  // the factory UUID is useful for demo persistence but must not be treated as an
  // existing production row.
  return saveAssessmentDocument({ ...blueprint, id: '' }, false)
}

export async function saveAssessmentDocument(record: AssessmentRecord, demo: boolean): Promise<AssessmentRecord> {
  const normalized = normalizeAssessmentBlueprint(record)
  if (demo || !supabase) {
    const records = readDemoAssessments()
    const existing = records.find((item) => item.id === normalized.id) ?? null
    assertBlueprintIntegrity(normalized, existing, normalized.status === 'final')
    const now = new Date().toISOString()
    const saved: AssessmentRecord = {
      ...clone(normalized),
      versionNumber: (existing?.versionNumber ?? 0) + 1,
      createdAt: existing?.createdAt || normalized.createdAt || now,
      updatedAt: now,
    }
    writeDemoAssessments([...records.filter((item) => item.id !== saved.id), saved])
    return saved
  }
  if (normalized.status === 'archived') throw new Error('Archived assessments cannot be edited.')
  if (normalized.status === 'final') validateAssessmentForFinal(normalized)
  if (!normalized.assignmentId) throw new Error('A teacher-owned assignment is required.')
  if (!normalized.sourceTos.id) throw new Error('The finalized TOS source is required.')
  assertBlueprintIntegrity({ ...normalized, id: normalized.id || 'temp-id' })
  const { data, error } = await supabase.rpc('save_assessment_document', {
    p_document_id: normalized.id || null,
    p_assignment_id: normalized.assignmentId,
    p_source_tos_document_id: normalized.sourceTos.id,
    p_title: normalized.title,
    p_school_year: normalized.schoolYear,
    p_academic_period_label: normalized.gradingTermLabel || null,
    p_instructions: normalized.instructions,
    p_status: normalized.status === 'final' ? 'final' : 'draft',
    p_structured_content: assessmentContentMirror(normalized),
    p_items: normalized.items.map(itemWire),
    p_change_note: normalized.status === 'final' ? 'Teacher finalized assessment' : 'Teacher saved assessment draft',
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as DbRow
  const id = text(row?.id || normalized.id)
  const saved = await loadAssessmentDocument(id, normalized.userId, false)
  if (!saved) throw new Error('Assessment was saved but could not be reloaded.')
  return saved
}

export async function duplicateAssessmentDocument(record: AssessmentRecord, demo: boolean): Promise<AssessmentRecord> {
  const duplicate = duplicateAssessmentBlueprint(record, { userId: record.userId })
  if (demo || !supabase) {
    assertBlueprintIntegrity(duplicate)
    writeDemoAssessments([...readDemoAssessments(), duplicate])
    return duplicate
  }
  const { data, error } = await supabase.rpc('duplicate_assessment_document', {
    p_source_document_id: record.id,
    p_title: duplicate.title,
    p_instructions: duplicate.instructions,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as DbRow
  const id = text(row?.id)
  const saved = await loadAssessmentDocument(id, record.userId, false)
  if (!saved) throw new Error('Assessment was duplicated but could not be reloaded.')
  return saved
}

export async function archiveAssessmentDocument(id: string, userId: string, demo: boolean) {
  if (demo || !supabase) {
    const records = readDemoAssessments()
    const found = records.find((item) => item.id === id && item.userId === userId)
    if (!found) return
    writeDemoAssessments(records.map((item) => item.id === id ? { ...item, status: 'archived', updatedAt: new Date().toISOString() } : item))
    return
  }
  const { error } = await supabase.rpc('archive_assessment_document', { p_document_id: id })
  if (error) throw error
}
