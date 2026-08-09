import type {
  AssessmentAnswer,
  AssessmentAuthorshipState,
  AssessmentItem,
  AssessmentRecord,
  QuestionType,
} from '../types/assessment'

export type AssessmentItemType = QuestionType

export type AssessmentRecordView = AssessmentRecord & {
  sourceTosTitle: string
}

export function normalizeAssessment(record: AssessmentRecord): AssessmentRecordView {
  return {
    ...record,
    title: record.title || 'Untitled assessment',
    instructions: record.instructions || '',
    items: Array.isArray(record.items) ? record.items : [],
    sourceTosTitle: record.sourceTos?.title || 'Finalized TOS',
  }
}

export function itemsForRecord(record: AssessmentRecord): AssessmentItem[] {
  return record.items
}

export function recordWithItems(record: AssessmentRecord, items: AssessmentItem[], status: AssessmentRecord['status'] = record.status, title = record.title, instructions = record.instructions): AssessmentRecord {
  return { ...record, status, title, instructions, items }
}

export function assessmentTitle(record: AssessmentRecord) {
  return record.title || 'Untitled assessment'
}

export function assessmentCompletion(record: AssessmentRecord) {
  const total = Math.max(record.totalItems, record.items.length)
  const filled = record.items.filter((item) => item.prompt.trim()).length
  return { filled, total, percent: total ? Math.round((filled / total) * 100) : 0 }
}

export function mappingLabel(item: AssessmentItem) {
  return [item.competencySnapshot.code, item.competencySnapshot.text].filter(Boolean).join(' · ') || 'TOS mapping preserved'
}

export function mappingDetails(item: AssessmentItem) {
  return [
    item.cognitiveCategorySnapshot.label || item.cognitiveCategorySnapshot.shortLabel,
    item.competencySnapshot.sourcePage === null || item.competencySnapshot.sourcePage === undefined ? '' : `Source p. ${item.competencySnapshot.sourcePage}`,
  ].filter(Boolean).join(' · ') || 'Mapping details preserved in source TOS'
}

export function typeLabel(type: AssessmentItemType) {
  if (type === 'true_false') return 'True / False'
  if (type === 'short_answer') return 'Short answer'
  if (type === 'constructed_response') return 'Constructed response'
  return 'Multiple choice'
}

export function stateLabel(state: AssessmentAuthorshipState) {
  if (state === 'ai_suggestion') return 'AI suggestion'
  if (state === 'teacher_accepted') return 'Accepted'
  if (state === 'teacher_edited') return 'Edited'
  if (state === 'manual') return 'Manual'
  return 'Empty'
}

export function answerForType(type: QuestionType): AssessmentAnswer {
  if (type === 'true_false') return { type, value: false }
  if (type === 'short_answer') return { type, acceptedAnswers: [], caseSensitive: false }
  if (type === 'constructed_response') return { type, expectedResponse: '', sampleResponse: '', rubricGuidance: '' }
  return { type, choices: [], choiceId: '' }
}

export function cloneItem(item: AssessmentItem): AssessmentItem {
  const answer = item.answer.type === 'multiple_choice'
    ? { ...item.answer, choices: item.answer.choices.map((choice) => ({ ...choice })) }
    : item.answer.type === 'short_answer'
      ? { ...item.answer, acceptedAnswers: [...item.answer.acceptedAnswers] }
      : { ...item.answer }
  return {
    ...item,
    competencySnapshot: { ...item.competencySnapshot },
    cognitiveCategorySnapshot: { ...item.cognitiveCategorySnapshot },
    mapping: { ...item.mapping },
    answer,
  }
}

