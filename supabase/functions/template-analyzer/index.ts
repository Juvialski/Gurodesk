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

type ElementInput = {
  id?: string
  kind?: string
  text?: string
  context?: string
  suggestedMode?: string
}

type RequestBody = {
  documentType?: 'lesson_plan' | 'tos'
  elements?: ElementInput[]
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

const LESSON_FIELDS = [
  ['teacherName', 'Teacher name'], ['teacherPosition', 'Teacher position/title'], ['schoolName', 'School'],
  ['region', 'Region'], ['division', 'Schools Division'], ['gradeLevel', 'Grade level'], ['sections', 'Section/s'],
  ['gradeSection', 'Grade level and section/s'], ['learningArea', 'Learning area/subject'], ['lessonTitle', 'Lesson title'],
  ['lessonDate', 'Lesson date'], ['weekSchedule', 'Week/schedule'], ['schoolYear', 'School year'],
  ['gradingTerm', 'School grading term'], ['curriculumPeriod', 'Curriculum-guide period'],
  ['sessionsDuration', 'Number of sessions/duration'], ['references', 'References'], ['competency', 'Learning competency'],
  ['performanceStandard', 'Performance standard'], ['learningObjectives', 'Learning objectives/intentions'],
  ['learnerContext', 'Learner context/readiness'], ['preLessonActivity', 'Pre-lesson activity'],
  ['lessonFlow', 'Lesson flow/learning experience'], ['learningResources', 'Learning resources/materials'],
  ['contextualization', 'Integration/contextualization'], ['inclusionAccommodations', 'Inclusion/accommodations'],
  ['homeBasedAlternative', 'Home-based/continuity alternative'], ['formativeAssessment', 'Formative assessment'],
  ['evidenceOfLearning', 'Evidence of learning'], ['extendedLearning', 'Extended learning'],
  ['nextSteps', 'Next steps/intervention'], ['reflection', 'Reflection'], ['preparedBy', 'Prepared by'],
  ['reviewedBy', 'Reviewed by'], ['notedBy', 'Noted by'],
] as const

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function resolveSettings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true }
}

function stripCodeFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseObject(text: string) {
  const clean = stripCodeFence(text)
  try { return JSON.parse(clean) as Record<string, unknown> } catch {}
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
  throw new Error('Gemini did not return valid JSON.')
}

async function callWithFallback(apiKey: string, settings: ReturnType<typeof resolveSettings>, prompt: string) {
  try {
    return { output: await callGemini(apiKey, settings.preferredModel, prompt, { maxOutputTokens: 7000, temperature: 0.1 }), model: settings.preferredModel, fallbackUsed: false }
  } catch (error) {
    if (error instanceof GeminiHttpError && isFallbackEligibleStatus(error.status) && fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)) {
      return { output: await callGemini(apiKey, settings.fallbackModel, prompt, { maxOutputTokens: 7000, temperature: 0.1 }), model: settings.fallbackModel, fallbackUsed: true }
    }
    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const body = await req.json() as RequestBody
    if (body.documentType !== 'lesson_plan') return json({ error: 'Phase 3.7 currently analyzes DOCX lesson-plan templates. TOS/XLSX mapping is enabled in the schema and will be activated in Phase 4.' }, 400)
    const elements = (body.elements ?? []).slice(0, 220).map((item) => ({
      id: String(item.id ?? ''),
      kind: String(item.kind ?? ''),
      text: String(item.text ?? '').slice(0, 500),
      context: String(item.context ?? '').slice(0, 900),
      suggestedMode: item.suggestedMode === 'append_after_label' ? 'append_after_label' : 'replace',
    })).filter((item) => item.id)
    if (!elements.length) return json({ error: 'No usable DOCX structure was provided.' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase function environment is incomplete.' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const userId = userData.user.id
    const [credentialResult, settingsResult] = await Promise.all([
      admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_settings').select('preferred_model, fallback_model, fallback_enabled').eq('user_id', userId).maybeSingle(),
    ])
    if (credentialResult.error) throw credentialResult.error
    if (settingsResult.error) throw settingsResult.error
    if (!credentialResult.data) return json({ error: 'Connect your Gemini API key before analyzing a document template.', code: 'AI_KEY_NOT_CONFIGURED' }, 409)

    const credential = credentialResult.data as CredentialRow
    const apiKey = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)
    const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null)

    const fieldList = LESSON_FIELDS.map(([key, label]) => `${key}: ${label}`).join('\n')
    const structure = elements.map((item) => `${item.id} [${item.kind}] text=${JSON.stringify(item.text)} context=${JSON.stringify(item.context)} suggestedMode=${item.suggestedMode}`).join('\n')
    const prompt = `You are mapping an EXISTING teacher-owned DOCX lesson-plan template to GuroDesk fields. You are NOT redesigning the template and NOT generating lesson content. Choose only element IDs that exist in the supplied structure. Prefer blank value cells adjacent to labels over label cells. If the only suitable target contains a label plus underscores/dots or ends with a colon, use mode "append_after_label"; otherwise use "replace". Do not map a field when the template does not clearly contain a destination for it. Never map two fields to the same element unless the template clearly combines those values (for example gradeSection instead of separate gradeLevel and sections). Confidence must be 0 to 1.\n\nAVAILABLE GURODESK FIELDS:\n${fieldList}\n\nDOCX STRUCTURE:\n${structure}\n\nReturn ONLY valid JSON with this shape:\n{"mappings":[{"fieldKey":"teacherName","elementId":"t0r1c1","mode":"replace","confidence":0.95}]}\nNo commentary.`

    let result
    try {
      result = await callWithFallback(apiKey, settings, prompt)
    } catch (error) {
      if (error instanceof GeminiHttpError && error.status === 429) return json({ error: 'Gemini quota is unavailable for template analysis. Try the other Flash-Lite model or try again later.', code: 'AI_QUOTA_EXHAUSTED' }, 429)
      if (error instanceof GeminiHttpError && [400, 401, 403].includes(error.status)) return json({ error: 'Google rejected the saved Gemini key or model access. Test the key in Settings → AI Assistant.', code: 'AI_KEY_INVALID' }, 401)
      throw error
    }

    const parsed = parseObject(result.output)
    const allowedFields = new Set(LESSON_FIELDS.map(([key]) => key))
    const allowedElements = new Map(elements.map((item) => [item.id, item]))
    const rawMappings = Array.isArray(parsed.mappings) ? parsed.mappings : []
    const seenFields = new Set<string>()
    const mappings = rawMappings.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return []
      const item = raw as Record<string, unknown>
      const fieldKey = String(item.fieldKey ?? '')
      const elementId = String(item.elementId ?? '')
      if (!allowedFields.has(fieldKey as typeof LESSON_FIELDS[number][0]) || !allowedElements.has(elementId) || seenFields.has(fieldKey)) return []
      seenFields.add(fieldKey)
      const source = allowedElements.get(elementId)!
      return [{
        fieldKey,
        elementId,
        mode: item.mode === 'append_after_label' ? 'append_after_label' : source.suggestedMode,
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      }]
    })

    return json({ mappings, model: result.model, fallbackUsed: result.fallbackUsed })
  } catch (error) {
    console.error(error)
    return json({ error: 'Unable to analyze the document template.' }, 500)
  }
})
