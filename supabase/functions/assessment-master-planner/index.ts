import { resolveGeminiAccess, SponsoredAiError, type GeminiAccess } from '../_shared/sponsored-ai.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import { ASSESSMENT_QUESTION_TYPES, type AiModelId, type AssessmentQuestionType } from '../_shared/ai-models.ts'
import { callGemini, GeminiHttpError, GeminiResponseError, parseGeminiJson } from '../_shared/gemini.ts'

type Row = Record<string, unknown>
type CredentialRow = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }
type VisualPolicy = 'off' | 'balanced' | 'more_visuals'
const ASSESSMENT_VISUALS_ENABLED = true
type Cpd = 'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating' | 'creating' | 'other'
type Bucket = {
  id: string
  rowId: string
  competencyId: string
  competencyText: string
  cognitiveCategoryId: string
  cognitiveLabel: string
  cpdKey: Cpd
  pointsAllocated: number
  eligibleTypes: Array<{ questionType: AssessmentQuestionType; minPoints: number; maxPoints: number }>
}
type RequestBody = {
  sourceTosId?: string
  totalPoints?: number
  visualPolicy?: VisualPolicy
  allowedTypes?: AssessmentQuestionType[]
  title?: string
  instructions?: string
  pointBuckets?: Bucket[]
}

const MODEL_ORDER: readonly AiModelId[] = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
const QUESTION_TYPES = new Set<string>(ASSESSMENT_QUESTION_TYPES)
const CPDS = new Set<Cpd>(['remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating', 'other'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
function object(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {} }
function clean(value: unknown, max = 2000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function integer(value: unknown) { const result = Number(value); return Number.isSafeInteger(result) ? result : Number.NaN }

// The raw generateContent planner deliberately uses JSON MIME mode without
// responseSchema. GuroDesk validates the full master-plan contract locally in
// validateProviderPlan(), which avoids provider INVALID_ARGUMENT/HTTP 400
// failures previously observed with this planner's responseSchema payload while preserving the same
// strict point, TOS, CPD, type, and visual-policy boundaries.

function normalizeBuckets(value: unknown): Bucket[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error('A bounded deterministic point blueprint is required.')
  const seen = new Set<string>()
  return value.map((entry, index) => {
    const row = object(entry)
    const id = clean(row.id, 180)
    const rowId = clean(row.rowId, 80)
    const competencyId = clean(row.competencyId, 80)
    const competencyText = clean(row.competencyText, 3000)
    const cognitiveCategoryId = clean(row.cognitiveCategoryId, 120)
    const cognitiveLabel = clean(row.cognitiveLabel, 200)
    const cpdKey = clean(row.cpdKey, 30) as Cpd
    const pointsAllocated = integer(row.pointsAllocated)
    if (!id || seen.has(id) || !UUID.test(rowId) || !UUID.test(competencyId) || !competencyText || !cognitiveCategoryId || !cognitiveLabel || !CPDS.has(cpdKey) || !Number.isSafeInteger(pointsAllocated) || pointsAllocated < 1 || pointsAllocated > 1000) throw new Error(`Point blueprint bucket ${index + 1} is invalid.`)
    seen.add(id)
    if (!Array.isArray(row.eligibleTypes) || !row.eligibleTypes.length) throw new Error(`Point blueprint bucket ${index + 1} has no eligible question type.`)
    const eligibleTypes = row.eligibleTypes.map((candidate) => {
      const typeRow = object(candidate)
      const questionType = clean(typeRow.questionType, 50) as AssessmentQuestionType
      const minPoints = integer(typeRow.minPoints)
      const maxPoints = integer(typeRow.maxPoints)
      if (!QUESTION_TYPES.has(questionType) || minPoints < 1 || maxPoints < minPoints || maxPoints > 20) throw new Error(`Point blueprint bucket ${index + 1} has an invalid type constraint.`)
      return { questionType, minPoints, maxPoints }
    })
    return { id, rowId, competencyId, competencyText, cognitiveCategoryId, cognitiveLabel, cpdKey, pointsAllocated, eligibleTypes }
  })
}


const POINT_RULES: Record<AssessmentQuestionType, { min: number; max: number }> = {
  multiple_choice: { min: 1, max: 1 },
  true_false: { min: 1, max: 1 },
  identification: { min: 1, max: 1 },
  short_answer: { min: 1, max: 3 },
  fill_in_the_blank: { min: 1, max: 4 },
  numerical_answer: { min: 1, max: 4 },
  matching: { min: 2, max: 8 },
  multiple_select: { min: 1, max: 3 },
  problem_solving: { min: 2, max: 8 },
  constructed_response: { min: 2, max: 8 },
  essay: { min: 4, max: 12 },
}

const BASE_ELIGIBILITY: Record<Cpd, Partial<Record<AssessmentQuestionType, 'strong' | 'allowed'>>> = {
  remembering: { multiple_choice:'strong', true_false:'strong', identification:'strong', fill_in_the_blank:'strong', matching:'strong', short_answer:'allowed', multiple_select:'allowed', constructed_response:'allowed' },
  understanding: { multiple_choice:'strong', true_false:'strong', identification:'allowed', fill_in_the_blank:'allowed', matching:'strong', short_answer:'strong', multiple_select:'strong', numerical_answer:'allowed', problem_solving:'allowed', constructed_response:'strong', essay:'allowed' },
  applying: { multiple_choice:'strong', true_false:'allowed', fill_in_the_blank:'allowed', matching:'allowed', short_answer:'allowed', multiple_select:'strong', numerical_answer:'strong', problem_solving:'strong', constructed_response:'strong', essay:'allowed' },
  analyzing: { multiple_choice:'strong', true_false:'allowed', matching:'allowed', short_answer:'strong', multiple_select:'strong', numerical_answer:'strong', problem_solving:'strong', constructed_response:'strong', essay:'strong' },
  evaluating: { multiple_choice:'allowed', short_answer:'allowed', multiple_select:'allowed', numerical_answer:'allowed', problem_solving:'strong', constructed_response:'strong', essay:'strong' },
  creating: { problem_solving:'strong', constructed_response:'strong', essay:'strong' },
  other: { multiple_choice:'allowed', true_false:'allowed', identification:'allowed', fill_in_the_blank:'allowed', matching:'allowed', short_answer:'strong', multiple_select:'allowed', numerical_answer:'allowed', problem_solving:'strong', constructed_response:'strong', essay:'strong' },
}

function normalizeCpd(id: unknown, label: unknown): Cpd {
  const value = `${clean(id, 120)} ${clean(label, 200)}`.toLowerCase()
  if (/\bremember(?:ing)?\b|\brecall\b|\bknowledge\b/.test(value)) return 'remembering'
  if (/\bunderstand(?:ing)?\b|\bcomprehens/.test(value)) return 'understanding'
  if (/\bapply(?:ing)?\b|\bapplication\b/.test(value)) return 'applying'
  if (/\banaly[sz](?:e|ing)\b|\banalysis\b/.test(value)) return 'analyzing'
  if (/\bevaluat(?:e|ing|ion)\b|\bjudge|critique/.test(value)) return 'evaluating'
  if (/\bcreat(?:e|ing|ion)\b|\bdesign\b|\bproduce\b/.test(value)) return 'creating'
  return 'other'
}
function isMathArea(value: string) { return /\bmath(?:ematics)?\b|\bmathematika\b/i.test(value) }
function isVisualEligibleArea(value: string) { return /\bmath(?:ematics)?\b|\bmathematika\b|\bcalculus\b|\bscience\b|\bphysics\b|\bchemistry\b|\bbiology\b|\bgeometry\b|\bstatistics\b|\bstem\b|\btle\b/i.test(value) }
function isLanguageArea(value: string) { return /\benglish\b|\bfilipino\b|\blanguage\b|\breading\b|\bliterature\b|\bcommunication\b/i.test(value) }
function suitability(type: AssessmentQuestionType, cpd: Cpd, learningArea: string) {
  if (cpd === 'creating' && isMathArea(learningArea) && type === 'problem_solving') return 'strong'
  if ((cpd === 'evaluating' || cpd === 'creating') && isLanguageArea(learningArea) && type === 'essay') return 'strong'
  return BASE_ELIGIBILITY[cpd][type] ?? 'unsupported'
}
function eligibleTypes(allowed: AssessmentQuestionType[], cpd: Cpd, learningArea: string) {
  return allowed.filter((type) => {
    const level = suitability(type, cpd, learningArea)
    return cpd === 'evaluating' || cpd === 'creating' ? level === 'strong' : level !== 'unsupported'
  })
}
function hamilton(total: number, weights: number[]) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid deterministic point remainder.')
  const safe = weights.map((value) => Number.isFinite(value) && value > 0 ? value : 0)
  const sum = safe.reduce((a, b) => a + b, 0)
  if (sum <= 0) return safe.map(() => 0)
  const raw = safe.map((weight) => total * weight / sum)
  const result = raw.map(Math.floor)
  let remaining = total - result.reduce((a, b) => a + b, 0)
  const order = raw.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let i = 0; i < order.length && remaining > 0; i += 1, remaining -= 1) result[order[i].index] += 1
  return result
}
function authoritativeBuckets(rows: Row[], totalPoints: number, allowed: AssessmentQuestionType[], learningArea: string): Bucket[] {
  const cells: Array<Omit<Bucket, 'pointsAllocated'>> = []
  const orderedRows = [...rows].sort((a, b) => integer(a.row_order) - integer(b.row_order) || clean(a.row_id, 80).localeCompare(clean(b.row_id, 80), 'en'))
  for (const row of orderedRows) {
    const allocations = (Array.isArray(row.cognitive_allocations) ? row.cognitive_allocations.map(object) : [])
      .filter((allocation) => integer(allocation.itemCount) > 0 && integer(allocation.itemStart) > 0 && integer(allocation.itemEnd) >= integer(allocation.itemStart))
      .sort((a, b) => integer(a.itemStart) - integer(b.itemStart) || clean(a.categoryId, 120).localeCompare(clean(b.categoryId, 120), 'en'))
    for (const allocation of allocations) {
      const cpdKey = normalizeCpd(allocation.categoryId, allocation.label)
      const supported = eligibleTypes(allowed, cpdKey, learningArea)
      if (!supported.length) throw new Error(`Selected question types cannot cover ${clean(allocation.label, 200) || cpdKey}.`)
      const rowId = clean(row.row_id, 80)
      const cognitiveCategoryId = clean(allocation.categoryId, 120)
      cells.push({
        id: `${rowId}:${cognitiveCategoryId}`,
        rowId,
        competencyId: clean(row.competency_id, 80),
        competencyText: clean(row.competency_text_snapshot, 3000),
        cognitiveCategoryId,
        cognitiveLabel: clean(allocation.label, 200),
        cpdKey,
        eligibleTypes: supported.map((questionType) => ({ questionType, minPoints: POINT_RULES[questionType].min, maxPoints: POINT_RULES[questionType].max })),
      })
    }
  }
  if (!cells.length) throw new Error('The finalized TOS has no positive cognitive allocations.')
  const minimums = cells.map((cell) => Math.min(...cell.eligibleTypes.map((entry) => entry.minPoints)))
  const minimumTotal = minimums.reduce((sum, value) => sum + value, 0)
  if (totalPoints < minimumTotal) throw new Error(`At least ${minimumTotal} total points are required for the selected formats and TOS coverage.`)
  const weights = cells.map((cell) => {
    const row = orderedRows.find((candidate) => clean(candidate.row_id, 80) === cell.rowId)
    const allocation = (Array.isArray(row?.cognitive_allocations) ? row!.cognitive_allocations.map(object) : []).find((candidate) => clean(candidate.categoryId, 120) === cell.cognitiveCategoryId)
    return integer(allocation?.itemCount)
  })
  const extras = hamilton(totalPoints - minimumTotal, weights)
  return cells.map((cell, index) => ({ ...cell, pointsAllocated: minimums[index] + extras[index] }))
}
function assertClientBlueprintMatchesAuthoritative(client: Bucket[], authoritative: Bucket[]) {
  if (client.length !== authoritative.length) throw new Error('The deterministic point blueprint no longer matches the finalized TOS.')
  const byId = new Map(client.map((bucket) => [bucket.id, bucket]))
  for (const expected of authoritative) {
    const actual = byId.get(expected.id)
    if (!actual
      || actual.rowId !== expected.rowId
      || actual.competencyText !== expected.competencyText
      || actual.cognitiveCategoryId !== expected.cognitiveCategoryId
      || actual.cognitiveLabel !== expected.cognitiveLabel
      || actual.cpdKey !== expected.cpdKey
      || actual.pointsAllocated !== expected.pointsAllocated
      || JSON.stringify(actual.eligibleTypes) !== JSON.stringify(expected.eligibleTypes)) {
      throw new Error('The deterministic point blueprint no longer matches the finalized TOS and selected question types.')
    }
  }
}

function buildPrompt(args: { gradeLevel: string; learningArea: string; title: string; instructions: string; totalPoints: number; visualPolicy: VisualPolicy; buckets: Bucket[] }) {
  const bucketLines = args.buckets.map((bucket) => `${bucket.id} | competency=${bucket.competencyText} | CPD=${bucket.cognitiveLabel} (${bucket.cpdKey}) | exactPoints=${bucket.pointsAllocated} | allowed=${bucket.eligibleTypes.map((entry) => `${entry.questionType}:${entry.minPoints}-${entry.maxPoints}`).join(',')}`).join('\n')
  return [
    'You are the master assessment planner for GuroDesk, a Philippine teacher assessment system.',
    'Design ONE coherent full-paper plan. Do not write the actual questions or answers.',
    `Grade level: ${args.gradeLevel}`,
    `Learning area: ${args.learningArea}`,
    `Assessment title: ${args.title || 'Untitled assessment'}`,
    `Teacher instructions: ${args.instructions || 'None supplied.'}`,
    `Exact total points: ${args.totalPoints}`,
    `Visual policy: ${args.visualPolicy}`,
    '',
    'IMMUTABLE RULES:',
    '- Every blueprint bucket must receive exactly its exactPoints total. Never move points between buckets.',
    '- Use only a question type listed in that bucket allowed list and keep pointsPossible inside that type range.',
    '- A logical question belongs to exactly one bucket. Do not combine competencies or CPDs across buckets.',
    '- FORMAT DIVERSITY REQUIREMENT: You MUST utilize a diverse, balanced distribution of ALL question types listed in each bucket allowed list across the paper. Do NOT default to Multiple Choice for every item. Every enabled question type should be actively utilized where valid, creating a rich, varied mix of question formats across the test (combining Multiple Choice, True/False, Identification, Fill in the Blank, Matching, Short Answer, Multiple Select, Problem Solving, Essay, etc., as enabled by the teacher).',
    '- Prefer a varied, natural test. Avoid unnecessary essays or long responses when a concise format is better.',
    '- For Evaluating/Creating, use the higher-order types made available in the bucket constraints.',
    '- visualRequirement=required only when the learner genuinely needs information contained in the diagram/graph. Do not use decorative visuals.',
    !isVisualEligibleArea(args.learningArea) ? '- Automatic required visuals are limited to visual-eligible subjects (Mathematics, Science, STEM): every entry MUST use visualRequirement="none" and visualIntent="".' : args.visualPolicy === 'off' ? '- Visual policy is Off: every entry MUST use visualRequirement="none" and visualIntent="".' : args.visualPolicy === 'balanced' ? '- Balanced visuals: keep most questions text-only. Required visuals must not exceed floor(logicalQuestionCount / 4), with zero required visuals for fewer than 4 logical questions.' : '- More visuals: you may mark more genuinely diagram-dependent tasks as required, but keep text-sufficient questions visualRequirement="none"; never add decorative or answer-revealing visuals.',
    '- taskIntent is a concise instruction for the later question generator. It must define what the question should assess without writing the final question or answer. When multiple entries target the same bucket or competency, each entry taskIntent MUST assess a distinctly different subtopic, concept facet, formula, or real-world application so generated questions never duplicate each other.',
    '- Return entries in conventional contiguous question-type sections. Group all Multiple Choice together first, then other objective/short formats, and put Problem Solving / Constructed Response / Essay later. Do NOT interleave the same question type across the paper.',
    '- The sum of pointsPossible across all entries must equal the exact total points.',
    '',
    'DETERMINISTIC BLUEPRINT BUCKETS:',
    bucketLines,
    '',
    'Return exactly one JSON object: {"entries":[{"bucketId":"...","questionType":"...","pointsPossible":1,"taskIntent":"...","visualRequirement":"none|required","visualIntent":"..."}]}.',
  ].join('\n')
}

function validateProviderPlan(value: Row, buckets: Bucket[], totalPoints: number, visualPolicy: VisualPolicy, learningArea: string) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 500) throw new Error('Gemini returned an invalid master-plan envelope.')
  const bucketMap = new Map(buckets.map((bucket) => [bucket.id, bucket]))
  const totals = new Map<string, number>()
  let overall = 0
  const entries = value.entries.map((raw, index) => {
    const row = object(raw)
    const bucketId = clean(row.bucketId, 180)
    const bucket = bucketMap.get(bucketId)
    const questionType = clean(row.questionType, 50) as AssessmentQuestionType
    const pointsPossible = integer(row.pointsPossible)
    const taskIntent = clean(row.taskIntent, 1200)
    const visualRequirement = clean(row.visualRequirement, 20)
    const visualIntent = clean(row.visualIntent, 500)
    if (!bucket || !QUESTION_TYPES.has(questionType) || !Number.isSafeInteger(pointsPossible) || pointsPossible < 1 || !taskIntent || !['none', 'required'].includes(visualRequirement)) throw new Error(`Master-plan entry ${index + 1} is invalid.`)
    const constraint = bucket.eligibleTypes.find((entry) => entry.questionType === questionType)
    if (!constraint || pointsPossible < constraint.minPoints || pointsPossible > constraint.maxPoints) throw new Error(`Master-plan entry ${index + 1} violates the bucket's question-type point constraints.`)
    if (visualPolicy === 'off' && (visualRequirement !== 'none' || visualIntent)) throw new Error('The master plan added a visual while the teacher visual policy is Off.')
    if (visualRequirement !== 'none' && !visualIntent) throw new Error(`Master-plan entry ${index + 1} needs a visual intent.`)
    if (visualRequirement === 'none' && visualIntent) throw new Error(`Master-plan entry ${index + 1} supplied visual intent for a text-only item.`)
    totals.set(bucketId, (totals.get(bucketId) ?? 0) + pointsPossible)
    overall += pointsPossible
    return { bucketId, questionType, pointsPossible, taskIntent, visualRequirement, visualIntent }
  })
  const requiredVisuals = entries.filter((entry) => entry.visualRequirement === 'required').length
  if (!isVisualEligibleArea(learningArea) && requiredVisuals > 0) throw new Error('Automatic required visuals are limited to Mathematics, Science, and STEM.')
  if (visualPolicy === 'balanced') {
    const balancedLimit = entries.length < 4 ? 0 : Math.floor(entries.length / 4)
    if (requiredVisuals > balancedLimit) throw new Error(`Balanced visual policy allows at most ${balancedLimit} required visual${balancedLimit === 1 ? '' : 's'} for ${entries.length} logical questions.`)
  }
  for (const bucket of buckets) if ((totals.get(bucket.id) ?? 0) !== bucket.pointsAllocated) throw new Error(`Master plan did not preserve the exact point budget for ${bucket.cognitiveLabel}.`)
  if (overall !== totalPoints) throw new Error('Master plan does not sum to the requested total points.')
  return entries
}

function providerRetryEligible(error: unknown) {
  if (error instanceof GeminiHttpError) {
    if (error.status === 401 || error.status === 403) return false
    return true
  }
  if (error instanceof GeminiResponseError) return true
  if (error instanceof Error) return true
  return false
}

function errorMessage(error: unknown) {
  if (error instanceof GeminiHttpError) {
    if (error.status === 429) return 'Gemini quota/rate capacity was exhausted across the available planner models. No assessment draft was created.'
    if (error.status === 401 || error.status === 403) return 'The saved Gemini credential was rejected. No assessment draft was created.'
    if (error.status === 404) return 'The configured Gemini planner models are unavailable for this API key.'
    if ([500, 502, 503, 504].includes(error.status)) return 'Gemini is temporarily unavailable. No assessment draft was created.'
  }
  if (error instanceof GeminiResponseError) return 'Gemini returned an unusable master assessment plan. No assessment draft was created.'
  return error instanceof Error ? error.message : 'Unable to create the master assessment plan.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
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
    const allowedBodyKeys = new Set(['sourceTosId', 'totalPoints', 'visualPolicy', 'allowedTypes', 'title', 'instructions', 'pointBuckets'])
    if (Object.keys(body ?? {}).some((key) => !allowedBodyKeys.has(key))) return json({ error: 'Unsupported master-planner request fields.' }, 400)
    const sourceTosId = clean(body.sourceTosId, 80)
    const totalPoints = integer(body.totalPoints)
    const visualPolicy: VisualPolicy = ASSESSMENT_VISUALS_ENABLED
      ? (body.visualPolicy === 'balanced' || body.visualPolicy === 'more_visuals' ? body.visualPolicy : 'off')
      : 'off'
    if (!UUID.test(sourceTosId) || !Number.isSafeInteger(totalPoints) || totalPoints < 1 || totalPoints > 1000) return json({ error: 'A finalized TOS and supported total point value are required.' }, 400)
    const allowedTypes = Array.isArray(body.allowedTypes) ? [...new Set(body.allowedTypes.filter((type): type is AssessmentQuestionType => QUESTION_TYPES.has(String(type))))] : []
    if (!allowedTypes.length) return json({ error: 'Select at least one supported question type.' }, 400)
    const buckets = normalizeBuckets(body.pointBuckets)
    if (buckets.reduce((sum, bucket) => sum + bucket.pointsAllocated, 0) !== totalPoints) return json({ error: 'The deterministic point blueprint does not equal the requested total points.' }, 400)
    if (buckets.some((bucket) => bucket.eligibleTypes.some((entry) => !allowedTypes.includes(entry.questionType)))) return json({ error: 'The point blueprint contains a question type the teacher did not select.' }, 400)

    const [sourceResult, tosRowsResult, credentialResult] = await Promise.all([
      admin.from('documents').select('id,user_id,status,document_type,structured_content').eq('id', sourceTosId).eq('user_id', userId).eq('document_type', 'tos').maybeSingle(),
      admin.from('tos_competencies').select('row_id,row_order,competency_id,competency_text_snapshot,cognitive_allocations').eq('document_id', sourceTosId),
      admin.from('teacher_ai_credentials').select('api_key_ciphertext,api_key_iv,encryption_key_source').eq('user_id', userId).maybeSingle(),
    ])
    if (sourceResult.error) throw sourceResult.error
    if (tosRowsResult.error) throw tosRowsResult.error
    if (credentialResult.error) throw credentialResult.error
    const source = sourceResult.data as Row | null
    if (!source || String(source.status) !== 'final') return json({ error: 'The finalized TOS source could not be found.' }, 404)
    const content = object(source.structured_content)
    const authoritativeRows = Array.isArray(tosRowsResult.data) ? tosRowsResult.data.map(object) : []
    const verifiedBuckets = authoritativeBuckets(authoritativeRows, totalPoints, allowedTypes, clean(content.learningArea, 160))
    try { assertClientBlueprintMatchesAuthoritative(buckets, verifiedBuckets) }
    catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status); return json({ error: error instanceof Error ? error.message : 'The point blueprint no longer matches the finalized TOS projection.' }, 409) }
    const credential = credentialResult.data as CredentialRow | null; const apiKey = await resolveGeminiAccess(credential, admin, userId, req, Deno.env.get('GURODESK_SPONSORED_GEMINI_KEY'))
    const prompt = buildPrompt({
      gradeLevel: clean(content.gradeLevel, 120),
      learningArea: clean(content.learningArea, 160),
      title: clean(body.title, 240),
      instructions: clean(body.instructions, 3000),
      totalPoints,
      visualPolicy,
      buckets: verifiedBuckets,
    })

    let lastError: unknown = null
    let providerRequestCount = 0
    for (const model of MODEL_ORDER) {
      try {
        providerRequestCount += 1
        const output = await callGemini(apiKey, model, prompt, {
          maxOutputTokens: 12288,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'HIGH' },
        })
        const entries = validateProviderPlan(parseGeminiJson(output), verifiedBuckets, totalPoints, visualPolicy, clean(content.learningArea, 160))
        return json({ entries, model, providerRequestCount, fallbackUsed: model !== MODEL_ORDER[0], modelOrder: MODEL_ORDER })
      } catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status)
        lastError = error
        if (!providerRetryEligible(error)) throw error
      }
    }
    throw lastError ?? new Error('No Gemini planner model completed the request.')
  } catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status)
    console.error('assessment-master-planner failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
      providerStatus: error instanceof GeminiHttpError ? error.status : undefined,
      providerDetail: error instanceof GeminiHttpError ? error.detail : undefined,
    })
    return json({ error: errorMessage(error), providerStatus: error instanceof GeminiHttpError ? error.status : undefined }, error instanceof GeminiHttpError && [408, 425, 429, 500, 502, 503, 504].includes(error.status) ? error.status : 400)
  }
})
