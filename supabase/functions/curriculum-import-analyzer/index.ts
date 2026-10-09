import { resolveGeminiAccess, SponsoredAiError, type GeminiAccess, geminiFetch } from '../_shared/sponsored-ai.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MODEL,
  fallbackAllowed,
  generationConfigFor,
  isAiModelId,
  isLiteModel,
  type AiModelId,
  type GeminiSchema,
  type LiteAiModelId,
} from '../_shared/ai-models.ts'
import {
  extractGeminiText,
  GeminiHttpError,
  GeminiResponseError,
  isFallbackEligibleStatus,
  parseGeminiJson,
} from '../_shared/gemini.ts'

type CredentialRow = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }
type SettingsRow = { preferred_model?: string; fallback_model?: string; fallback_enabled?: boolean }
type ImportRow = {
  id: string
  user_id: string
  status: string
  source_kind: 'upload' | 'paste' | 'manual'
  curriculum_mode: 'custom' | 'hybrid'
  base_curriculum_version_id: string | null
  title: string
  organization_name: string
  school_year: string
  grade_level: string
  learning_area: string
  original_filename: string | null
  mime_type: string | null
  storage_path: string | null
  file_size_bytes: number
}

const MAX_TEXT_CHARS = 350_000
const MAX_PDF_BYTES = 15 * 1024 * 1024
const BUCKET = 'custom-curricula'

const textField: GeminiSchema = { type: 'STRING' }
const nullableText: GeminiSchema = { type: 'STRING', nullable: true }
const nullableInteger: GeminiSchema = { type: 'INTEGER', nullable: true }
const curriculumSchema: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    schemaVersion: { type: 'INTEGER', enum: [1] },
    curriculumMode: { type: 'STRING', enum: ['custom', 'hybrid'] },
    title: textField,
    organizationName: textField,
    schoolYear: textField,
    gradeLevel: textField,
    learningArea: textField,
    periods: {
      type: 'ARRAY', minItems: 1, maxItems: 16,
      items: {
        type: 'OBJECT',
        properties: {
          key: textField,
          label: textField,
          sequence: { type: 'INTEGER' },
          periodType: { type: 'STRING', enum: ['term', 'quarter', 'semester', 'year'] },
        },
        required: ['key', 'label', 'sequence', 'periodType'],
      },
    },
    domains: {
      type: 'ARRAY', minItems: 1, maxItems: 120,
      items: {
        type: 'OBJECT',
        properties: { key: textField, code: nullableText, name: textField, sortOrder: { type: 'INTEGER' } },
        required: ['key', 'code', 'name', 'sortOrder'],
      },
    },
    standards: {
      type: 'ARRAY', minItems: 0, maxItems: 800,
      items: {
        type: 'OBJECT',
        properties: {
          standardType: { type: 'STRING', enum: ['content', 'performance', 'stage', 'key_stage', 'other'] },
          standardText: textField,
          domainKey: nullableText,
          periodKey: nullableText,
          sortOrder: { type: 'INTEGER' },
          sourcePage: nullableInteger,
        },
        required: ['standardType', 'standardText', 'domainKey', 'periodKey', 'sortOrder', 'sourcePage'],
      },
    },
    competencies: {
      type: 'ARRAY', minItems: 1, maxItems: 2500,
      items: {
        type: 'OBJECT',
        properties: {
          competencyCode: nullableText,
          competencyText: textField,
          domainKey: nullableText,
          periodKey: nullableText,
          sortOrder: { type: 'INTEGER' },
          sourcePage: nullableInteger,
        },
        required: ['competencyCode', 'competencyText', 'domainKey', 'periodKey', 'sortOrder', 'sourcePage'],
      },
    },
    warnings: { type: 'ARRAY', minItems: 0, maxItems: 30, items: textField },
  },
  required: [
    'schemaVersion', 'curriculumMode', 'title', 'organizationName', 'schoolYear',
    'gradeLevel', 'learningArea', 'periods', 'domains', 'standards', 'competencies', 'warnings',
  ],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function settings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true }
}

function base64(bytes: Uint8Array) {
  let binary = ''
  const block = 0x8000
  for (let index = 0; index < bytes.length; index += block) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + block, bytes.length)))
  }
  return btoa(binary)
}

function boundedText(value: unknown, max: number) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/\u0000/g, '').slice(0, max).trim() : ''
}

function promptFor(row: ImportRow) {
  return `You are structuring a TEACHER-PROVIDED school curriculum for GuroDesk. This may be a private-school curriculum, an international/school-developed scope and sequence, or school enrichment layered on an official base curriculum.

CRITICAL RULES:
- Extract only what the supplied document/text actually supports. Do not invent competencies, standards, codes, periods, page numbers, or official status.
- Preserve the meaning and wording of competencies/objectives. Light cleanup of whitespace is allowed; paraphrasing that changes meaning is not.
- If the source is ambiguous, keep the closest literal text and add a warning.
- The teacher will review every extracted record before approval. Your output is a DRAFT, never authoritative by itself.
- Do not claim school-created content is DepEd content.
- For curriculumMode=hybrid, return only the SCHOOL-SPECIFIC material found in this source. GuroDesk will deterministically inherit the selected base curriculum separately.
- periodKey/domainKey values must refer to keys you emit in periods/domains, or be null.
- sourcePage must be null unless the supplied PDF clearly supports that page number.
- Use concise stable keys such as q1, semester-1, algebra, geometry.

TEACHER METADATA (use as defaults; source content wins only when clearly explicit):
mode=${row.curriculum_mode}
title=${JSON.stringify(row.title)}
organization=${JSON.stringify(row.organization_name)}
schoolYear=${JSON.stringify(row.school_year)}
gradeLevel=${JSON.stringify(row.grade_level)}
learningArea=${JSON.stringify(row.learning_area)}
filename=${JSON.stringify(row.original_filename ?? '')}

Return the structured curriculum JSON only.`
}

async function geminiRequest(
  apiKey: GeminiAccess,
  model: AiModelId,
  prompt: string,
  text: string | null,
  pdf: Uint8Array | null,
) {
  const parts: Array<Record<string, unknown>> = []
  if (pdf) parts.push({ inline_data: { mime_type: 'application/pdf', data: base64(pdf) } })
  if (text) parts.push({ text: `SOURCE TEXT:\n${text}` })
  parts.push({ text: prompt })

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const response = await geminiFetch(apiKey, endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: generationConfigFor(model, {
        maxOutputTokens: 12288,
        responseMimeType: 'application/json',
        responseSchema: curriculumSchema,
      }),
    }),
  })
  if (!response.ok) throw new GeminiHttpError(response.status, await response.text())
  const result = await response.json()
  return parseGeminiJson(extractGeminiText(result).text)
}

async function callWithFallback(
  apiKey: GeminiAccess,
  configured: ReturnType<typeof settings>,
  prompt: string,
  text: string | null,
  pdf: Uint8Array | null,
) {
  try {
    return { review: await geminiRequest(apiKey, configured.preferredModel, prompt, text, pdf), model: configured.preferredModel, fallbackUsed: false }
  } catch (error) {
    if (error instanceof SponsoredAiError) throw error
    if (!(error instanceof GeminiHttpError)
      || !isFallbackEligibleStatus(error.status)
      || !fallbackAllowed(configured.preferredModel, configured.fallbackModel, configured.fallbackEnabled)) throw error

    return {
      review: await geminiRequest(apiKey, configured.fallbackModel, prompt, text, pdf),
      model: configured.fallbackModel,
      fallbackUsed: true,
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const body = await req.json() as { importId?: string; extractedText?: string | null }
    const importId = boundedText(body.importId, 80)
    if (!/^[0-9a-f-]{36}$/i.test(importId)) return json({ error: 'A valid curriculum import ID is required.' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase function environment is incomplete.' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: importData, error: importError } = await admin.from('custom_curriculum_imports')
      .select('id,user_id,status,source_kind,curriculum_mode,base_curriculum_version_id,title,organization_name,school_year,grade_level,learning_area,original_filename,mime_type,storage_path,file_size_bytes')
      .eq('id', importId)
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (importError) throw importError
    if (!importData) return json({ error: 'Curriculum import was not found.' }, 404)
    const row = importData as ImportRow
    if (!['draft', 'analyzing', 'analyzed'].includes(row.status)) return json({ error: 'This curriculum import can no longer be analyzed.' }, 409)

    const [credentialResult, settingsResult] = await Promise.all([
      admin.from('teacher_ai_credentials').select('api_key_ciphertext,api_key_iv,encryption_key_source').eq('user_id', userData.user.id).maybeSingle(),
      admin.from('teacher_ai_settings').select('preferred_model,fallback_model,fallback_enabled').eq('user_id', userData.user.id).maybeSingle(),
    ])
    if (credentialResult.error) throw credentialResult.error
    if (settingsResult.error) throw settingsResult.error

    const credential = credentialResult.data as CredentialRow | null
    const apiKey = await resolveGeminiAccess(credential, admin, userData.user.id, req, Deno.env.get('GURODESK_SPONSORED_GEMINI_KEY'))
    const configured = settings((settingsResult.data ?? null) as SettingsRow | null)

    let sourceText = boundedText(body.extractedText, MAX_TEXT_CHARS) || null
    let pdfBytes: Uint8Array | null = null
    if (row.storage_path && !row.storage_path.startsWith(`${userData.user.id}/${row.id}/`)) {
      return json({ error: 'The curriculum source path is invalid for this teacher.', code: 'INVALID_SOURCE_PATH' }, 403)
    }
    if (row.mime_type === 'application/pdf') {
      if (!row.storage_path) return json({ error: 'The uploaded PDF source is missing.' }, 400)
      if (Number(row.file_size_bytes) > MAX_PDF_BYTES) return json({ error: 'PDF curriculum files must be 15 MB or smaller for one-pass analysis.' }, 400)
      const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(row.storage_path)
      if (downloadError) throw downloadError
      pdfBytes = new Uint8Array(await blob.arrayBuffer())
      if (!pdfBytes.length || pdfBytes.length > MAX_PDF_BYTES) return json({ error: 'The uploaded PDF is empty or too large.' }, 400)
    } else if (!sourceText) {
      return json({ error: 'No readable curriculum text was supplied. Re-upload a readable DOCX/XLSX/CSV/TXT file or use PDF.', code: 'NO_READABLE_TEXT' }, 400)
    }

    await admin.from('custom_curriculum_imports').update({ status: 'analyzing', error_code: null }).eq('id', row.id).eq('user_id', row.user_id)

    let result
    try {
      result = await callWithFallback(apiKey, configured, promptFor(row), sourceText, pdfBytes)
    } catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status)
      const code = error instanceof GeminiHttpError
        ? error.status === 429 ? 'AI_QUOTA_EXHAUSTED' : [400, 401, 403].includes(error.status) ? 'AI_REQUEST_REJECTED' : 'AI_PROVIDER_ERROR'
        : error instanceof GeminiResponseError ? error.category : 'AI_ANALYSIS_FAILED'
      await admin.from('custom_curriculum_imports').update({ status: 'draft', error_code: code }).eq('id', row.id).eq('user_id', row.user_id)
      if (error instanceof GeminiHttpError && error.status === 429) return json({ error: 'Gemini quota is unavailable for curriculum analysis. Try again later or use manual curriculum entry.', code }, 429)
      if (error instanceof GeminiHttpError && [400, 401, 403].includes(error.status)) return json({ error: 'Google rejected the saved Gemini key, model access, or document request. Test the API key in Settings → AI Assistant.', code }, 400)
      if (error instanceof GeminiHttpError && error.status === 404) return json({ error: 'The selected Gemini model could not process the curriculum request. Check your saved preferred/fallback model settings in Settings → AI Assistant.', code: 'AI_MODEL_UNAVAILABLE' }, 409)
      if (error instanceof GeminiResponseError && error.category === 'MAX_TOKENS') return json({ error: 'Gemini stopped before completing the curriculum structure. Use a smaller source section or manual entry.', code }, 422)
      if (error instanceof GeminiResponseError) return json({ error: 'Gemini did not return a usable structured curriculum. No curriculum was approved.', code }, 422)
      throw error
    }

    const review = {
      ...result.review,
      schemaVersion: 1,
      curriculumMode: row.curriculum_mode,
      title: boundedText(result.review.title, 240) || row.title || 'School curriculum',
      organizationName: boundedText(result.review.organizationName, 240) || row.organization_name,
      schoolYear: boundedText(result.review.schoolYear, 20) || row.school_year,
      gradeLevel: boundedText(result.review.gradeLevel, 80) || row.grade_level,
      learningArea: boundedText(result.review.learningArea, 160) || row.learning_area,
    }

    const { error: updateError } = await admin.from('custom_curriculum_imports').update({
      status: 'analyzed',
      analysis_json: review,
      review_json: review,
      analysis_model: result.model,
      fallback_used: result.fallbackUsed,
      error_code: null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id).eq('user_id', row.user_id)
    if (updateError) throw updateError

    return json({ review, model: result.model, fallbackUsed: result.fallbackUsed })
  } catch (error) {
    if (error instanceof SponsoredAiError) return json({ error: error.message, code: error.code }, error.status)
    console.error(error)
    return json({ error: 'Unable to analyze this curriculum source.' }, 500)
  }
})
