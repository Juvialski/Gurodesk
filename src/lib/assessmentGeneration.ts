import type {
  AssessmentAnswer,
  AssessmentItem,
  AssessmentRecord,
  QuestionType,
} from '../types/assessment'
import { validateAssessmentFinal } from './assessmentValidation'
import { supabase } from './supabase'

export type AssessmentItemCandidate = {
  questionType: QuestionType
  prompt: string
  answer: AssessmentAnswer
  rationale: string
  referencedResources: string[]
}

export type AssessmentItemSuggestion = {
  assessmentId: string
  itemId: string
  questionType: QuestionType
  candidate: AssessmentItemCandidate
  /** Server-owned allowlist used to validate candidate resource references. */
  approvedResources?: string[]
  model: string
  fallbackUsed: boolean
  editable: true
}

export type AssessmentGenerationBatchSummary = {
  attempted: number
  succeeded: number
  skipped: number
  failed: number
  cancelled: number
  results: AssessmentItem[]
  errors: Array<{ itemId: string; message: string }>
}

export type AssessmentGenerationBatchOptions = {
  assessment: AssessmentRecord
  demo: boolean
  onItem?: (item: AssessmentItem) => void | Promise<void>
  onProgress?: (progress: { completed: number; total: number; itemId: string; status: 'success' | 'failed' | 'skipped' | 'cancelled' }) => void
  signal?: AbortSignal
  concurrency?: number
  /** Optional deterministic hook for tests/offline hosts; production callers omit it. */
  generate?: (args: { assessment: AssessmentRecord; item: AssessmentItem; demo: boolean; signal?: AbortSignal }) => Promise<AssessmentItemSuggestion>
}

type CandidateInput = Record<string, unknown>

const questionTypes = new Set<QuestionType>(['multiple_choice', 'true_false', 'short_answer', 'constructed_response'])

function clean(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function asObject(value: unknown): CandidateInput {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as CandidateInput : {}
}

function onlyKeys(value: CandidateInput, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function unique(values: string[], caseSensitive = false) {
  const seen = new Set<string>()
  for (const value of values) {
    const key = caseSensitive ? value : value.toLocaleLowerCase('en')
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^\x60\x60\x60json\s*/i, '').replace(/^\x60\x60\x60\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim()
}

function parseJsonObject(value: string): CandidateInput {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFence(value))
  } catch {
    throw new Error('The AI response was not valid JSON. Your assessment draft remains unchanged.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The AI response did not match the required object shape. Your assessment draft remains unchanged.')
  }
  return parsed as CandidateInput
}

function normalizeClaimText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function resourceClaimLooksUnverified(value: string, teacherResources: string[]) {
  const normalized = normalizeClaimText(value)
  const allowed = teacherResources.map((resource) => ({ raw: resource.toLocaleLowerCase('en'), normalized: normalizeClaimText(resource) })).filter((resource) => resource.normalized)
  const urlClaims = value.match(/(?:https?:\/\/|www\.)[^\s)\],]+/gi) ?? []
  if (urlClaims.some((claim) => !allowed.some((resource) => resource.raw.includes(claim.toLocaleLowerCase('en'))))) return true
  const pageClaims = value.match(/(?:\bpage\b|\bp\.|\bpahina\b)\s*\d+/gi) ?? []
  if (pageClaims.some((claim) => !allowed.some((resource) => resource.normalized.includes(normalizeClaimText(claim))))) return true
  const namedResourceOrLocalFact = /\b(?:textbook|module|worksheet|website|handout|reference|activity\s+sheet|learning\s+material|mobile\s+app|app|software|device|tablet|computer|laptop|projector|aklat|modyul|sanggunian|activity\s+sheet|kagamitang\s+pampagkatuto|aplikasyon|kompyuter|barangay|municipality|province)\b/iu
  return namedResourceOrLocalFact.test(value) && !allowed.some((resource) => normalized.includes(resource.normalized))
}

function answerStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(answerStrings)
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(answerStrings)
  return []
}

export function validateAssessmentCandidate(
  value: unknown,
  questionType?: QuestionType,
  teacherResources: string[] = [],
): AssessmentItemCandidate {
  const object = typeof value === 'string' ? parseJsonObject(value) : asObject(value)
  const allowedKeys = new Set(['questionType', 'prompt', 'answer', 'rationale', 'referencedResources'])
  if (Object.keys(object).some((key) => !allowedKeys.has(key))) {
    throw new Error('The AI candidate included unsupported fields; item mapping was not changed.')
  }
  const candidateType = object.questionType
  if (!questionTypes.has(candidateType as QuestionType) || (questionType && candidateType !== questionType)) {
    throw new Error('The AI candidate question type does not match the verified item mapping.')
  }
  const resolvedType = candidateType as QuestionType
  const prompt = clean(object.prompt)
  const rationale = clean(object.rationale, 1600)
  if (prompt.length < 4 || rationale.length < 4) throw new Error('The AI candidate needs a non-empty prompt and rationale.')
  if (!Array.isArray(object.referencedResources) || object.referencedResources.length > 10) throw new Error('The AI candidate resource list is invalid.')
  const referencedResources = object.referencedResources.map((item) => clean(item, 180))
  if (referencedResources.some((item) => !item)) throw new Error('The AI candidate has a blank referenced resource.')
  if (!referencedResources.every((item) => teacherResources.includes(item))) throw new Error('The AI candidate referenced an unlisted teacher resource.')
  const answer = asObject(object.answer)
  if (answer.type !== resolvedType) throw new Error('The AI candidate answer type does not match the item type.')
  let normalizedAnswer: AssessmentAnswer
  if (resolvedType === 'multiple_choice') {
    if (!onlyKeys(answer, ['type', 'choices', 'choiceId'])) throw new Error('Multiple-choice answer shape is invalid.')
    const choices = Array.isArray(answer.choices) ? answer.choices.map(asObject) : []
    const ids = choices.map((choice) => clean(choice.id, 80))
    const texts = choices.map((choice) => clean(choice.text, 500))
    if (choices.some((choice) => !onlyKeys(choice, ['id', 'text']))) throw new Error('Multiple-choice option shape is invalid.')
    if (choices.length < 2 || choices.length > 6 || ids.some((id) => !id) || texts.some((text) => !text) || !unique(ids) || !unique(texts)) throw new Error('Multiple-choice choices must be 2–6 nonblank unique choices.')
    const choiceId = clean(answer.choiceId, 80)
    if (!ids.includes(choiceId)) throw new Error('Multiple-choice answer must select one returned choice.')
    normalizedAnswer = { type: 'multiple_choice', choices: choices.map((choice, index) => ({ id: ids[index], text: texts[index] })), choiceId }
  } else if (resolvedType === 'true_false') {
    if (!onlyKeys(answer, ['type', 'value'])) throw new Error('True/false answer shape is invalid.')
    if (typeof answer.value !== 'boolean') throw new Error('True/false answer must be boolean.')
    normalizedAnswer = { type: 'true_false', value: answer.value }
  } else if (resolvedType === 'short_answer') {
    if (!onlyKeys(answer, ['type', 'acceptedAnswers', 'caseSensitive'])) throw new Error('Short-answer answer shape is invalid.')
    const acceptedAnswers = Array.isArray(answer.acceptedAnswers) ? answer.acceptedAnswers.map((item) => clean(item, 500)) : []
    const caseSensitive = answer.caseSensitive === true
    if (answer.caseSensitive !== undefined && typeof answer.caseSensitive !== 'boolean') throw new Error('Short-answer case sensitivity is invalid.')
    if (!acceptedAnswers.length || acceptedAnswers.some((item) => !item) || !unique(acceptedAnswers, caseSensitive)) throw new Error('Short-answer accepted answers must be unique and nonblank.')
    normalizedAnswer = { type: 'short_answer', acceptedAnswers, caseSensitive }
  } else {
    if (!onlyKeys(answer, ['type', 'expectedResponse', 'sampleResponse', 'rubricGuidance'])) throw new Error('Constructed-response answer shape is invalid.')
    const expectedResponse = clean(answer.expectedResponse, 1200)
    const sampleResponse = clean(answer.sampleResponse, 1200)
    if (expectedResponse.length < 2 || sampleResponse.length < 2) throw new Error('Constructed response requires expected and sample responses.')
    const rubricGuidance = answer.rubricGuidance === undefined ? undefined : clean(answer.rubricGuidance, 1200)
    if (answer.rubricGuidance !== undefined && rubricGuidance!.length < 2) throw new Error('Constructed-response rubric guidance is too short.')
    normalizedAnswer = { type: 'constructed_response', expectedResponse, sampleResponse, ...(rubricGuidance ? { rubricGuidance } : {}) }
  }
  if ([prompt, rationale, ...answerStrings(normalizedAnswer)].some((item) => resourceClaimLooksUnverified(item, teacherResources))) {
    throw new Error('The AI candidate included an unverified resource, device, local fact, URL, or page claim.')
  }
  return { questionType: resolvedType, prompt, answer: normalizedAnswer, rationale, referencedResources }
}

export const parseAssessmentCandidate = validateAssessmentCandidate
export const parseAndValidateAssessmentCandidate = validateAssessmentCandidate

export function validateAssessmentForFinal(assessment: AssessmentRecord) {
  const result = validateAssessmentFinal({ ...assessment, status: 'final' })
  if (!result.ready) {
    const first = result.errors[0]
    const itemLabel = first?.itemNumber ? ` (item ${first.itemNumber})` : ''
    throw new Error(`${first?.message ?? 'Assessment final validation failed.'}${itemLabel}`)
  }
  return assessment
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function hasExistingContent(item: AssessmentItem) {
  if (item.authorshipState !== 'empty' || item.prompt.trim().length > 0) return true
  if ((item.rationale ?? '').trim() || (item.teacherNotes ?? '').trim()) return true
  if (item.answer.type === 'multiple_choice') return item.answer.choices.length > 0 || item.answer.choiceId.trim().length > 0
  if (item.answer.type === 'short_answer') return item.answer.acceptedAnswers.length > 0
  if (item.answer.type === 'constructed_response') return Boolean(item.answer.expectedResponse.trim() || item.answer.sampleResponse.trim() || item.answer.rubricGuidance?.trim())
  // The factory uses false as the empty true/false placeholder; a teacher's
  // true value is therefore the only unambiguous answer content while state is
  // still `empty`. Normal editor saves should set authorshipState when changing
  // either boolean value.
  return item.answer.value === true
}

export function applyAssessmentItemCandidate(
  item: AssessmentItem,
  candidate: AssessmentItemCandidate,
  options: { alternative?: boolean; teacherResources?: string[] } = {},
): AssessmentItem {
  if (hasExistingContent(item) && options.alternative !== true) throw new Error('Existing item content is protected; request an explicit alternative before replacing it.')
  if (candidate.referencedResources.length > 0 && options.teacherResources === undefined) {
    throw new Error('Referenced resources require a server-approved teacher resource list; item mapping was not changed.')
  }
  const validated = validateAssessmentCandidate(candidate, item.questionType, options.teacherResources ?? [])
  return {
    ...clone(item),
    prompt: validated.prompt,
    answer: clone(validated.answer),
    rationale: validated.rationale,
    authorshipState: 'ai_suggestion',
  }
}

function demoCandidate(item: AssessmentItem): AssessmentItemCandidate {
  const competency = item.competencySnapshot.text || 'the verified competency'
  const cognitive = item.cognitiveCategorySnapshot.label || 'the verified cognitive category'
  const prefix = 'Teacher-review draft for ' + competency + ' (' + cognitive + ').'
  if (item.questionType === 'true_false') {
    return { questionType: 'true_false', prompt: prefix + ' Decide whether the statement is accurate after checking the lesson content.', answer: { type: 'true_false', value: true }, rationale: 'Demo-local preview only; the teacher must verify the statement and answer against the finalized TOS mapping.', referencedResources: [] }
  }
  if (item.questionType === 'short_answer') {
    return { questionType: 'short_answer', prompt: prefix + ' State one accurate response in your own words.', answer: { type: 'short_answer', acceptedAnswers: ['Teacher-verified response'], caseSensitive: false }, rationale: 'Demo-local preview only; replace the placeholder with a teacher-verified expected answer.', referencedResources: [] }
  }
  if (item.questionType === 'constructed_response') {
    return { questionType: 'constructed_response', prompt: prefix + ' Explain your reasoning and show the key evidence.', answer: { type: 'constructed_response', expectedResponse: 'Teacher-verified expected response.', sampleResponse: 'Teacher-verified sample response.', rubricGuidance: 'Teacher-verified criteria for alignment, reasoning, and evidence.' }, rationale: 'Demo-local preview only; the teacher must replace placeholders and validate the response criteria.', referencedResources: [] }
  }
  return { questionType: 'multiple_choice', prompt: prefix + ' Which option best demonstrates the verified competency?', answer: { type: 'multiple_choice', choices: [{ id: 'A', text: 'Teacher-verified option A' }, { id: 'B', text: 'Teacher-verified option B' }], choiceId: 'A' }, rationale: 'Demo-local preview only; the teacher must replace placeholders and verify the answer.', referencedResources: [] }
}

export async function generateAssessmentItemSuggestion(args: {
  assessment: AssessmentRecord
  item: AssessmentItem
  demo: boolean
  alternative?: boolean
  teacherContext?: string
  signal?: AbortSignal
}): Promise<AssessmentItemSuggestion> {
  const { assessment, item, demo, alternative = false, teacherContext = '', signal } = args
  if (signal?.aborted) throw new DOMException('Generation cancelled.', 'AbortError')
  if (hasExistingContent(item) && !alternative) throw new Error('Existing item content is protected; request an explicit alternative before replacing it.')
  if (demo || !supabase) {
    const candidate = validateAssessmentCandidate(demoCandidate(item), item.questionType)
    return { assessmentId: assessment.id, itemId: item.id, questionType: item.questionType, candidate, approvedResources: [], model: 'demo-local-preview', fallbackUsed: false, editable: true }
  }
  const boundedContext = clean(teacherContext, 1200)
  const { data, error } = await supabase.functions.invoke('assessment-question-generator', {
    body: { assessmentId: assessment.id, itemId: item.id, questionType: item.questionType, alternative, ...(boundedContext ? { teacherContext: boundedContext } : {}) },
    signal,
  })
  if (error) throw new Error(error.message || 'Assessment drafting could not be completed; your draft remains unchanged.')
  if (data?.error) throw new Error(String(data.error))
  const rawCandidate = asObject(data?.candidate)
  const candidateResources = Array.isArray(data?.approvedResources)
    ? data.approvedResources.map((value: unknown) => clean(value, 180))
    : []
  if (Array.isArray(rawCandidate.referencedResources) && rawCandidate.referencedResources.length > 0 && candidateResources.length === 0) {
    throw new Error('The AI response did not include a server-approved teacher resource list; your draft remains unchanged.')
  }
  const candidate = validateAssessmentCandidate(rawCandidate, item.questionType, candidateResources)
  return { assessmentId: assessment.id, itemId: item.id, questionType: item.questionType, candidate, approvedResources: candidateResources, model: String(data?.model || 'unknown'), fallbackUsed: data?.fallbackUsed === true, editable: true }
}

function transient(error: unknown) {
  const status = Number((error as { status?: unknown })?.status)
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  const message = String((error as { message?: unknown })?.message ?? error).toLocaleLowerCase('en')
  return /timeout|temporar|network|quota|rate.?limit|try again|gateway/.test(message)
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Generation cancelled.', 'AbortError')); return }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Generation cancelled.', 'AbortError')) }, { once: true })
  })
}

export async function generateMissingAssessmentItems(options: AssessmentGenerationBatchOptions): Promise<AssessmentGenerationBatchSummary> {
  const { assessment, demo, onItem, onProgress, signal } = options
  const generate = options.generate ?? generateAssessmentItemSuggestion
  const concurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency ?? 2)))
  const eligible = assessment.items.filter((item) => !hasExistingContent(item))
  const summary: AssessmentGenerationBatchSummary = { attempted: 0, succeeded: 0, skipped: assessment.items.length - eligible.length, failed: 0, cancelled: 0, results: [], errors: [] }
  let cursor = 0
  let completed = 0
  const total = assessment.items.length
  const progress = (itemId: string, status: 'success' | 'failed' | 'skipped' | 'cancelled') => {
    completed += 1
    onProgress?.({ completed, total, itemId, status })
  }
  for (const item of assessment.items.filter((candidate) => hasExistingContent(candidate))) progress(item.id, 'skipped')
  const worker = async () => {
    while (true) {
      if (signal?.aborted) return
      const index = cursor
      cursor += 1
      if (index >= eligible.length) return
      const item = eligible[index]
      summary.attempted += 1
      let lastError: unknown = null
      let succeeded = false
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (signal?.aborted) break
        try {
          const suggestion = await generate({ assessment, item, demo, signal })
          const applied = applyAssessmentItemCandidate(item, suggestion.candidate, { teacherResources: suggestion.approvedResources ?? [] })
          summary.results.push(applied)
          summary.succeeded += 1
          await onItem?.(applied)
          progress(item.id, 'success')
          lastError = null
          succeeded = true
          break
        } catch (error) {
          lastError = error
          if (signal?.aborted || !transient(error) || attempt >= 3) break
          try { await delay(150 * attempt, signal) } catch { break }
        }
      }
      if (!succeeded && signal?.aborted && !lastError) {
        summary.cancelled += 1
        progress(item.id, 'cancelled')
      } else if (lastError) {
        if (signal?.aborted) { summary.cancelled += 1; progress(item.id, 'cancelled') }
        else { summary.failed += 1; summary.errors.push({ itemId: item.id, message: String((lastError as { message?: unknown })?.message ?? lastError) }); progress(item.id, 'failed') }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  if (signal?.aborted) {
    const firstUnstarted = Math.min(cursor, eligible.length)
    const unstarted = eligible.slice(firstUnstarted)
    summary.cancelled += unstarted.length
    for (const item of unstarted) progress(item.id, 'cancelled')
  }
  return summary
}
