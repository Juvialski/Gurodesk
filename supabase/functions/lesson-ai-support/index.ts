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

type RevisionSupportType = 'refine_clarity' | 'organize_text' | 'grammar_spelling' | 'format_text' | 'translate'
type SuggestionSupportType =
  | 'suggest_learning_objectives'
  | 'suggest_home_alternative'
  | 'suggest_pre_lesson'
  | 'suggest_lesson_flow'
  | 'suggest_contextualization'
  | 'suggest_inclusion'
  | 'suggest_formative_assessment'
  | 'suggest_evidence_of_learning'
  | 'suggest_next_steps'
  | 'suggest_extended_learning'
  | 'quick_draft'
type SupportType = RevisionSupportType | SuggestionSupportType

type RequestBody = {
  supportType?: SupportType
  sectionKey?: string
  text?: string
  targetLanguage?: string
  documentId?: string
  lessonContext?: {
    gradeLevel?: string
    learningArea?: string
    competencyText?: string
    performanceStandard?: string
    teacherIntent?: string
    curriculumPeriodLabel?: string
    gradingTermLabel?: string
    durationMinutes?: number
    numberOfSessions?: number
    learnerContext?: string
    currentFormativeAssessment?: string
    teachingSetup?: {
      languagePreference?: string
      localLanguageName?: string
      typicalClassProfile?: string
      availableTechnology?: string[]
      preferredApproaches?: string[]
      actualResources?: string[]
      resourceNotes?: string
    }
  }
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

const revisionSupport = new Set<RevisionSupportType>(['refine_clarity', 'organize_text', 'grammar_spelling', 'format_text', 'translate'])
const suggestionSupport = new Set<SuggestionSupportType>([
  'suggest_learning_objectives',
  'suggest_home_alternative',
  'suggest_pre_lesson',
  'suggest_lesson_flow',
  'suggest_contextualization',
  'suggest_inclusion',
  'suggest_formative_assessment',
  'suggest_evidence_of_learning',
  'suggest_next_steps',
  'suggest_extended_learning',
  'quick_draft',
])
const allowedSupport = new Set<SupportType>([...revisionSupport, ...suggestionSupport])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function instructionForRevision(type: RevisionSupportType, targetLanguage?: string) {
  switch (type) {
    case 'refine_clarity': return 'Improve clarity and concision without adding new instructional ideas, objectives, activities, assessments, strategies, resources, or judgments.'
    case 'organize_text': return 'Organize the teacher-authored text for readability. Preserve every instructional decision and do not add new instructional content.'
    case 'grammar_spelling': return 'Correct grammar, spelling, punctuation, and awkward wording only. Preserve meaning and instructional decisions.'
    case 'format_text': return 'Format the teacher-authored text into clear paragraphs or bullets without adding, deleting, or changing instructional decisions.'
    case 'translate': return `Translate the teacher-authored text into ${targetLanguage || 'the requested target language'} while preserving its meaning. Do not add instructional content.`
  }
}

function instructionForSuggestion(type: Exclude<SuggestionSupportType, 'quick_draft'>) {
  switch (type) {
    case 'suggest_learning_objectives': return 'Create three alternative objective sets aligned only to the verified competency. Make them observable, manageable for the stated lesson duration, and grade-appropriate. They are optional starting points for teacher selection and editing.'
    case 'suggest_home_alternative': return 'Create three alternative home-based or continuity options. Do not require or name any resource, platform, device, module, book, or material unless the teacher explicitly listed it as available.'
    case 'suggest_pre_lesson': return 'Create three brief pre-lesson or prior-knowledge activation options that directly prepare learners for the verified competency.'
    case 'suggest_lesson_flow': return 'Create three alternative lesson-flow options with realistic time allocations. Align each to the competency and any teacher-selected objectives. Respect the teacher\'s preferred approaches when provided.'
    case 'suggest_contextualization': return 'Create three possible contextualization or integration ideas. Keep them generic enough for teacher verification and do not invent local facts, community details, books, websites, or materials.'
    case 'suggest_inclusion': return 'Create three universal classroom-support options. Do not infer, diagnose, or claim any learner disability, condition, identity, or sensitive need. Use only class-level context supplied by the teacher.'
    case 'suggest_formative_assessment': return 'Create three formative-assessment options aligned to the verified competency and teacher-selected objectives. They should provide actionable evidence during the lesson.'
    case 'suggest_evidence_of_learning': return 'Create three concise descriptions of observable evidence that would show progress toward the selected competency and objectives.'
    case 'suggest_next_steps': return 'Create three conditional ways-forward options based on possible assessment evidence, including targeted reteaching/remediation and appropriate enrichment.'
    case 'suggest_extended_learning': return 'Create three optional extension, reinforcement, or remediation ideas tightly connected to the same competency. Do not require unlisted resources.'
  }
}

function resolveSettings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return {
    preferredModel,
    fallbackModel,
    fallbackEnabled: row?.fallback_enabled ?? true,
  }
}

function quotaMessage(model: string) {
  return `Gemini quota is currently unavailable for ${model}. Your lesson remains saved. Try the other Flash-Lite model or try again later.`
}

function compactList(items?: string[]) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 30)
}

function contextText(body: RequestBody) {
  const ctx = body.lessonContext ?? {}
  const setup = ctx.teachingSetup ?? {}
  const resources = compactList(setup.actualResources)
  const technology = compactList(setup.availableTechnology)
  const approaches = compactList(setup.preferredApproaches)
  return [
    ctx.gradeLevel ? `Grade: ${ctx.gradeLevel}` : '',
    ctx.learningArea ? `Learning area: ${ctx.learningArea}` : '',
    ctx.curriculumPeriodLabel ? `Curriculum-guide period: ${ctx.curriculumPeriodLabel}` : '',
    ctx.gradingTermLabel ? `School grading term: ${ctx.gradingTermLabel}` : '',
    ctx.competencyText ? `VERIFIED COMPETENCY: ${ctx.competencyText}` : '',
    ctx.performanceStandard ? `Performance-standard context: ${ctx.performanceStandard}` : '',
    ctx.teacherIntent ? `Current teacher-selected objectives/intention: ${ctx.teacherIntent}` : '',
    ctx.durationMinutes ? `Minutes per session: ${ctx.durationMinutes}` : '',
    ctx.numberOfSessions ? `Number of sessions: ${ctx.numberOfSessions}` : '',
    ctx.learnerContext ? `Teacher-provided class-level context: ${ctx.learnerContext}` : '',
    setup.languagePreference ? `Teacher language preference: ${setup.languagePreference}` : '',
    setup.localLanguageName ? `Teacher-specified local language: ${setup.localLanguageName}` : '',
    setup.typicalClassProfile ? `Reusable teacher-provided class profile: ${setup.typicalClassProfile}` : '',
    approaches.length ? `Teacher-preferred approaches: ${approaches.join('; ')}` : '',
    technology.length ? `TECHNOLOGY AVAILABILITY FOR FEASIBILITY ONLY: ${technology.join('; ')}` : 'TECHNOLOGY AVAILABILITY FOR FEASIBILITY ONLY: none listed',
    resources.length ? `ACTUAL TEACHER-LISTED RESOURCES: ${resources.join('; ')}` : 'ACTUAL TEACHER-LISTED RESOURCES: none listed',
    setup.resourceNotes ? `Teacher resource constraints: ${setup.resourceNotes}` : '',
    ctx.currentFormativeAssessment ? `Current formative-assessment plan: ${ctx.currentFormativeAssessment}` : '',
  ].filter(Boolean).join('\n')
}

function looksFilipino(text: string) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-záéíóúñ\s-]/g, ' ')} `
  const markers = [' ang ', ' mga ', ' ng ', ' sa ', ' ay ', ' upang ', ' mag-aaral', ' aralin', ' gawain', ' pagkatuto', ' natutukoy', ' naipapaliwanag', ' nakagagawa']
  return markers.reduce((score, marker) => score + (normalized.includes(marker) ? 1 : 0), 0) >= 3
}

function outputLanguageInstruction(body: RequestBody, teacherText = '') {
  const ctx = body.lessonContext ?? {}
  const setup = ctx.teachingSetup ?? {}
  const preference = (setup.languagePreference ?? 'Auto').trim().toLowerCase()
  const localLanguage = setup.localLanguageName?.trim()

  if (preference === 'filipino') {
    return 'Write all generated planning suggestions in natural Filipino suitable for a Philippine classroom. Keep official competency wording exactly as supplied when quoting it.'
  }
  if (preference === 'english + filipino') {
    return 'Write in natural Filipino-English bilingual classroom language. Do not force code-switching into every sentence; keep technical terms clear and teacher-editable.'
  }
  if (preference === 'mother tongue / local language') {
    if (localLanguage) return `Write the generated suggestions in ${localLanguage}. Keep official curriculum terms exactly as supplied when a confident local-language equivalent is uncertain; do not invent translations.`
    return 'Follow the dominant language already used in the lesson text. If there is not enough text to determine it, use Filipino and keep official curriculum terms as supplied.'
  }
  if (preference === 'english') {
    return 'Write all generated planning suggestions in clear natural English.'
  }

  const sample = [teacherText, ctx.teacherIntent, ctx.learnerContext, ctx.learningArea].filter(Boolean).join('\n')
  const subjectIsFilipino = (ctx.learningArea ?? '').toLowerCase().includes('filipino')
  if (subjectIsFilipino || looksFilipino(sample)) {
    return 'Automatically match this lesson in Filipino. Write all generated planning suggestions in natural Filipino and preserve official competency wording when quoted.'
  }
  return 'Automatically match the lesson language. Use clear natural English unless the supplied lesson text is predominantly Filipino.'
}

const sharedSuggestionGuardrail = `You are GuroDesk, a planning-suggestion assistant for a Philippine DepEd teacher. Produce OPTIONAL starting points, never a claim that the teacher has made the final instructional decision. Ground suggestions in the VERIFIED COMPETENCY and supplied context. The teacher will select, edit, validate, and approve the final plan.

RESOURCE ACCURACY RULE — CRITICAL: Never invent or cite a book, module, title, author, page number, worksheet, website, platform, app, device, equipment, manipulative, laboratory material, or other resource. A specific resource or technology may appear in a suggestion only if it is explicitly listed under ACTUAL TEACHER-LISTED RESOURCES for THIS LESSON. TECHNOLOGY AVAILABILITY is feasibility context only and is not permission to name or require a device. If no lesson resource is listed, design suggestions that require no named or special resource.

LEARNER PRIVACY/JUDGMENT RULE: Never infer diagnoses, disabilities, identities, personal circumstances, or sensitive learner needs. Use only class-level context supplied by the teacher. Inclusion suggestions must be universal options rather than claims about particular learners.

SOURCE RULE: Do not invent curriculum codes, standards, DepEd policy quotations, citations, local facts, or official requirements. Do not claim that an AI-generated suggestion is officially approved.`

function stripCodeFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseJsonObject(text: string): Record<string, unknown> {
  const clean = stripCodeFence(text)
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
  throw new Error('Gemini did not return valid structured JSON.')
}

function cleanSuggestions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => typeof item === 'string' ? item.trim() : '').filter((item) => item.length >= 8).slice(0, 4)
}

function cleanDraft(value: Record<string, unknown>) {
  const allowed = [
    'lessonTitle',
    'learningObjectives',
    'homeBasedAlternative',
    'preLessonActivity',
    'lessonFlow',
    'integrationContextualization',
    'inclusionAccommodations',
    'formativeAssessments',
    'evidenceOfLearning',
    'nextSteps',
    'extendedLearning',
  ]
  const draft: Record<string, string> = {}
  for (const key of allowed) {
    const raw = value[key]
    if (typeof raw === 'string' && raw.trim().length >= 4) draft[key] = raw.trim()
  }
  return draft
}

async function callWithFallback(apiKey: string, settings: ReturnType<typeof resolveSettings>, prompt: string, maxOutputTokens: number) {
  let modelUsed: AiModelId = settings.preferredModel
  let fallbackUsed = false
  let output: string
  try {
    output = await callGemini(apiKey, settings.preferredModel, prompt, { maxOutputTokens, temperature: 0.35 })
  } catch (error) {
    if (
      error instanceof GeminiHttpError
      && isFallbackEligibleStatus(error.status)
      && fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)
    ) {
      output = await callGemini(apiKey, settings.fallbackModel, prompt, { maxOutputTokens, temperature: 0.35 })
      modelUsed = settings.fallbackModel
      fallbackUsed = true
    } else {
      throw error
    }
  }
  return { output, modelUsed, fallbackUsed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const body = await req.json() as RequestBody
    const supportType = body.supportType
    const text = body.text?.trim() ?? ''
    if (!supportType || !allowedSupport.has(supportType)) return json({ error: 'Unsupported AI support task.' }, 400)
    if (revisionSupport.has(supportType as RevisionSupportType) && text.length < 10) return json({ error: 'Enter the information first before requesting text polishing.' }, 400)
    if (text.length > 12000) return json({ error: 'Section is too long for one AI request.' }, 400)
    if (suggestionSupport.has(supportType as SuggestionSupportType) && !body.lessonContext?.competencyText?.trim()) {
      return json({ error: 'Choose a verified competency before requesting planning suggestions.' }, 400)
    }

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
    if (!credentialResult.data) {
      return json({ error: 'Connect your Gemini API key in Settings → AI Assistant before using AI support.', code: 'AI_KEY_NOT_CONFIGURED' }, 409)
    }

    const credential = credentialResult.data as CredentialRow
    let apiKey: string
    try {
      apiKey = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)
    } catch (error) {
      console.error('Unable to decrypt teacher Gemini credential', error)
      return json({ error: 'Your saved Gemini key can no longer be decrypted. Replace it in Settings → AI Assistant.', code: 'AI_KEY_RECONNECT_REQUIRED' }, 409)
    }

    const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null)
    const context = contextText(body)
    const declarationCategory = suggestionSupport.has(supportType as SuggestionSupportType)
      ? 'suggested'
      : supportType === 'refine_clarity' || supportType === 'organize_text' ? 'limited' : 'guided'

    let prompt: string
    let maxOutputTokens = 4096
    if (revisionSupport.has(supportType as RevisionSupportType)) {
      const revisionLanguageRule = supportType === 'translate'
        ? `Translation target: ${body.targetLanguage || 'the requested language'}.`
        : 'LANGUAGE RULE: Preserve the language of the teacher-authored text. Do not translate it unless the selected task is Translate.'
      prompt = `You are a text-support assistant. The teacher supplied the content and remains responsible for its accuracy. Perform only the requested text operation. Do not add new facts, resources, citations, objectives, activities, assessments, strategies, learner judgments, or instructional decisions. Return only the revised text.\n\n${revisionLanguageRule}\nTask: ${instructionForRevision(supportType as RevisionSupportType, body.targetLanguage)}\n${context ? `\nContext for preserving meaning only:\n${context}\n` : ''}\nTeacher text:\n---\n${text}\n---`
    } else if (supportType === 'quick_draft') {
      maxOutputTokens = 7500
      prompt = `${sharedSuggestionGuardrail}\n\nOUTPUT LANGUAGE RULE: ${outputLanguageInstruction(body, text)}\n\nPrepare ONE coherent quick-draft set of OPTIONAL suggestions. This is a review shortcut, not a final lesson plan. Do not include references or learning resources; those fields are teacher-controlled. Do not generate a post-lesson reflection because teaching has not happened yet. Existing teacher text, if any, must not be treated as something to overwrite automatically.\n\n${context}\n\nReturn ONLY valid JSON with exactly this shape and string values:\n{\n  "lessonTitle": "...",\n  "learningObjectives": "...",\n  "homeBasedAlternative": "...",\n  "preLessonActivity": "...",\n  "lessonFlow": "...",\n  "integrationContextualization": "...",\n  "inclusionAccommodations": "...",\n  "formativeAssessments": "...",\n  "evidenceOfLearning": "...",\n  "nextSteps": "...",\n  "extendedLearning": "..."\n}\n\nMake lessonFlow practical for the stated minutes/sessions. Use conditional wording for nextSteps. Never insert a specific resource unless teacher-listed in the context.`
    } else {
      prompt = `${sharedSuggestionGuardrail}\n\nOUTPUT LANGUAGE RULE: ${outputLanguageInstruction(body, text)}\n\nTask: ${instructionForSuggestion(supportType as Exclude<SuggestionSupportType, 'quick_draft'>)}\n\n${context}\n${text ? `\nCurrent teacher text, if they want alternatives:\n---\n${text}\n---\n` : ''}\nReturn ONLY valid JSON in this shape: {"suggestions":["option 1","option 2","option 3"]}. Each option must be self-contained and editable. Do not include commentary outside the JSON.`
    }

    let result: Awaited<ReturnType<typeof callWithFallback>>
    try {
      result = await callWithFallback(apiKey, settings, prompt, maxOutputTokens)
    } catch (error) {
      console.error('Gemini support error', error)
      if (error instanceof GeminiHttpError && error.status === 429) {
        return json({ error: quotaMessage(settings.preferredModel), code: 'AI_QUOTA_EXHAUSTED' }, 429)
      }
      if (error instanceof GeminiHttpError && [400, 401, 403].includes(error.status)) {
        return json({ error: 'Google rejected your saved Gemini key or model access. Test or replace the key in Settings → AI Assistant.', code: 'AI_KEY_INVALID' }, 401)
      }
      return json({ error: 'Gemini support is temporarily unavailable. Your lesson has not been changed.', code: 'AI_PROVIDER_UNAVAILABLE' }, 502)
    }

    const responseBase = {
      model: result.modelUsed,
      preferredModel: settings.preferredModel,
      fallbackUsed: result.fallbackUsed,
      thinkingLevel: isLiteModel(result.modelUsed) ? 'high' : 'model_default',
      supportType,
      declarationCategory,
    }

    let responseBody: Record<string, unknown>
    if (revisionSupport.has(supportType as RevisionSupportType)) {
      responseBody = { ...responseBase, output: result.output.trim() }
    } else if (supportType === 'quick_draft') {
      try {
        const draft = cleanDraft(parseJsonObject(result.output))
        if (Object.keys(draft).length < 6) throw new Error('Quick Draft did not contain enough usable sections.')
        responseBody = { ...responseBase, draft }
      } catch (error) {
        console.error('Quick Draft parse error', error, result.output.slice(0, 500))
        return json({ error: 'Gemini returned a malformed Quick Draft. Please try again.', code: 'AI_OUTPUT_INVALID' }, 502)
      }
    } else {
      try {
        const suggestions = cleanSuggestions(parseJsonObject(result.output).suggestions)
        if (suggestions.length < 2) throw new Error('Not enough suggestions returned.')
        responseBody = { ...responseBase, suggestions }
      } catch (error) {
        console.error('Suggestion parse error', error, result.output.slice(0, 500))
        return json({ error: 'Gemini returned malformed suggestions. Please try again.', code: 'AI_OUTPUT_INVALID' }, 502)
      }
    }

    const documentId = body.documentId?.trim()
    if (documentId) {
      const { error: auditError } = await userClient.from('lesson_plan_ai_events').insert({
        document_id: documentId,
        user_id: userId,
        support_type: supportType,
        section_key: body.sectionKey || 'unknown',
        declaration_category: declarationCategory,
        provider: 'google',
        model: result.modelUsed,
      })
      if (auditError) console.error('AI audit insert failed', auditError.message)
    }

    return json(responseBody)
  } catch (error) {
    console.error(error)
    return json({ error: 'Unable to process AI support request.' }, 500)
  }
})
