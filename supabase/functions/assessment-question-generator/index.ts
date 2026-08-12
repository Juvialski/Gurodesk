import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, fallbackAllowed, isAiModelId, isLiteModel, type AiModelId, type LiteAiModelId, type AssessmentQuestionType, type GeminiSchema, verifierResponseSchema } from '../_shared/ai-models.ts'
import { AssessmentContractError, validateAssessmentCandidate as validateAssessmentCandidateContract, type ImmutableAssessmentContext } from '../_shared/assessment-contract.ts'
import { callGemini, GeminiHttpError, GeminiResponseError, isFallbackEligibleStatus, parseGeminiJson } from '../_shared/gemini.ts'
import { validateAssessmentVisual } from '../_shared/assessment-visual.ts'
import { validateAssessmentTikzSource } from '../_shared/tikz-safety.ts'

type QuestionType = AssessmentQuestionType
type Operation = 'generate' | 'verify' | 'repair' | 'visual'
type Row = Record<string, unknown>
type RequestBody = { operation?: Operation; assessmentId?: string; itemId?: string; questionType?: QuestionType; alternative?: boolean; teacherContext?: string; candidate?: unknown; issues?: unknown; repairGuidance?: unknown; generatorModel?: string; visualIntent?: string }
type CredentialRow = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }
type SettingsRow = { preferred_model?: string; fallback_model?: string; fallback_enabled?: boolean }
type PreferenceRow = { language_preference?: string; local_language_name?: string; preferred_approaches?: unknown; actual_resources?: unknown; available_technology?: unknown }

const QUESTION_TYPES = new Set<QuestionType>(['multiple_choice', 'true_false', 'short_answer', 'constructed_response', 'identification', 'fill_in_the_blank', 'numerical_answer', 'problem_solving', 'matching', 'multiple_select', 'essay'])
const LANGUAGE_OPTIONS = new Set(['Auto', 'English', 'Filipino', 'English + Filipino', 'Mother tongue / local language'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
function object(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {} }
function clean(value: unknown, max = 2000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function list(value: unknown, maxItems = 30, maxLength = 500) { return Array.isArray(value) ? value.map((entry) => clean(entry, maxLength)).filter(Boolean).slice(0, maxItems) : [] }
function parseJson(value: string): Row { return parseGeminiJson(value) }
function onlyKeys(value: Row, keys: string[]) { return Object.keys(value).every((key) => keys.includes(key)) }
function stableValue(value: unknown): unknown { if (Array.isArray(value)) return value.map(stableValue); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.entries(value as Row).sort(([left], [right]) => left.localeCompare(right, 'en')).map(([key, entry]) => [key, stableValue(entry)])) }
function stableJson(value: unknown) { return JSON.stringify(stableValue(value)) }
function savedAnswerForVisual(value: unknown) { const answer = { ...object(value) }; delete answer._visual; delete answer._visualPlan; return answer }
function savedVisualPlan(value: unknown) { const plan = object(object(value)._visualPlan); const requirement = ['none', 'helpful', 'required'].includes(String(plan.requirement)) ? String(plan.requirement) : 'none'; return { requirement, intent: clean(plan.intent, 500) } }
function promptDependsOnVisual(value: unknown) { return /\b(?:use|using|refer\s+to|from|shown|provided|given|displayed|illustrated|following)\b[^.!?]{0,80}\b(?:diagram|figure|graph|number\s+line|table|visual)\b|\b(?:diagram|figure|graph|number\s+line|table|visual)\b[^.!?]{0,60}\b(?:shows|illustrates|depicts|given|provided)\b/iu.test(clean(value, 4000)) }
const QUESTION_PROVIDER_KEYS = ['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visualRequirement', 'visualIntent', 'visual'] as const
const REQUIRED_QUESTION_PROVIDER_KEYS = ['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visualRequirement', 'visualIntent'] as const

/**
 * Gemini occasionally appends harmless explanatory envelope fields despite an
 * exact-keys prompt. Once every canonical field is present, project only the
 * known top-level envelope. Nested answer fields still go through the full
 * strict per-type contract and are never dropped or guessed here.
 */
function canonicalQuestionProviderEnvelope(value: Row) {
  if (!REQUIRED_QUESTION_PROVIDER_KEYS.every((key) => Object.prototype.hasOwnProperty.call(value, key))) return value
  return Object.fromEntries(QUESTION_PROVIDER_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(value, key)).map((key) => [key, value[key]]))
}

function validateCandidate(value: unknown, questionType: QuestionType, resources: string[], rationaleRequired = true, immutableContext?: ImmutableAssessmentContext) {
  // The shared Edge-safe contract is authoritative for every live path.
  return validateAssessmentCandidateContract(value, questionType, resources, rationaleRequired, immutableContext)
}

function resolveSettings(row: SettingsRow | null) { const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL; const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL; return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true } }
function languageInstruction(preference: string, localLanguage: string) { const language = LANGUAGE_OPTIONS.has(preference) ? preference : 'Auto'; if (language === 'English') return 'Write in clear natural English.'; if (language === 'Filipino') return 'Write in natural Filipino suitable for a Philippine classroom.'; if (language === 'English + Filipino') return 'Write natural teacher-editable English-Filipino bilingual classroom language.'; if (language === 'Mother tongue / local language' && localLanguage) return `Write in ${localLanguage}; preserve official terms when needed.`; return 'Match the verified competency language without silently translating supplied teacher content.' }
function rawAnswerShapeInstruction(type: QuestionType) {
  if (type === 'multiple_choice') return 'answer must be {"type":"multiple_choice","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"choiceId":"A"}. Use 3–5 plausible unique choices and exactly one correct choiceId.'
  if (type === 'true_false') return 'answer must be exactly {"type":"true_false","value":true} or the same with false.'
  if (type === 'short_answer') return 'answer must be {"type":"short_answer","acceptedAnswers":["..."],"caseSensitive":false}. Include every clearly equivalent concise answer that should be accepted.'
  if (type === 'identification') return 'answer must be {"type":"identification","acceptedAnswers":["..."],"caseSensitive":false}. Keep the prompt suitable for identifying one term/name/concept.'
  if (type === 'fill_in_the_blank') return 'answer must be {"type":"fill_in_the_blank","blanks":[{"id":"blank-1","acceptedAnswers":["..."]}]}. The prompt must visibly mark each blank using a readable token such as _____ or [blank]. Every blank needs one or more genuinely distinct accepted answers; do not repeat capitalization-only or punctuation-only variants. Omit per-blank points unless every blank has an explicit positive value summing exactly to the fixed item points.'
  if (type === 'numerical_answer') return 'answer must be {"type":"numerical_answer","value":12,"tolerance":0,"unit":"cm","requireUnit":true}. value and tolerance must be finite JSON numbers; omit unit/requireUnit when no unit is needed.'
  if (type === 'problem_solving') return 'answer must be {"type":"problem_solving","finalAnswer":"...","solutionOutline":"..."}. Include optional subparts only when the fixed point value justifies multiple scored steps.'
  if (type === 'matching') return 'answer must be {"type":"matching","prompts":[{"id":"p1","text":"..."}],"choices":[{"id":"A","text":"..."}],"mappings":[{"promptId":"p1","choiceId":"A"}],"reusableChoices":false}. Include at least two prompts and enough unique choices; extra distractor choices are allowed.'
  if (type === 'multiple_select') return 'answer must be {"type":"multiple_select","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."}],"choiceIds":["A","C"],"scoringPolicy":"all_or_nothing"}. Include at least one correct choice and at least one incorrect choice.'
  if (type === 'constructed_response') return 'answer must be {"type":"constructed_response","expectedResponse":"...","sampleResponse":"..."}. The expected response should describe what earns credit without pretending there is only one acceptable wording.'
  return 'answer must be {"type":"essay","keyPoints":["...","..."],"scoringNotes":"..."}. keyPoints must be nonempty and should support teacher scoring; do not present one model essay as the only correct response.'
}
const scoringGuidance = 'Optional blank, subpart, mapping, or rubric point fields must be omitted (or use empty arrays) unless every component point value is supplied and sums exactly to the fixed item points; never copy an illustrative value such as 1 when the fixed points differ.'
function answerShapeInstruction(type: QuestionType) { return `${rawAnswerShapeInstruction(type)} ${scoringGuidance}` }

function buildGenerationPrompt(type: QuestionType, immutable: Row, language: string, teacherContext: string, resources: string[], plannedVisual: { requirement: string; intent: string }) {
  const competency = clean(immutable.competencyText)
  const cognitive = clean(immutable.cognitiveLabel)
  const points = Number(immutable.pointsPossible ?? 1)
  const gradeLevel = clean(immutable.gradeLevel) || 'server-verified grade'
  const learningArea = clean(immutable.learningArea) || 'server-verified learning area'
  return [
    'Draft exactly one editable assessment item for a Philippine DepEd teacher. Teacher validation and professional judgment are mandatory.',
    'OFFICIAL POLICY BOUNDARY: AI may draft assessment content only subject to teacher validation, professional judgment, and curriculum alignment. It does not determine grades or replace teacher judgment.',
    'Official source: https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf',
    'Never alter the fixed item number, competency, cognitive category, question type, or points.',
    `Grade level (server-verified): ${gradeLevel}`,
    `Learning area (server-verified): ${learningArea}`,
    `Item number (fixed): ${Number(immutable.itemNumber)}`,
    `Competency (fixed): ${competency}`,
    `Cognitive category (fixed): ${cognitive}`,
    `Question type (fixed): ${type}`,
    `Points possible (fixed): ${points}`,
    language,
    `Bounded teacher context: ${teacherContext || 'none'}`,
    'If the bounded teacher context contains AUTOMATIC REPAIR REQUIREMENTS, treat every listed repair requirement as mandatory while preserving all fixed TOS fields.',
    `Teacher-listed resources (mention only exact entries, or none): ${resources.length ? resources.join('; ') : 'none'}`,
    'Do not invent resources, citations, devices, local facts, learner details, curriculum codes, or PII. Do not translate existing teacher content unexpectedly.',
    'Return one JSON object only with exactly these top-level keys: questionType, prompt, answer, rationale, referencedResources, visualRequirement, visualIntent.',
    `questionType must be exactly "${type}".`,
    answerShapeInstruction(type),
    `referencedResources must be ${resources.length ? 'an array containing only exact teacher-listed resource strings actually used' : 'an empty array [] because the teacher supplied no resources'}.`,
    plannedVisual.requirement === 'required'
      ? 'VISUAL CONTRACT (MANDATORY): this slot was selected BEFORE question generation as a REQUIRED visual item. Return visualRequirement exactly "required". Write a prompt that explicitly tells the learner to use/refer to the diagram/figure/graph. At least one ESSENTIAL given, label, measure, position, or relationship needed to solve the question must appear only in the future diagram and MUST NOT be duplicated in the written stem. The question must be invalid/incomplete without the diagram; the visual is problem data, not decoration.'
      : 'VISUAL CONTRACT (MANDATORY): this slot is text-only. Return visualRequirement exactly "none" and visualIntent exactly "". Write a fully self-contained question. Do not request a cosmetic/helpful diagram.',
    plannedVisual.requirement === 'required'
      ? `Required visual intent reserved by GuroDesk: ${plannedVisual.intent || 'Create the essential mathematical figure containing at least one necessary given that is absent from the written stem.'}`
      : 'No diagram is permitted for this generated item.',
    'Never use visualRequirement "helpful" during automatic question generation. A diagram is either essential to the question or it is not generated.',
    'When visualRequirement is "required", visualIntent must concisely specify the learner-visible givens/labels/relationships the separate visual call must draw, without including the correct answer or conclusion.',
    'Do not return visual geometry, TikZ, SVG, HTML, scripts, raster data, formula code, or coordinates in this question-generation response. GuroDesk requests the visual separately after the question contract is valid.',
    'Rationale is for teacher review and must be at least one clear sentence; it must not claim official approval.',
  ].join('\n')
}

function buildVerifierPrompt(type: QuestionType, immutable: Row, candidate: Row) {
  return [
    'Independently review one finished assessment item. Return strict JSON only.',
    `Fixed item number: ${Number(immutable.itemNumber)}`,
    `Fixed competency: ${clean(immutable.competencyText)}`,
    `Fixed cognitive category: ${clean(immutable.cognitiveLabel)}`,
    `Fixed question type: ${type}`,
    `Fixed points possible: ${Number(immutable.pointsPossible ?? 1)}`,
    `Finished candidate: ${JSON.stringify(candidate)}`,
    'Check answer validity, competency alignment, cognitive alignment, ambiguity, factual/math issues, and type-specific structure.',
    clean(candidate.visualRequirement, 20) === 'required'
      ? 'VISUAL DEPENDENCY CHECK: the finished learner prompt must genuinely require its diagram. It must explicitly refer to the diagram/figure/graph and at least one essential given must be absent from the written stem and supplied only by the visual intent. If the item can be answered correctly from text alone, return status "needs_repair" and explain that the diagram is merely cosmetic.'
      : 'This is a text-only item. Flag any unnecessary visual dependency or decorative visual request as needs_repair.',
    'Do not require a single best answer for essay, constructed_response, or multiple_select.',
    'Return exactly: {"status":"pass"|"needs_repair","answerValid":boolean,"competencyAligned":boolean,"cognitiveAlignment":"good"|"questionable","ambiguityDetected":boolean,"factualOrMathIssue":boolean,"issues":string[],"repairGuidance":string[]}.',
  ].join('\n')
}

function buildRepairPrompt(type: QuestionType, immutable: Row, candidate: Row, issues: string[], guidance: string[]) {
  return [
    'Repair exactly one assessment item. Keep immutable item number, competency, cognitive category, question type, and points unchanged.',
    `Fixed item number: ${Number(immutable.itemNumber)}`,
    `Fixed competency: ${clean(immutable.competencyText)}`,
    `Fixed cognitive category: ${clean(immutable.cognitiveLabel)}`,
    `Fixed question type: ${type}`,
    `Fixed points possible: ${Number(immutable.pointsPossible ?? 1)}`,
    `Current candidate: ${JSON.stringify(candidate)}`,
    `Verifier issues: ${issues.join(' | ') || 'review the answer and wording'}`,
    `Repair guidance: ${guidance.join(' | ') || 'return a clear unambiguous item'}`,
    clean(candidate.visualRequirement, 20) === 'required'
      ? 'Preserve visualRequirement "required". Make the diagram indispensable: explicitly refer to it and move at least one necessary given into visualIntent so the written stem alone is insufficient. Do not reveal the answer in visualIntent.'
      : 'Keep this item text-only with visualRequirement "none" and visualIntent ""; do not add a decorative diagram.',
    'Return one JSON object only with exactly questionType, prompt, answer, rationale, referencedResources, visualRequirement, visualIntent.',
    `questionType must remain exactly "${type}".`,
    answerShapeInstruction(type),
    'Do not return the diagram itself. Preserve or revise only visualRequirement and visualIntent; the dedicated visual request handles geometry separately.',
    'Do not invent resources or learner details.',
  ].join('\n')
}

function buildVisualPrompt(type: QuestionType, immutable: Row, candidate: Row, visualIntent: string, issues: string[]) {
  const requirement = clean(candidate.visualRequirement, 20) || 'required'
  return [
    'Create exactly one high-quality TikZ diagram for an already-valid school assessment question.',
    'This is a SEPARATE VISUAL-ONLY CALL. Do not rewrite the learner prompt, answer, rationale, item number, competency, cognitive category, question type, or points.',
    'Return ONLY raw TikZ source beginning with \\begin{tikzpicture} and ending with \\end{tikzpicture}. Do not return JSON, Markdown fences, prose, SVG, HTML, or a LaTeX document wrapper.',
    'Use only self-contained core TikZ commands that TikZJax can render without extra packages: \\draw, \\fill, \\filldraw, \\node, \\coordinate, \\path, \\clip, and scope environments.',
    'Do NOT use \\documentclass, \\usepackage, \\usetikzlibrary, \\input, \\include, \\includegraphics, URLs, file I/O, macro definitions, shell commands, \\foreach, loops, pgfplots, or external resources.',
    'Use a fixed 5:3 canvas. Immediately after \\begin{tikzpicture}, include \\path[use as bounding box] (0,0) rectangle (10,6); and keep all visible content comfortably inside that box.',
    'Prefer explicit coordinates and explicit drawing commands. Keep the code concise and deterministic.',
    'Use a clean textbook style: black/gray main strokes, restrained blue only when useful, readable labels, generous spacing, no decorative clip art, no unnecessary title, and no overlapping text.',
    'For geometry, draw the actual mathematical relationships accurately. Use arcs, right-angle marks, equal-side tick marks, arrows, dashed construction lines, and labels when they help the learner interpret the question.',
    'For coordinate graphs, draw axes, ticks, labels, and the required curve/points directly with TikZ commands; do not rely on pgfplots.',
    'Do not reveal the accepted answer, final numeric result, classification, or solution method in the diagram or labels. The diagram must support the question without solving it for the learner.',
    `Fixed item number: ${Number(immutable.itemNumber)}`,
    `Fixed competency: ${clean(immutable.competencyText)}`,
    `Fixed cognitive category: ${clean(immutable.cognitiveLabel)}`,
    `Fixed question type: ${type}`,
    `Fixed points possible: ${Number(immutable.pointsPossible ?? 1)}`,
    `Learner prompt: ${clean(candidate.prompt, 2000)}`,
    `Teacher-only answer context (NEVER reveal this in the diagram): ${JSON.stringify(candidate.answer)}`,
    `Visual requirement: ${requirement}`,
    `Visual intent: ${visualIntent || clean(candidate.visualIntent, 500)}`,
    ...(issues.length ? [`Previous visual issues to avoid: ${issues.join(' | ')}`] : []),
  ].join('\n')
}

// maxRetries=2 in the client scheduler means at most 3 provider attempts
// (attempt <= 3) for one queued operation; no endless repair loop is allowed.
async function callWithLiteFallback(
  apiKey: string,
  settings: ReturnType<typeof resolveSettings>,
  prompt: string,
  questionType: QuestionType,
  maxOutputTokens?: number,
  responseSchema?: GeminiSchema,
) {
  let modelUsed: AiModelId = settings.preferredModel
  let fallbackUsed = false
  let providerRequestCount = 0

  // Raw v1beta generateContent normal generation uses JSON MIME mode only.
  // Exact question-type/visual validation happens server-side after parsing;
  // the model/type-specific budget is selected in generationConfigFor().
  const config = maxOutputTokens
    ? { responseMimeType: 'application/json', maxOutputTokens, ...(responseSchema ? { responseSchema } : {}) }
    : { questionType, responseMimeType: 'application/json' }

  try {
    providerRequestCount += 1
    const output = await callGemini(apiKey, settings.preferredModel, prompt, config)
    return { output, modelUsed, fallbackUsed, providerRequestCount }
  } catch (error) {
    if (
      !(error instanceof GeminiHttpError)
      || !isFallbackEligibleStatus(error.status)
      || !fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)
    ) {
      if (error instanceof GeminiHttpError || error instanceof GeminiResponseError) error.providerRequestCount = providerRequestCount
      throw error
    }

    modelUsed = settings.fallbackModel
    fallbackUsed = true
    providerRequestCount += 1
    try {
      const output = await callGemini(apiKey, settings.fallbackModel, prompt, config)
      return { output, modelUsed, fallbackUsed, providerRequestCount }
    } catch (fallbackError) {
      if (fallbackError instanceof GeminiHttpError || fallbackError instanceof GeminiResponseError) fallbackError.providerRequestCount = providerRequestCount
      throw fallbackError
    }
  }
}
async function callTikzWithLiteFallback(
  apiKey: string,
  settings: ReturnType<typeof resolveSettings>,
  prompt: string,
) {
  let modelUsed: AiModelId = settings.preferredModel
  let fallbackUsed = false
  let providerRequestCount = 0
  // Deliberately do not send responseMimeType or responseSchema here. Raw text
  // is the provider default and avoids the structured-output configuration that
  // previously caused production HTTP 400 failures for diagram enrichment.
  const config = { maxOutputTokens: 8192 }
  try {
    providerRequestCount += 1
    const output = await callGemini(apiKey, settings.preferredModel, prompt, config)
    return { output, modelUsed, fallbackUsed, providerRequestCount }
  } catch (error) {
    if (
      !(error instanceof GeminiHttpError)
      || !isFallbackEligibleStatus(error.status)
      || !fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)
    ) {
      if (error instanceof GeminiHttpError || error instanceof GeminiResponseError) error.providerRequestCount = providerRequestCount
      throw error
    }
    modelUsed = settings.fallbackModel
    fallbackUsed = true
    providerRequestCount += 1
    try {
      const output = await callGemini(apiKey, settings.fallbackModel, prompt, config)
      return { output, modelUsed, fallbackUsed, providerRequestCount }
    } catch (fallbackError) {
      if (fallbackError instanceof GeminiHttpError || fallbackError instanceof GeminiResponseError) fallbackError.providerRequestCount = providerRequestCount
      throw fallbackError
    }
  }
}

function oppositeLiteModel(settings: ReturnType<typeof resolveSettings>, generatorModel = ''): LiteAiModelId { if (generatorModel === DEFAULT_MODEL) return DEFAULT_FALLBACK_MODEL; if (generatorModel === DEFAULT_FALLBACK_MODEL) return DEFAULT_MODEL; if (isLiteModel(settings.preferredModel)) return settings.preferredModel === DEFAULT_MODEL ? DEFAULT_FALLBACK_MODEL : DEFAULT_MODEL; return DEFAULT_MODEL }
type AuditPayload = { userId: string; assessmentId: string; itemId: string; questionType: QuestionType; alternative: boolean; model: string; fallbackUsed: boolean; outcome: 'success' | 'rejected' | 'error' | 'cancelled' }
async function audit(admin: ReturnType<typeof createClient>, payload: AuditPayload) { try { await admin.from('assessment_ai_audit_events').insert({ user_id: payload.userId, assessment_document_id: payload.assessmentId, assessment_item_id: payload.itemId, question_type: payload.questionType, alternative: payload.alternative, provider: 'google', model: payload.model, fallback_used: payload.fallbackUsed, outcome: payload.outcome }) } catch { /* Metadata audit failure never changes teacher work. */ } }
function errorMessage(error: unknown) {
  if (error instanceof GeminiResponseError) {
    if (error.category === 'MAX_TOKENS') return 'Gemini stopped before completing the structured assessment item. Your draft remains unchanged; try again with shorter context.'
    if (error.category === 'BLOCKED_SAFETY') return 'Gemini blocked this assessment request for safety reasons. Your draft remains unchanged.'
    if (error.category === 'EMPTY_OR_MISSING_TEXT') return 'Gemini returned no usable assessment item. Your draft remains unchanged; please try again.'
    if (error.category === 'MALFORMED_JSON' || error.category === 'MALFORMED_PROVIDER_RESPONSE') return 'Gemini returned an invalid structured assessment response. Your draft remains unchanged; please try again.'
    return 'Gemini returned an unusable structured assessment response. Your draft remains unchanged; please try again.'
  }
  if (error instanceof GeminiHttpError) {
    if (error.status === 429) return 'Gemini provider limit reached. Your saved assessment work is preserved; generation is paused. Try again later.'
    if (error.status === 401 || error.status === 403) return 'The saved Gemini credential was rejected. Your assessment draft remains unchanged.'
    if (error.status === 400) return 'Gemini rejected this assessment AI request. Your draft remains unchanged; please try again.'
    if (error.status === 404) return 'The selected Gemini model is not available for this API key. Your draft remains unchanged.'
    if ([500, 502, 503, 504].includes(error.status)) return 'Gemini is temporarily unavailable. Your assessment draft remains unchanged; please try again shortly.'
  }
  if (error instanceof Error && /draft remains unchanged|candidate|answer shape|mapping|choices|accepted answers|fill-in|numerical|problem-solving|matching|multiple-select|constructed response|essay|resource|visual|unsupported fields|immutable/i.test(error.message)) return error.message
  return 'Assessment AI could not complete this request. Your assessment draft remains unchanged.'
}

function errorCategory(error: unknown) {
  if (error instanceof GeminiResponseError) {
    if (error.category === 'MAX_TOKENS') return 'output_truncated'
    if (error.category === 'BLOCKED_SAFETY') return 'provider_blocked'
    if (error.category === 'EMPTY_OR_MISSING_TEXT') return 'empty_response'
    if (error.category === 'MALFORMED_JSON') return 'invalid_json'
    return 'unknown_provider_failure'
  }
  if (error instanceof GeminiHttpError) {
    if (error.status === 400) return 'provider_configuration'
    if (error.status === 401 || error.status === 403) return 'provider_authentication'
    if (error.status === 429) return 'provider_quota'
    return 'unknown_provider_failure'
  }
  if (error instanceof AssessmentContractError) {
    if (error.category === 'RESOURCE_INVALID') return 'resource_validation'
    if (error.category === 'IMMUTABLE_CONTEXT') return 'immutable_mapping'
    if (error.category === 'VISUAL_INVALID') return 'answer_validation'
    if (error.category === 'MALFORMED_JSON') return 'invalid_json'
    if (error.category === 'UNSUPPORTED_FIELD') return 'invalid_question_structure'
    return 'answer_validation'
  }
  if (error instanceof Error && /verifier|verification/i.test(error.message)) return 'verification_failure'
  return 'unknown_provider_failure'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  let auditPayload: AuditPayload | null = null
  let candidateValidationStarted = false
  try {
    const authHeader = req.headers.get('Authorization'); if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase function environment is incomplete.' }, 500)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } }); const { data: userData, error: userError } = await userClient.auth.getUser(); if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)
    const userId = userData.user.id; const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await req.json() as RequestBody; const operation: Operation = body.operation === 'verify' || body.operation === 'repair' || body.operation === 'visual' ? body.operation : 'generate'
    const allowedBodyKeys = ['operation', 'assessmentId', 'itemId', 'questionType', 'alternative', 'teacherContext', 'candidate', 'issues', 'repairGuidance', 'generatorModel', 'visualIntent']; if (Object.keys(body ?? {}).some((key) => !allowedBodyKeys.includes(key))) return json({ error: 'Unsupported assessment AI request fields.' }, 400)
    const assessmentId = clean(body.assessmentId, 80); const itemId = clean(body.itemId, 80); const requestedType = body.questionType; if (!UUID.test(assessmentId) || !UUID.test(itemId) || !requestedType || !QUESTION_TYPES.has(requestedType)) return json({ error: 'A valid assessment, item, and question type are required.' }, 400)
    const [assessmentResult, metadataResult, itemResult, preferencesResult, settingsResult, credentialResult] = await Promise.all([admin.from('documents').select('id, user_id, assignment_id, status, document_type, structured_content').eq('id', assessmentId).eq('user_id', userId).eq('document_type', 'assessment').maybeSingle(), admin.from('assessment_documents').select('*').eq('document_id', assessmentId).eq('user_id', userId).maybeSingle(), admin.from('assessment_items').select('*').eq('assessment_document_id', assessmentId).eq('id', itemId).maybeSingle(), admin.from('teacher_lesson_preferences').select('*').eq('user_id', userId).maybeSingle(), admin.from('teacher_ai_settings').select('*').eq('user_id', userId).maybeSingle(), admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userId).maybeSingle()])
    if (assessmentResult.error) throw assessmentResult.error; if (metadataResult.error) throw metadataResult.error; if (itemResult.error) throw itemResult.error; if (preferencesResult.error) throw preferencesResult.error; if (settingsResult.error) throw settingsResult.error; if (credentialResult.error) throw credentialResult.error
    if (!assessmentResult.data || !metadataResult.data || !itemResult.data) return json({ error: 'The assessment item could not be found for this teacher.' }, 404)
    if (assessmentResult.data.status !== 'draft') return json({ error: 'Only draft assessment items can receive editable AI suggestions.' }, 409)
    const item = itemResult.data as Row; const metadata = metadataResult.data as Row; const sourceContent = object(metadata.source_tos_content_snapshot); const serverType = String(item.question_type) as QuestionType; if (serverType !== requestedType) return json({ error: 'The requested question type does not match the saved item.' }, 409); if (item.locked === true || String(item.qa_state) === 'locked') return json({ error: 'This item is locked. Unlock it before requesting AI generation or review.' }, 409)
    const sourceSettings = object(object(assessmentResult.data.structured_content).settings ?? object(metadata.structured_content).settings); const allowedTypes = Array.isArray(sourceSettings.allowedTypes) ? sourceSettings.allowedTypes.map(String) : []; if (allowedTypes.length && !allowedTypes.includes(serverType)) return json({ error: 'This question type is disabled for the assessment.' }, 409)
    if (operation === 'generate' && !body.alternative && String(item.authorship_state) !== 'empty') return json({ error: 'This item already has content. Request an explicit alternative to preserve the existing draft.' }, 409)
    const sourceId = String(metadata.source_tos_document_id); const [sourceResult, tosRowsResult, competencyResult] = await Promise.all([admin.from('documents').select('id, user_id, assignment_id, status, document_type, structured_content').eq('id', sourceId).eq('user_id', userId).eq('document_type', 'tos').maybeSingle(), admin.from('tos_competencies').select('*').eq('document_id', sourceId).order('row_order', { ascending: true }), admin.from('curriculum_competencies').select('id, competency_code, competency_text, source_page, academic_period_id, verification_status').eq('id', String(item.canonical_competency_id)).maybeSingle()]); if (sourceResult.error) throw sourceResult.error; if (tosRowsResult.error) throw tosRowsResult.error; if (competencyResult.error) throw competencyResult.error
    const source = sourceResult.data as Row | null; const canonical = competencyResult.data as Row | null; if (!source || !canonical || !['final', 'archived'].includes(String(source.status)) || String(source.assignment_id) !== String(metadata.assignment_id)) return json({ error: 'The finalized TOS source is unavailable for this draft.' }, 409); if (String(canonical.verification_status) !== 'verified' || String(canonical.competency_text) !== String(item.competency_text_snapshot) || String(canonical.competency_code ?? '') !== String(item.competency_code_snapshot ?? '')) return json({ error: 'The saved competency mapping is no longer a verified canonical record.' }, 409)
    const tosRows = (tosRowsResult.data ?? []) as unknown as Row[]; const mappedRow = tosRows.find((row) => String(row.row_id) === String(item.tos_row_id) && String(row.competency_id) === String(item.canonical_competency_id) && Number(item.item_number) >= Number(row.item_start) && Number(item.item_number) <= Number(row.item_end)); if (!mappedRow) return json({ error: 'The saved item mapping no longer matches the finalized TOS range.' }, 409)
    const allocations = Array.isArray(mappedRow.cognitive_allocations) ? mappedRow.cognitive_allocations.map(object) : []; const allocation = allocations.find((entry) => String(entry.categoryId) === String(item.cognitive_category_id) && Number(entry.itemStart) === Number(item.allocation_item_start) && Number(entry.itemEnd) === Number(item.allocation_item_end) && Number(item.item_number) === Number(item.allocation_item_start) + Number(item.allocation_index)); if (!allocation) return json({ error: 'The saved cognitive mapping no longer matches the finalized TOS allocation.' }, 409)
    const preference = (preferencesResult.data ?? {}) as PreferenceRow; const resources = list(preference.actual_resources, 30, 180); const language = languageInstruction(clean(preference.language_preference, 80) || 'Auto', clean(preference.local_language_name, 100)); const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null); const credential = credentialResult.data as CredentialRow | null; if (!credential) return json({ error: 'Connect a Gemini API key in AI settings before using assessment AI.' }, 400); const apiKey = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)
    const assessmentContent = object(assessmentResult.data.structured_content)
    const metadataContent = object(metadata.structured_content)
    const gradeLevel = clean(item.grade_level ?? assessmentContent.gradeLevel ?? assessmentContent.grade_level ?? metadataContent.gradeLevel ?? metadataContent.grade_level)
    const learningArea = clean(item.learning_area ?? assessmentContent.learningArea ?? assessmentContent.learning_area ?? metadataContent.learningArea ?? metadataContent.learning_area)
    const immutable: Row = { itemNumber: Number(item.item_number), competencyText: String(item.competency_text_snapshot), competencyCode: item.competency_code_snapshot ? String(item.competency_code_snapshot) : null, cognitiveLabel: String(item.cognitive_category_label_snapshot), cognitiveShortLabel: String(item.cognitive_category_short_label_snapshot), pointsPossible: Number(item.points_possible ?? item.points ?? 1), gradeLevel, learningArea }
    auditPayload = { userId, assessmentId, itemId, questionType: serverType, alternative: body.alternative === true, model: settings.preferredModel, fallbackUsed: false, outcome: 'error' }
    let responseModel: AiModelId = settings.preferredModel; let fallbackUsed = false
    if (operation === 'visual') {
      candidateValidationStarted = true
      const approved = validateCandidate(body.candidate, serverType, resources, false, immutable)
      if (clean(approved.prompt) !== clean(item.prompt) || stableJson(approved.answer) !== stableJson(savedAnswerForVisual(item.answer))) {
        return json({ error: 'The saved question changed before visual generation. Reload the current item and retry the visual-only action.' }, 409)
      }
      const requirement = clean(approved.visualRequirement, 20) || 'none'
      if (requirement === 'none') {
        auditPayload.model = responseModel; auditPayload.outcome = 'success'; await audit(admin, auditPayload)
        return json({ assessmentId, itemId, questionType: serverType, visual: null, model: responseModel, fallbackUsed: false, providerRequestCount: 0 })
      }
      const visualIntent = clean(body.visualIntent, 500) || clean(approved.visualIntent, 500)
      if (!visualIntent) return json({ error: 'A visual request needs a concise visual intent.' }, 400)
      // The visual pass deliberately uses plain text instead of Gemini responseSchema.
      // Gemini authors the TikZ itself; GuroDesk only validates/sandboxes and renders it.
      const visualPrompt = buildVisualPrompt(serverType, immutable, approved, visualIntent, list(body.issues, 8, 500))
      let visualOutput = await callTikzWithLiteFallback(apiKey, settings, visualPrompt)
      let visualProviderRequestCount = visualOutput.providerRequestCount
      responseModel = visualOutput.modelUsed; fallbackUsed = visualOutput.fallbackUsed
      let tikz = validateAssessmentTikzSource(visualOutput.output)
      if (!tikz.valid) {
        // One bounded provider-authored correction pass is allowed. GuroDesk
        // never rewrites or synthesizes TikZ itself; it only reports the
        // validator failures and asks Gemini to author a fresh safe picture.
        const retryPrompt = [
          visualPrompt,
          '',
          'CORRECTION PASS: Your previous TikZ was rejected before rendering.',
          `Validator feedback: ${tikz.errors.slice(0, 6).join(' | ')}`,
          'Generate a fresh diagram from scratch that satisfies every rule above. Return raw TikZ only; do not explain the correction.',
        ].join('\n')
        const retryOutput = await callTikzWithLiteFallback(apiKey, settings, retryPrompt)
        visualProviderRequestCount += retryOutput.providerRequestCount
        responseModel = retryOutput.modelUsed
        fallbackUsed = fallbackUsed || retryOutput.fallbackUsed
        visualOutput = retryOutput
        tikz = validateAssessmentTikzSource(retryOutput.output)
      }
      if (!tikz.valid) throw new AssessmentContractError(`Gemini returned unsafe or unusable TikZ after one correction pass. ${tikz.errors.slice(0, 3).join(' ')}`, 'VISUAL_INVALID')
      const directVisual = {
        id: `tikz-${itemId}`,
        kind: 'geometry',
        version: 1,
        width: 600,
        height: 360,
        altText: 'A mathematical diagram accompanying the question.',
        tikzCode: tikz.source,
        primitives: [],
      }
      const visualCheck = validateAssessmentVisual(directVisual)
      if (!visualCheck.valid) throw new AssessmentContractError(`The dedicated TikZ response was invalid. ${visualCheck.errors.slice(0, 3).join(' ')}`, 'VISUAL_INVALID')
      // Re-run the shared candidate contract so the same immutable/answer-leak
      // boundary applies to a direct TikZ visual as to legacy structured visuals.
      const combined = validateCandidate({ ...approved, visual: directVisual }, serverType, resources, false, immutable)
      auditPayload.model = responseModel; auditPayload.fallbackUsed = fallbackUsed; auditPayload.outcome = 'success'; await audit(admin, auditPayload)
      return json({ assessmentId, itemId, questionType: serverType, visual: combined.visual ?? null, model: responseModel, fallbackUsed, providerRequestCount: visualProviderRequestCount })
    }
    if (operation === 'verify') {
      candidateValidationStarted = true; const approved = validateCandidate(body.candidate, serverType, resources, false, immutable); const verifierModel = oppositeLiteModel(settings, clean(body.generatorModel, 120)); const verifierOutput = await callGemini(apiKey, verifierModel, buildVerifierPrompt(serverType, immutable, approved), { maxOutputTokens: 4096, responseMimeType: 'application/json', responseSchema: verifierResponseSchema }); responseModel = verifierModel; const verifier = parseJson(verifierOutput); const required = ['status', 'answerValid', 'competencyAligned', 'cognitiveAlignment', 'ambiguityDetected', 'factualOrMathIssue', 'issues', 'repairGuidance']; if (!onlyKeys(verifier, required) || !['pass', 'needs_repair'].includes(String(verifier.status)) || typeof verifier.answerValid !== 'boolean' || typeof verifier.competencyAligned !== 'boolean' || !['good', 'questionable'].includes(String(verifier.cognitiveAlignment)) || typeof verifier.ambiguityDetected !== 'boolean' || typeof verifier.factualOrMathIssue !== 'boolean' || !Array.isArray(verifier.issues) || !Array.isArray(verifier.repairGuidance)) throw new Error('The verifier response did not match the required structured contract.'); auditPayload.model = responseModel; auditPayload.outcome = 'success'; await audit(admin, auditPayload); return json({ assessmentId, itemId, questionType: serverType, verifier: { ...verifier, issues: list(verifier.issues, 12, 500), repairGuidance: list(verifier.repairGuidance, 12, 700) }, model: responseModel, fallbackUsed: false, providerRequestCount: 1, editable: true })
    }
    let candidate: Row
    let providerRequestCount = 0
    if (operation === 'repair') { candidateValidationStarted = true; const current = validateCandidate(body.candidate, serverType, resources, false, immutable); const repairSettings = { ...settings, preferredModel: isLiteModel(settings.preferredModel) ? settings.preferredModel : DEFAULT_MODEL, fallbackModel: isLiteModel(settings.preferredModel) && settings.preferredModel !== DEFAULT_MODEL ? DEFAULT_MODEL : DEFAULT_FALLBACK_MODEL }; const output = await callWithLiteFallback(apiKey, repairSettings, buildRepairPrompt(serverType, immutable, current, list(body.issues, 8, 500), list(body.repairGuidance, 8, 700)), serverType); responseModel = output.modelUsed; fallbackUsed = output.fallbackUsed; providerRequestCount = output.providerRequestCount; candidate = validateCandidate(canonicalQuestionProviderEnvelope(parseJson(output.output)), serverType, resources, true, immutable) }
    else {
      const teacherContext = clean(body.teacherContext, 1200)
      const plannedVisual = savedVisualPlan(item.answer)
      const output = await callWithLiteFallback(apiKey, settings, buildGenerationPrompt(serverType, immutable, language, teacherContext, resources, plannedVisual), serverType)
      responseModel = output.modelUsed; fallbackUsed = output.fallbackUsed; providerRequestCount = output.providerRequestCount; candidateValidationStarted = true
      candidate = validateCandidate(canonicalQuestionProviderEnvelope(parseJson(output.output)), serverType, resources, true, immutable)
      if (plannedVisual.requirement === 'required') {
        if (clean(candidate.visualRequirement, 20) !== 'required' || !clean(candidate.visualIntent, 500) || !promptDependsOnVisual(candidate.prompt)) {
          throw new AssessmentContractError('The generated visual question was still answerable without its required diagram. Regenerate the item so the diagram supplies essential problem data.', 'VISUAL_INVALID')
        }
      } else {
        // The paper planner, not Gemini, decides whether automatic items receive
        // diagrams. Prevent provider enthusiasm from reintroducing cosmetics.
        candidate = { ...candidate, visualRequirement: 'none', visualIntent: '' }
      }
    }
    candidateValidationStarted = true; auditPayload.model = responseModel; auditPayload.fallbackUsed = fallbackUsed; auditPayload.outcome = 'success'; await audit(admin, auditPayload); return json({ assessmentId, itemId, questionType: serverType, candidate, approvedResources: resources, model: responseModel, fallbackUsed, providerRequestCount, editable: true })
  } catch (error) {
    if (auditPayload) { auditPayload.outcome = candidateValidationStarted ? 'rejected' : 'error'; const supabaseUrl = Deno.env.get('SUPABASE_URL'); const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (supabaseUrl && serviceRole) await audit(createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } }), auditPayload) }
    // Safe operational diagnostic only: never log prompts, candidates, API keys,
    // ciphertext, or raw provider bodies.
    console.error('assessment-question-generator failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
      category: errorCategory(error),
      providerStatus: error instanceof GeminiHttpError ? error.status : undefined,
      finishReason: error instanceof GeminiResponseError ? error.finishReason : undefined,
    })
    const providerStatus = error instanceof GeminiHttpError ? error.status : 0
    const body: Row = { error: errorMessage(error), category: errorCategory(error), generatorContract: '2026-08-11-direct-tikz-v1' }
    if (providerStatus) body.providerStatus = providerStatus
    if (error instanceof GeminiResponseError && error.finishReason) body.finishReason = error.finishReason
    if ((error instanceof GeminiHttpError || error instanceof GeminiResponseError) && error.providerRequestCount) body.providerRequestCount = error.providerRequestCount
    return json(body, [408, 425, 429, 500, 502, 503, 504].includes(providerStatus) ? providerStatus : 400)
  }
})
