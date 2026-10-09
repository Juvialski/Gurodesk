import { resolveGeminiAccess, SponsoredAiError, type GeminiAccess } from '../_shared/sponsored-ai.ts'
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

type TeacherConstraints = {
  languagePreference?: unknown
  localLanguageName?: unknown
  preferredApproaches?: unknown
  actualResources?: unknown
  resourceNotes?: unknown
  durationMinutes?: unknown
  numberOfSessions?: unknown
}

type RequestBody = {
  resultSessionId?: unknown
  competencyId?: unknown
  teacherConstraints?: unknown
}

type SettingsRow = { preferred_model?: string; fallback_model?: string; fallback_enabled?: boolean }
type CredentialRow = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }

const allowedConstraintKeys = new Set([
  'languagePreference', 'localLanguageName', 'preferredApproaches', 'actualResources',
  'resourceNotes', 'durationMinutes', 'numberOfSessions',
])
const forbiddenConstraintKey = /(learner|student|participant|answer|response|score|feedback|history|display.?name|local.?reference|uuid|password|email|phone|address|guardian|health|diagnos)/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function arrayOfText(value: unknown, limit: number, itemLimit: number) {
  if (!Array.isArray(value)) return []
  return value.map((item) => text(item, itemLimit)).filter(Boolean).slice(0, limit)
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? Math.max(minimum, Math.min(maximum, result)) : null
}

function validateConstraintObject(value: unknown): TeacherConstraints {
  if (value === undefined || value === null) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Teacher constraints must be an object.')
  const source = value as Record<string, unknown>
  for (const key of Object.keys(source)) {
    if (!allowedConstraintKeys.has(key) || forbiddenConstraintKey.test(key)) throw new Error('Unsupported remediation context field.')
  }
  const constraints: TeacherConstraints = {
    languagePreference: text(source.languagePreference, 80) || undefined,
    localLanguageName: text(source.localLanguageName, 80) || undefined,
    preferredApproaches: arrayOfText(source.preferredApproaches, 10, 200),
    actualResources: arrayOfText(source.actualResources, 10, 200),
    resourceNotes: text(source.resourceNotes, 1000) || undefined,
    durationMinutes: boundedNumber(source.durationMinutes, 1, 600),
    numberOfSessions: boundedNumber(source.numberOfSessions, 1, 30),
  }
  return constraints
}

function resolveSettings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true }
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJsonObject(value: string) {
  const clean = stripCodeFence(value)
  try {
    const parsed = JSON.parse(clean)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(clean.slice(start, end + 1))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  }
  throw new Error('The remediation assistant did not return valid JSON.')
}

function cleanSuggestion(value: unknown) {
  const output = text(value, 2400)
  if (output.length < 8) throw new Error('The remediation assistant returned an incomplete suggestion.')
  // Keep the optional assistant from turning a generic suggestion into an
  // invented citation or a silently actionable web/resource instruction.
  if (/https?:\/\/|www\.|\b(?:page|pages|module|chapter)\s*\d+/i.test(output)) {
    throw new Error('The remediation assistant returned an unsupported citation.')
  }
  return output
}

function parseSuggestions(value: string) {
  const body = parseJsonObject(value)
  return {
    reteachingApproach: cleanSuggestion(body.reteachingApproach),
    practiceActivity: cleanSuggestion(body.practiceActivity),
    formativeRecheck: cleanSuggestion(body.formativeRecheck),
    enrichmentAlternative: cleanSuggestion(body.enrichmentAlternative),
  }
}

async function callWithFallback(apiKey: GeminiAccess, settings: ReturnType<typeof resolveSettings>, prompt: string) {
  try {
    return { output: await callGemini(apiKey, settings.preferredModel, prompt, { maxOutputTokens: 2200, temperature: 0.25 }), model: settings.preferredModel, fallbackUsed: false }
  } catch (error) {
    if (error instanceof SponsoredAiError) throw error
    if (error instanceof GeminiHttpError && isFallbackEligibleStatus(error.status)
      && fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)) {
      return { output: await callGemini(apiKey, settings.fallbackModel, prompt, { maxOutputTokens: 2200, temperature: 0.25 }), model: settings.fallbackModel, fallbackUsed: true }
    }
    throw error
  }
}

function promptFor(
  aggregate: {
    gradeLevel: string
    learningArea: string
    competencyText: string
    curriculumPeriodLabel: string
    cognitiveCategories: string[]
    mappedItems: number
    attempts: number
    correct: number
    incorrect: number
    percentageCorrect: number | null
    pointFacility: number | null
    numberOfLearners: number
  },
  constraints: TeacherConstraints,
) {
  const approaches = (constraints.preferredApproaches as string[] | undefined) ?? []
  const resources = (constraints.actualResources as string[] | undefined) ?? []
  const percentage = aggregate.percentageCorrect === null ? 'not available' : `${(aggregate.percentageCorrect * 100).toFixed(1)}%`
  const pointFacility = aggregate.pointFacility === null ? 'not available' : `${(aggregate.pointFacility * 100).toFixed(1)}%`
  return `You are an optional, teacher-reviewed instructional assistant. The deterministic GuroDesk application calculated the aggregate evidence below. Do not recalculate or make a learner judgment.

Return ONLY valid JSON with exactly these string fields:
{"reteachingApproach":"...","practiceActivity":"...","formativeRecheck":"...","enrichmentAlternative":"..."}

VERIFIED COMPETENCY: ${aggregate.competencyText}
Grade: ${aggregate.gradeLevel || 'not specified'}
Learning area: ${aggregate.learningArea || 'not specified'}
Curriculum-guide period: ${aggregate.curriculumPeriodLabel || 'not specified'}
Cognitive categories represented: ${aggregate.cognitiveCategories.join('; ') || 'not specified'}
Mapped items: ${aggregate.mappedItems}
Aggregate attempts: ${aggregate.attempts}
Aggregate correct: ${aggregate.correct}
Aggregate incorrect: ${aggregate.incorrect}
Aggregate percentage correct: ${percentage}
Aggregate point facility: ${pointFacility}
Number of learners in this result session: ${aggregate.numberOfLearners}
Teacher language preference: ${text(constraints.languagePreference, 80) || 'match the supplied context'}
Teacher local-language preference: ${text(constraints.localLanguageName, 80) || 'not specified'}
Teacher-preferred approaches: ${approaches.join('; ') || 'none listed'}
ACTUAL TEACHER-LISTED RESOURCES: ${resources.join('; ') || 'none listed'}
Teacher resource constraints: ${text(constraints.resourceNotes, 1000) || 'none listed'}
Minutes per session: ${constraints.durationMinutes ?? 'not specified'}
Number of sessions: ${constraints.numberOfSessions ?? 'not specified'}

Use neutral instructional language such as “additional evidence/practice may help.” Do not label a learner as weak, deficient, slow, disabled, incapable, or diagnosed. Do not include names, IDs, raw answers, answer sheets, per-learner scores, feedback, or histories; none were supplied. Do not invent books, modules, pages, websites, devices, school facts, local facts, or resources. A named resource may appear only if it is listed under ACTUAL TEACHER-LISTED RESOURCES. Suggestions are optional starting points for teacher review, editing, and acceptance.`
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * PostgREST deployments commonly cap a response at 1,000 rows.  The
 * aggregate assistant must not silently treat a 2,000-cell result as a
 * partial result, so load bounded deterministic pages (never one request per
 * answer) before reducing to counts and sums.
 */
async function loadOutcomeRows(
  client: ReturnType<typeof createClient<any>>,
  resultSessionId: string,
  userId: string,
  itemIds: string[],
) {
  const pageSize = 900
  const rows: Array<{
    learner_answer: unknown
    is_correct: boolean | null
    earned_points: unknown
    possible_points: unknown
  }> = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('result_item_outcomes')
      .select('item_id, learner_answer, is_correct, earned_points, possible_points')
      .eq('result_session_id', resultSessionId).eq('user_id', userId).in('item_id', itemIds)
      .order('item_id', { ascending: true }).order('participant_id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < pageSize) return rows
    if (rows.length >= 10000) throw new Error('Result outcome batch exceeds the supported analysis bound.')
  }
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
    const body = await req.json() as RequestBody
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Request body must be an object.' }, 400)
    const bodyKeys = Object.keys(body as Record<string, unknown>)
    if (bodyKeys.some((key) => !['resultSessionId', 'competencyId', 'teacherConstraints'].includes(key))) return json({ error: 'Only an owned result session, verified competency, and teacher constraints are accepted.' }, 400)
    const resultSessionId = text(body.resultSessionId, 80)
    const competencyId = text(body.competencyId, 160)
    if (!uuidPattern.test(resultSessionId) || !competencyId) return json({ error: 'A valid result session and competency are required.' }, 400)
    const constraints = validateConstraintObject(body.teacherConstraints)
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: session, error: sessionError } = await admin.from('result_sessions')
      .select('id, user_id, status, entry_mode, assessment_snapshot')
      .eq('id', resultSessionId).eq('user_id', userId).maybeSingle()
    if (sessionError) throw sessionError
    if (!session || session.status === 'archived') return json({ error: 'Owned result session not found.' }, 404)
    if (session.entry_mode === 'score_only') return json({ error: 'Item-level aggregate evidence is unavailable for score-only results.' }, 400)
    const snapshot = session.assessment_snapshot as Record<string, unknown>
    const items = Array.isArray(snapshot?.items) ? snapshot.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : []
    const mappedItems = items.filter((item) => String((item.competencySnapshot as Record<string, unknown> | undefined)?.id ?? '') === competencyId)
    if (mappedItems.length === 0) return json({ error: 'Verified competency is not mapped in this result session.' }, 404)
    const itemIds = mappedItems.map((item) => String(item.id)).filter(Boolean)
    const [outcomeRows, participantCountResult, credentialResult, settingsResult] = await Promise.all([
      loadOutcomeRows(admin, resultSessionId, userId, itemIds),
      admin.from('result_session_learners').select('id', { count: 'exact', head: true })
        .eq('result_session_id', resultSessionId).eq('user_id', userId),
      admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_settings').select('preferred_model, fallback_model, fallback_enabled').eq('user_id', userId).maybeSingle(),
    ])
    if (participantCountResult.error) throw participantCountResult.error
    if (credentialResult.error) throw credentialResult.error
    if (settingsResult.error) throw settingsResult.error
    // Read only the answer-presence bit needed for deterministic attempt
    // counts, then discard the raw answer field before constructing aggregate
    // values.  It is never included in the prompt or response.
    const outcomes = outcomeRows.map((outcome) => ({
      hasAnswer: outcome.learner_answer !== null,
      isCorrect: outcome.is_correct,
      earnedPoints: Number(outcome.earned_points ?? 0),
      possiblePoints: Number(outcome.possible_points ?? 0),
    }))
    const attemptedOutcomes = outcomes.filter((outcome) => outcome.hasAnswer)
    const correct = attemptedOutcomes.filter((outcome) => outcome.isCorrect === true).length
    const incorrect = attemptedOutcomes.filter((outcome) => outcome.isCorrect === false).length
    const attempts = attemptedOutcomes.length
    const numberOfLearners = participantCountResult.count ?? 0
    const earned = attemptedOutcomes.reduce((sum, outcome) => sum + outcome.earnedPoints, 0)
    // Sparse result rows represent omitted cells. Point facility follows the
    // deterministic item-analysis contract: earned points divided by the
    // possible points of attempted responses. Omitted cells are reported by
    // attempts/omissions and do not enter this denominator.
    const possible = attemptedOutcomes.reduce((sum, outcome) => sum + outcome.possiblePoints, 0)
    const aggregate = {
      gradeLevel: String(snapshot.gradeLevel ?? ''),
      learningArea: String(snapshot.learningArea ?? ''),
      competencyText: String(((mappedItems[0].competencySnapshot as Record<string, unknown> | undefined)?.text) ?? ''),
      curriculumPeriodLabel: String(((mappedItems[0].competencySnapshot as Record<string, unknown> | undefined)?.curriculumPeriodLabel) ?? ''),
      cognitiveCategories: [...new Set(mappedItems.map((item) => String(((item.cognitiveCategorySnapshot as Record<string, unknown> | undefined)?.label) ?? '')).filter(Boolean))],
      mappedItems: mappedItems.length,
      attempts,
      correct,
      incorrect,
      percentageCorrect: correct + incorrect > 0 ? correct / (correct + incorrect) : null,
      pointFacility: possible > 0 ? earned / possible : null,
      numberOfLearners,
    }
    const credential = credentialResult.data as CredentialRow | null
      const apiKey = await resolveGeminiAccess(credential, admin, userId, req, Deno.env.get('GURODESK_SPONSORED_GEMINI_KEY'))
    const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null)
    const generated = await callWithFallback(apiKey, settings, promptFor(aggregate, constraints))
    const suggestions = parseSuggestions(generated.output)
    // Model/fallback details are intentionally not returned as report content;
    // the teacher only receives reviewable suggestion text.
    void generated.model
    void generated.fallbackUsed
    return json(suggestions)
  } catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status)
    console.error('Remediation suggestion request failed', error)
    if (error instanceof GeminiHttpError && (error.status === 401 || error.status === 403)) return json({ error: 'The saved Gemini credential was rejected.' }, 502)
    return json({ error: error instanceof Error ? error.message : 'Remediation suggestions are unavailable.' }, 400)
  }
})
