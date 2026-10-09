import { resolveGeminiAccess, SponsoredAiError, type GeminiAccess } from '../_shared/sponsored-ai.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, fallbackAllowed, isAiModelId, isLiteModel, type AiModelId, type LiteAiModelId } from '../_shared/ai-models.ts'
import { callGemini, GeminiHttpError, isFallbackEligibleStatus } from '../_shared/gemini.ts'

type ElementInput = { id?: string; kind?: string; text?: string; context?: string; isFormula?: boolean; isMerged?: boolean; isMergedAnchor?: boolean }
type CredentialRow = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }
type SettingsRow = { preferred_model?: string; fallback_model?: string; fallback_enabled?: boolean }

const FIELDS = [
  ['teacherName', 'Teacher name', 'scalar'], ['teacherPosition', 'Teacher position/title', 'scalar'],
  ['schoolName', 'School', 'scalar'], ['region', 'Region', 'scalar'], ['division', 'Schools Division', 'scalar'],
  ['gradeLevel', 'Grade level', 'scalar'], ['sections', 'Section/s', 'scalar'], ['gradeSection', 'Grade level and section/s', 'scalar'],
  ['learningArea', 'Learning area/subject', 'scalar'], ['schoolYear', 'School year', 'scalar'],
  ['gradingTerm', 'School grading term', 'scalar'], ['curriculumPeriod', 'Curriculum-guide period', 'scalar'],
  ['tosTitle', 'TOS title', 'scalar'], ['assessmentTitle', 'Assessment title', 'scalar'],
  ['totalItems', 'Total test items', 'scalar'], ['weightingMethod', 'Weighting method', 'scalar'],
  ['competencyRowNumber', 'Row number column', 'column'], ['competencyCode', 'Competency code column', 'column'],
  ['competency', 'Competency text column', 'column'], ['rowCurriculumPeriod', 'Curriculum period column', 'column'],
  ['instructionalMinutes', 'Instructional minutes column', 'column'], ['weightPercent', 'Weight percentage column', 'column'],
  ...Array.from({ length: 8 }, (_, index) => [`cognitiveLabel${index + 1}`, `Cognitive category ${index + 1} heading`, 'scalar']),
  ...Array.from({ length: 8 }, (_, index) => [`cognitiveItems${index + 1}`, `Cognitive category ${index + 1} item-count column`, 'column']),
  ['itemCount', 'Number of items column', 'column'], ['itemPlacement', 'Item placement column', 'column'],
  ['rowNotes', 'Notes column', 'column'], ['totalWeight', 'Total weight', 'scalar'],
  ['preparedBy', 'Prepared by', 'scalar'], ['reviewedBy', 'Reviewed by', 'scalar'], ['notedBy', 'Noted by', 'scalar'],
] as const

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
function settings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true }
}
function parseObject(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(clean) as Record<string, unknown> } catch {}
  const start = clean.indexOf('{'); const end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>
  throw new Error('Gemini did not return valid JSON.')
}
async function callWithFallback(apiKey: GeminiAccess, configured: ReturnType<typeof settings>, prompt: string) {
  try { return { output: await callGemini(apiKey, configured.preferredModel, prompt, { maxOutputTokens: 7000, temperature: 0.1 }), model: configured.preferredModel, fallbackUsed: false } }
  catch (error) {
    if (error instanceof SponsoredAiError) throw error
    if (error instanceof GeminiHttpError && isFallbackEligibleStatus(error.status) && fallbackAllowed(configured.preferredModel, configured.fallbackModel, configured.fallbackEnabled)) {
      return { output: await callGemini(apiKey, configured.fallbackModel, prompt, { maxOutputTokens: 7000, temperature: 0.1 }), model: configured.fallbackModel, fallbackUsed: true }
    }
    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const body = await req.json() as { elements?: ElementInput[] }
    const elements = (body.elements ?? []).filter((item) => !item.isFormula && (!item.isMerged || item.isMergedAnchor)).slice(0, 320).map((item) => ({
      id: String(item.id ?? ''), kind: String(item.kind ?? ''), text: String(item.text ?? '').slice(0, 500), context: String(item.context ?? '').slice(0, 900),
    })).filter((item) => item.id && item.kind === 'worksheet_cell' && !item.text.startsWith('='))
    if (!elements.length) return json({ error: 'No usable XLSX cell structure was provided.' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase function environment is incomplete.' }, 500)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const [credentialResult, settingsResult] = await Promise.all([
      admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userData.user.id).maybeSingle(),
      admin.from('teacher_ai_settings').select('preferred_model, fallback_model, fallback_enabled').eq('user_id', userData.user.id).maybeSingle(),
    ])
    if (credentialResult.error) throw credentialResult.error
    if (settingsResult.error) throw settingsResult.error
    const credential = credentialResult.data as CredentialRow | null
    const apiKey = await resolveGeminiAccess(credential, admin, userData.user.id, req, Deno.env.get('GURODESK_SPONSORED_GEMINI_KEY'))
    const configured = settings((settingsResult.data ?? null) as SettingsRow | null)
    const fieldList = FIELDS.map(([key, label, kind]) => `${key}: ${label} [${kind}]`).join('\n')
    const structure = elements.map((item) => `${item.id} [${item.kind}] text=${JSON.stringify(item.text)} context=${JSON.stringify(item.context)}`).join('\n')
    const prompt = `Map the EXTRACTED CELL STRUCTURE of an existing teacher-owned XLSX Table of Specifications workbook to GuroDesk fields. Do not redesign the workbook, generate questions, or calculate any percentage/item allocation. Choose only supplied element IDs. For scalar fields choose an existing blank/value cell near its label. For column fields choose the existing column HEADER cell; the teacher will confirm the first/last existing data rows. Never invent a destination and omit ambiguous fields.\n\nFIELDS:\n${fieldList}\n\nEXTRACTED XLSX STRUCTURE (never raw workbook bytes):\n${structure}\n\nReturn only JSON:\n{"mappings":[{"fieldKey":"competency","elementId":"TOS!B8","mode":"table_column","confidence":0.95}]}`
    let result
    try { result = await callWithFallback(apiKey, configured, prompt) }
    catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status)
      if (error instanceof GeminiHttpError && error.status === 429) return json({ error: 'Gemini quota is unavailable for template analysis. Try the other Flash-Lite model or try again later.', code: 'AI_QUOTA_EXHAUSTED' }, 429)
      if (error instanceof GeminiHttpError && [400, 401, 403].includes(error.status)) return json({ error: 'Google rejected the saved Gemini key or model access. Test it in Settings → AI Assistant.', code: 'AI_KEY_INVALID' }, 401)
      throw error
    }
    const parsed = parseObject(result.output)
    const allowed = new Map(FIELDS.map(([key, , kind]) => [key, kind]))
    const elementIds = new Set(elements.map((item) => item.id))
    const seen = new Set<string>()
    const mappings = (Array.isArray(parsed.mappings) ? parsed.mappings : []).flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return []
      const item = raw as Record<string, unknown>; const fieldKey = String(item.fieldKey ?? ''); const elementId = String(item.elementId ?? '')
      if (!allowed.has(fieldKey) || !elementIds.has(elementId) || seen.has(fieldKey)) return []
      seen.add(fieldKey)
      return [{ fieldKey, elementId, mode: allowed.get(fieldKey) === 'column' ? 'table_column' : 'replace', confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)) }]
    })
    return json({ mappings, model: result.model, fallbackUsed: result.fallbackUsed })
  } catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status); console.error(error); return json({ error: 'Unable to analyze the TOS workbook structure.' }, 500) }
})
