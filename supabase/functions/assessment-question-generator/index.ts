import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MODEL,
  fallbackAllowed,
  isAiModelId,
  isLiteModel,
  type AiModelId,
  type LiteAiModelId,
} from '../_shared/ai-models.ts'
import { callGemini, GeminiHttpError, isFallbackEligibleStatus } from '../_shared/gemini.ts'

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'constructed_response'
type Outcome = 'success' | 'rejected' | 'error' | 'cancelled'
type RequestBody = {
  assessmentId?: string
  itemId?: string
  questionType?: QuestionType
  alternative?: boolean
  teacherContext?: string
}
type CredentialRow = {
  api_key_ciphertext: string
  api_key_iv: string
  encryption_key_source: EncryptionKeySource
}
type SettingsRow = {
  preferred_model?: string
  fallback_model?: string
  fallback_enabled?: boolean
}
type PreferenceRow = {
  language_preference?: string
  local_language_name?: string
  typical_class_profile?: string
  available_technology?: unknown
  preferred_approaches?: unknown
  actual_resources?: unknown
  resource_notes?: string
}
type DbRow = Record<string, unknown>

const questionTypes = new Set<QuestionType>(['multiple_choice', 'true_false', 'short_answer', 'constructed_response'])
const languageOptions = new Set(['Auto', 'English', 'Filipino', 'English + Filipino', 'Mother tongue / local language'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function asObject(value: unknown): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : {}
}

function onlyKeys(value: DbRow, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function clean(value: unknown, max = 800) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function list(value: unknown, maxItems = 30, maxLength = 180) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^\x60\x60\x60json\s*/i, '').replace(/^\x60\x60\x60\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim()
}

function parseJsonObject(value: string): DbRow {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFence(value))
  } catch {
    throw new Error('The AI response was not valid JSON. Your draft remains unchanged.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The AI response did not match the required structured shape. Your draft remains unchanged.')
  }
  return parsed as DbRow
}

function uniqueKeys(values: string[], caseSensitive = false) {
  const seen = new Set<string>()
  for (const value of values) {
    const key = caseSensitive ? value : value.toLocaleLowerCase('en')
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

function normalizeClaimText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function obviousUnverifiedClaim(value: string, allowedResources: string[]) {
  const normalized = normalizeClaimText(value)
  const allowed = allowedResources.map((resource) => ({ raw: resource.toLocaleLowerCase('en'), normalized: normalizeClaimText(resource) })).filter((resource) => resource.normalized)
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
  if (value && typeof value === 'object') return Object.values(value as DbRow).flatMap(answerStrings)
  return []
}

function validateCandidate(value: DbRow, questionType: QuestionType, teacherResources: string[]) {
  const allowedKeys = new Set(['questionType', 'prompt', 'answer', 'rationale', 'referencedResources'])
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new Error('The AI response included unsupported fields. Your draft remains unchanged.')
  }
  if (value.questionType !== questionType) {
    throw new Error('The AI response changed the verified question type. Your draft remains unchanged.')
  }
  const prompt = clean(value.prompt, 2000)
  const rationale = clean(value.rationale, 1600)
  if (prompt.length < 4 || rationale.length < 4) {
    throw new Error('The AI response needs a non-empty prompt and rationale. Your draft remains unchanged.')
  }
  if (!Array.isArray(value.referencedResources) || value.referencedResources.length > 10) {
    throw new Error('The AI response has an invalid referenced-resources list. Your draft remains unchanged.')
  }
  const referencedResources = value.referencedResources.map((item) => clean(item, 180))
  if (referencedResources.some((item) => !item)) {
    throw new Error('The AI response has a blank referenced resource. Your draft remains unchanged.')
  }
  if (!referencedResources.every((item) => teacherResources.includes(item))) {
    throw new Error('The AI response referenced a resource that the teacher did not list. Your draft remains unchanged.')
  }
  const answer = asObject(value.answer)
  if (answer.type !== questionType) {
    throw new Error('The AI response answer type does not match the verified question type. Your draft remains unchanged.')
  }
  let normalizedAnswer: DbRow
  if (questionType === 'multiple_choice') {
    if (!onlyKeys(answer, ['type', 'choices', 'choiceId'])) {
      throw new Error('The AI response multiple-choice answer shape is invalid. Your draft remains unchanged.')
    }
    const choices = Array.isArray(answer.choices) ? answer.choices.map(asObject) : []
    if (choices.length < 2 || choices.length > 6) {
      throw new Error('Multiple-choice drafts require 2–6 choices. Your draft remains unchanged.')
    }
    const ids = choices.map((item) => clean(item.id, 80))
    const texts = choices.map((item) => clean(item.text, 500))
    if (choices.some((item) => !onlyKeys(item, ['id', 'text']))) {
      throw new Error('The AI response multiple-choice option shape is invalid. Your draft remains unchanged.')
    }
    if (ids.some((item) => !item) || texts.some((item) => !item) || !uniqueKeys(ids) || !uniqueKeys(texts)) {
      throw new Error('Multiple-choice choices must be nonblank and unique. Your draft remains unchanged.')
    }
    const choiceId = clean(answer.choiceId, 80)
    if (!ids.includes(choiceId)) {
      throw new Error('The multiple-choice answer must select one returned choice. Your draft remains unchanged.')
    }
    normalizedAnswer = { type: 'multiple_choice', choices: choices.map((_, index) => ({ id: ids[index], text: texts[index] })), choiceId }
  } else if (questionType === 'true_false') {
    if (!onlyKeys(answer, ['type', 'value'])) {
      throw new Error('The AI response true/false answer shape is invalid. Your draft remains unchanged.')
    }
    if (typeof answer.value !== 'boolean') {
      throw new Error('True/false drafts require a boolean answer. Your draft remains unchanged.')
    }
    normalizedAnswer = { type: 'true_false', value: answer.value }
  } else if (questionType === 'short_answer') {
    if (!onlyKeys(answer, ['type', 'acceptedAnswers', 'caseSensitive'])) {
      throw new Error('The AI response short-answer shape is invalid. Your draft remains unchanged.')
    }
    const accepted = Array.isArray(answer.acceptedAnswers) ? answer.acceptedAnswers.map((item) => clean(item, 500)) : []
    if (!accepted.length || accepted.some((item) => !item) || !uniqueKeys(accepted, answer.caseSensitive === true)) {
      throw new Error('Short-answer drafts require unique nonblank accepted answers. Your draft remains unchanged.')
    }
    if (answer.caseSensitive !== undefined && typeof answer.caseSensitive !== 'boolean') {
      throw new Error('Short-answer case sensitivity is invalid. Your draft remains unchanged.')
    }
    normalizedAnswer = { type: 'short_answer', acceptedAnswers: accepted, caseSensitive: answer.caseSensitive === true }
  } else {
    if (!onlyKeys(answer, ['type', 'expectedResponse', 'sampleResponse', 'rubricGuidance'])) {
      throw new Error('The AI response constructed-response shape is invalid. Your draft remains unchanged.')
    }
    if (clean(answer.expectedResponse, 1200).length < 2 || clean(answer.sampleResponse, 1200).length < 2) {
      throw new Error('Constructed-response drafts require an expected and sample response. Your draft remains unchanged.')
    }
    if (answer.rubricGuidance !== undefined && clean(answer.rubricGuidance, 1200).length < 2) {
      throw new Error('Constructed-response rubric guidance must be meaningful when supplied. Your draft remains unchanged.')
    }
    const rubricGuidance = answer.rubricGuidance === undefined ? '' : clean(answer.rubricGuidance, 1200)
    normalizedAnswer = {
      type: 'constructed_response',
      expectedResponse: clean(answer.expectedResponse, 1200),
      sampleResponse: clean(answer.sampleResponse, 1200),
      ...(rubricGuidance ? { rubricGuidance } : {}),
    }
  }
  if ([prompt, rationale, ...answerStrings(normalizedAnswer)].some((item) => obviousUnverifiedClaim(item, teacherResources))) {
    throw new Error('The AI response included an unverified resource, device, local fact, URL, or page claim. Your draft remains unchanged.')
  }
  return { questionType, prompt, answer: normalizedAnswer, rationale, referencedResources }
}

function resolveSettings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true }
}

function languageInstruction(preference: string, localLanguage: string) {
  const language = languageOptions.has(preference) ? preference : 'Auto'
  if (language === 'English') return 'Write the draft in clear natural English.'
  if (language === 'Filipino') return 'Write the draft in natural Filipino suitable for a Philippine classroom.'
  if (language === 'English + Filipino') return 'Write natural teacher-editable English-Filipino bilingual classroom language.'
  if (language === 'Mother tongue / local language' && localLanguage) return 'Write the draft in ' + localLanguage + '; preserve official terms when no confident translation is available.'
  return 'Match the language of the verified competency and teacher context. Do not translate existing teacher content unexpectedly.'
}

function buildPrompt(
  questionType: QuestionType,
  gradeLevel: string,
  learningArea: string,
  competencyText: string,
  competencyCode: string | null,
  cognitiveLabel: string,
  cognitiveShortLabel: string,
  language: string,
  teacherContext: string,
  preferences: PreferenceRow,
) {
  const resources = list(preferences.actual_resources)
  const approaches = list(preferences.preferred_approaches)
  const technology = list(preferences.available_technology)
  const resourceText = resources.length ? resources.map((item) => '- ' + item).join('\n') : '- none listed'
  return [
    'You are drafting one editable assessment item for a Philippine DepEd teacher. AI may draft content only; the teacher must validate, review, edit, and accept it using professional judgment and curriculum alignment.',
    '',
    'OFFICIAL POLICY BOUNDARY: DepEd Order No. 015, s. 2026 permits teacher use of AI for drafting assessment items/prompts and alternative versions, subject to teacher validation, review, professional judgment, and curriculum alignment. It does not permit AI to replace professional judgment, determine grades, bypass curriculum alignment, or evaluate learners without teacher validation. Protect personal information. Official source: https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf',
    'GOOD PRACTICE / SCHOOL CONVENTION: Use clear language, avoid unnecessary named resources, and follow local school conventions only when the teacher verifies them. These are not additional official DepEd rules.',
    '',
    'VERIFIED MAPPING (FIXED — NEVER CHANGE OR RELABEL):',
    '- Competency: ' + competencyText,
    '- Grade level (server-verified): ' + gradeLevel,
    '- Learning area (server-verified): ' + learningArea,
    '- Curriculum code, only if supplied: ' + (competencyCode || 'none supplied'),
    '- Cognitive category: ' + cognitiveLabel + ' (' + cognitiveShortLabel + ')',
    '- Question type: ' + questionType,
    '',
    language,
    'Teacher context (bounded; do not repeat personal data): ' + (teacherContext || 'none supplied'),
    'Teacher-listed actual resources (you may mention only these, and only if useful):',
    resourceText,
    'Teacher-preferred approaches: ' + (approaches.length ? approaches.join('; ') : 'none listed'),
    'Technology availability is feasibility context only: ' + (technology.length ? technology.join('; ') : 'none listed'),
    '',
    'Do not invent curriculum codes, standards, citations, textbook/module/page/site/device/app/worksheet/school materials, local facts, or learner details. Do not include learner PII. Do not unexpectedly translate supplied teacher content. Keep the verified competency and cognitive category fixed and reviewable; do not make grading decisions.',
    '',
    'Return JSON only, with exactly these top-level keys: questionType, prompt, answer, rationale, referencedResources. questionType must be "' + questionType + '". referencedResources must be an array containing only exact strings from the teacher-listed resource list, or an empty array.',
    'Answer shape must be exact:',
    '- multiple_choice: answer={"type":"multiple_choice","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."}],"choiceId":"A"}; include 2–6 unique nonblank choices and select one choiceId.',
    '- true_false: answer={"type":"true_false","value":true} or false.',
    '- short_answer: answer={"type":"short_answer","acceptedAnswers":["..."],"caseSensitive":false}; include unique accepted answers.',
    '- constructed_response: answer={"type":"constructed_response","expectedResponse":"...","sampleResponse":"...","rubricGuidance":"..."}; sampleResponse is a teacher-reviewable example, not a learner result.',
    'The rationale must explain alignment for teacher review, not claim official approval.',
  ].join('\n')
}

async function callWithFallback(apiKey: string, settings: ReturnType<typeof resolveSettings>, prompt: string) {
  let modelUsed: AiModelId = settings.preferredModel
  let fallbackUsed = false
  try {
    const output = await callGemini(apiKey, settings.preferredModel, prompt, { maxOutputTokens: 1800, temperature: 0.25 })
    return { output, modelUsed, fallbackUsed }
  } catch (error) {
    if (!(error instanceof GeminiHttpError) || !isFallbackEligibleStatus(error.status) || !fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)) throw error
    modelUsed = settings.fallbackModel
    fallbackUsed = true
    const output = await callGemini(apiKey, settings.fallbackModel, prompt, { maxOutputTokens: 1800, temperature: 0.25 })
    return { output, modelUsed, fallbackUsed }
  }
}

type AuditPayload = {
  userId: string
  assessmentId: string
  itemId: string
  questionType: QuestionType
  alternative: boolean
  model: string
  fallbackUsed: boolean
  outcome: Outcome
}

async function audit(admin: ReturnType<typeof createClient>, payload: AuditPayload) {
  try {
    await admin.from('assessment_ai_audit_events').insert({
      user_id: payload.userId,
      assessment_document_id: payload.assessmentId,
      assessment_item_id: payload.itemId,
      question_type: payload.questionType,
      alternative: payload.alternative,
      provider: 'google',
      model: payload.model,
      fallback_used: payload.fallbackUsed,
      outcome: payload.outcome,
    })
  } catch {
    // Audit failure must never expose a key or alter the teacher's draft result.
  }
}

function errorMessage(error: unknown) {
  if (error instanceof GeminiHttpError) {
    if (error.status === 429) return 'Gemini quota is currently unavailable. Your assessment draft remains unchanged; try again later or use the configured Lite fallback.'
    if (error.status === 401 || error.status === 403) return 'The saved Gemini credential was rejected. Your assessment draft remains unchanged.'
  }
  if (error instanceof Error && error.message.includes('Your draft remains unchanged')) return error.message
  return 'Assessment drafting could not be completed. Your assessment draft remains unchanged.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  let auditPayload: AuditPayload | null = null
  let candidateValidationStarted = false
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase function environment is incomplete.' }, 500)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)
    const userId = userData.user.id
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json() as RequestBody
    const keys = Object.keys(body ?? {})
    if (keys.some((key) => !['assessmentId', 'itemId', 'questionType', 'alternative', 'teacherContext'].includes(key))) return json({ error: 'Only assessment, item, question-type, alternative, and bounded teacher context are accepted.' }, 400)
    const assessmentId = clean(body.assessmentId, 80)
    const itemId = clean(body.itemId, 80)
    const requestedType = body.questionType
    const alternative = body.alternative === true
    const teacherContext = clean(body.teacherContext, 1200)
    if (!uuidPattern.test(assessmentId) || !uuidPattern.test(itemId) || !requestedType || !questionTypes.has(requestedType)) return json({ error: 'A valid assessment, item, and question type are required.' }, 400)
    const [assessmentResult, metadataResult, itemResult, preferencesResult, settingsResult, credentialResult] = await Promise.all([
      admin.from('documents').select('id, user_id, assignment_id, status, document_type, structured_content').eq('id', assessmentId).eq('user_id', userId).eq('document_type', 'assessment').maybeSingle(),
      admin.from('assessment_documents').select('*').eq('document_id', assessmentId).eq('user_id', userId).maybeSingle(),
      admin.from('assessment_items').select('*').eq('assessment_document_id', assessmentId).eq('id', itemId).maybeSingle(),
      admin.from('teacher_lesson_preferences').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_settings').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userId).maybeSingle(),
    ])
    if (assessmentResult.error) throw assessmentResult.error
    if (metadataResult.error) throw metadataResult.error
    if (itemResult.error) throw itemResult.error
    if (preferencesResult.error) throw preferencesResult.error
    if (settingsResult.error) throw settingsResult.error
    if (credentialResult.error) throw credentialResult.error
    if (!assessmentResult.data || !metadataResult.data || !itemResult.data) return json({ error: 'The assessment item could not be found for this teacher.' }, 404)
    if (assessmentResult.data.status !== 'draft') return json({ error: 'Only draft assessment items can receive editable AI suggestions.' }, 409)
    const item = itemResult.data as DbRow
    const metadata = metadataResult.data as DbRow
    const serverQuestionType = String(item.question_type) as QuestionType
    if (serverQuestionType !== requestedType) return json({ error: 'The requested question type does not match the saved item mapping.' }, 409)
    if (!alternative && String(item.authorship_state) !== 'empty') return json({ error: 'This item already has content. Request an explicit alternative to preserve the existing draft.' }, 409)
    const sourceId = String(metadata.source_tos_document_id)
    const [sourceResult, tosRowsResult, competencyResult] = await Promise.all([
      admin.from('documents').select('id, user_id, assignment_id, status, document_type, structured_content').eq('id', sourceId).eq('user_id', userId).eq('document_type', 'tos').maybeSingle(),
      admin.from('tos_competencies').select('*').eq('document_id', sourceId).order('row_order', { ascending: true }),
      admin.from('curriculum_competencies').select('id, competency_code, competency_text, source_page, academic_period_id, verification_status').eq('id', String(item.canonical_competency_id)).maybeSingle(),
    ])
    if (sourceResult.error) throw sourceResult.error
    if (tosRowsResult.error) throw tosRowsResult.error
    if (competencyResult.error) throw competencyResult.error
    const source = sourceResult.data as DbRow | null
    const canonical = competencyResult.data as DbRow | null
    if (!source || !canonical || !['final', 'archived'].includes(String(source.status)) || String(source.assignment_id) !== String(metadata.assignment_id)) return json({ error: 'The finalized TOS source is unavailable for this draft.' }, 409)
    if (String(canonical.verification_status) !== 'verified' || String(canonical.competency_text) !== String(item.competency_text_snapshot) || String(canonical.competency_code ?? '') !== String(item.competency_code_snapshot ?? '')) return json({ error: 'The saved competency mapping is no longer a verified canonical record.' }, 409)
    const tosRows = (tosRowsResult.data ?? []) as unknown as DbRow[]
    const mappedRow = tosRows.find((row) => String(row.row_id) === String(item.tos_row_id) && String(row.competency_id) === String(item.canonical_competency_id) && Number(item.item_number) >= Number(row.item_start) && Number(item.item_number) <= Number(row.item_end))
    if (!mappedRow) return json({ error: 'The saved item mapping no longer matches the finalized TOS range.' }, 409)
    const allocations = Array.isArray(mappedRow.cognitive_allocations) ? mappedRow.cognitive_allocations.map(asObject) : []
    const allocation = allocations.find((value) => String(value.categoryId) === String(item.cognitive_category_id) && Number(value.itemStart) === Number(item.allocation_item_start) && Number(value.itemEnd) === Number(item.allocation_item_end) && Number(item.item_number) === Number(item.allocation_item_start) + Number(item.allocation_index))
    if (!allocation || String(allocation.label) !== String(item.cognitive_category_label_snapshot)) return json({ error: 'The saved cognitive mapping no longer matches the finalized TOS allocation.' }, 409)
    const sourceContent = asObject(metadata.source_tos_content_snapshot)
    const sourceRows = Array.isArray(sourceContent.rows) ? sourceContent.rows.map(asObject) : []
    const sourceTosRow = sourceRows.find((row) => String(row.id) === String(item.tos_row_id))
    const sourceCompetency = sourceTosRow ? asObject(sourceTosRow.competency) : {}
    if (String(sourceCompetency.id) !== String(item.canonical_competency_id) || String(sourceCompetency.text) !== String(item.competency_text_snapshot)) return json({ error: 'The server source snapshot does not match the saved item mapping.' }, 409)
    const preference = (preferencesResult.data ?? {}) as PreferenceRow
    const resources = list(preference.actual_resources)
    const language = languageInstruction(clean(preference.language_preference, 80) || 'Auto', clean(preference.local_language_name, 100))
    const prompt = buildPrompt(serverQuestionType, clean(sourceContent.gradeLevel, 80), clean(sourceContent.learningArea, 120), String(item.competency_text_snapshot), item.competency_code_snapshot ? String(item.competency_code_snapshot) : null, String(item.cognitive_category_label_snapshot), clean(item.cognitive_category_short_label_snapshot, 40), language, teacherContext, preference)
    const credential = credentialResult.data as CredentialRow | null
    if (!credential) return json({ error: 'Connect a Gemini API key in AI settings before drafting assessment items.' }, 400)
    const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null)
    const apiKey = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)
    auditPayload = { userId, assessmentId, itemId, questionType: serverQuestionType, alternative, model: settings.preferredModel, fallbackUsed: false, outcome: 'error' }
    const generated = await callWithFallback(apiKey, settings, prompt)
    auditPayload.model = generated.modelUsed
    auditPayload.fallbackUsed = generated.fallbackUsed
    candidateValidationStarted = true
    const parsed = parseJsonObject(generated.output)
    const candidate = validateCandidate(parsed, serverQuestionType, resources)
    auditPayload.outcome = 'success'
    await audit(admin, auditPayload)
    return json({ assessmentId, itemId, questionType: serverQuestionType, candidate, approvedResources: resources, model: generated.modelUsed, fallbackUsed: generated.fallbackUsed, editable: true })
  } catch (error) {
    if (auditPayload) {
      auditPayload.outcome = candidateValidationStarted ? 'rejected' : 'error'
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceRole) {
        const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
        await audit(admin, auditPayload)
      }
    }
    return json({ error: errorMessage(error) }, error instanceof GeminiHttpError && error.status === 429 ? 429 : 400)
  }
})
