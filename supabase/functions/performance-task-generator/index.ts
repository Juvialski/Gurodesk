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
import { callGemini, GeminiHttpError, GeminiResponseError, isFallbackEligibleStatus, parseGeminiJson } from '../_shared/gemini.ts'

type Row = Record<string, unknown>
type CredentialRow = { api_key_ciphertext: string; api_key_iv: string; encryption_key_source: EncryptionKeySource }
type SettingsRow = { preferred_model?: string; fallback_model?: string; fallback_enabled?: boolean }
type PreferenceRow = { language_preference?: string; local_language_name?: string; preferred_approaches?: unknown; actual_resources?: unknown; available_technology?: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function object(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function clean(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function list(value: unknown, maxItems = 30, maxLength = 500) {
  return Array.isArray(value) ? value.map((entry) => clean(entry, maxLength)).filter(Boolean).slice(0, maxItems) : []
}

function resolveSettings(row: SettingsRow | null) {
  const preferredModel: AiModelId = isAiModelId(row?.preferred_model) ? row!.preferred_model as AiModelId : DEFAULT_MODEL
  const fallbackModel: LiteAiModelId = isLiteModel(row?.fallback_model) ? row!.fallback_model as LiteAiModelId : DEFAULT_FALLBACK_MODEL
  return { preferredModel, fallbackModel, fallbackEnabled: row?.fallback_enabled ?? true }
}

function languageInstruction(preference: string, localLanguage: string) {
  if (preference === 'English') return 'Write in clear natural English.'
  if (preference === 'Filipino') return 'Write in natural Filipino suitable for a Philippine DepEd classroom.'
  if (preference === 'English + Filipino') return 'Write natural teacher-editable English-Filipino bilingual classroom language.'
  if (preference === 'Mother tongue / local language' && localLanguage) return `Write in ${localLanguage}; preserve official DepEd terms.`
  return 'Match the verified curriculum competency language without translating teacher inputs unexpectedly.'
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
    const body = await req.json() as {
      assessmentId?: string
      lessonId?: string
      lessonIds?: string[]
      teacherInstructions?: string
      expectedOutput?: string
      grouping?: string
      duration?: string
      targetPoints?: number
    }

    const assessmentId = clean(body.assessmentId, 80)
    if (!UUID.test(assessmentId)) return json({ error: 'A valid assessment ID is required.' }, 400)

    const [assessmentResult, preferencesResult, settingsResult, credentialResult] = await Promise.all([
      admin.from('documents').select('id, user_id, assignment_id, status, document_type, structured_content').eq('id', assessmentId).eq('user_id', userId).eq('document_type', 'assessment').maybeSingle(),
      admin.from('teacher_lesson_preferences').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_settings').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_credentials').select('api_key_ciphertext, api_key_iv, encryption_key_source').eq('user_id', userId).maybeSingle(),
    ])

    if (assessmentResult.error) throw assessmentResult.error
    if (preferencesResult.error) throw preferencesResult.error
    if (settingsResult.error) throw settingsResult.error
    if (credentialResult.error) throw credentialResult.error

    if (!assessmentResult.data) return json({ error: 'Assessment draft not found.' }, 404)
    if (assessmentResult.data.status !== 'draft') return json({ error: 'Only draft assessments can receive AI suggestions.' }, 409)

    const credential = credentialResult.data as CredentialRow | null
    if (!credential) return json({ error: 'Connect a Gemini API key in AI settings before using assessment AI.' }, 400)
    const apiKey = await decryptCredential(credential.api_key_ciphertext, credential.api_key_iv, credential.encryption_key_source)

    const preference = (preferencesResult.data ?? {}) as PreferenceRow
    const resources = list(preference.actual_resources, 30, 180)
    const language = languageInstruction(clean(preference.language_preference, 80) || 'Auto', clean(preference.local_language_name, 100))
    const settings = resolveSettings((settingsResult.data ?? null) as SettingsRow | null)

    const assessmentContent = object(assessmentResult.data.structured_content)
    const gradeLevel = clean(assessmentContent.gradeLevel) || 'Grade 7'
    const learningArea = clean(assessmentContent.learningArea) || 'Mathematics'

    // Extract competency and objective text
    let competencyTexts: string[] = []
    let objectiveTexts: string[] = []

    if (assessmentContent.sourceLesson) {
      const sl = object(assessmentContent.sourceLesson)
      competencyTexts = list(Array.isArray(sl.competencies) ? sl.competencies.map((c: any) => c.text) : [])
      objectiveTexts = list(sl.learningObjectives)
    } else if (Array.isArray(assessmentContent.sourceLessons)) {
      competencyTexts = list(assessmentContent.sourceLessons.flatMap((l: any) => (Array.isArray(l.competencies) ? l.competencies.map((c: any) => c.text) : [])))
      objectiveTexts = list(assessmentContent.sourceLessons.flatMap((l: any) => (Array.isArray(l.learningObjectives) ? l.learningObjectives : [])))
    } else if (assessmentContent.sourceTos) {
      const st = object(assessmentContent.sourceTos)
      const content = object(st.content)
      if (Array.isArray(content.rows)) {
        competencyTexts = list(content.rows.map((r: any) => r?.competency?.text))
      }
    }

    const prompt = [
      'You are an expert Philippine DepEd curriculum designer crafting an authentic Performance Task (PETA) under DepEd Order No. 8, s. 2015 and MATATAG curriculum guidelines.',
      'Create a rich, realistic, and actionable authentic Performance Task with a 4-level Analytic Scoring Rubric (Exemplary 4, Proficient 3, Developing 2, Beginning 1).',
      `Grade level: ${gradeLevel}`,
      `Learning area: ${learningArea}`,
      `Curriculum competencies: ${competencyTexts.length ? competencyTexts.join('; ') : 'Apply core grade-level concepts to real-world problem solving'}`,
      `Learning objectives: ${objectiveTexts.length ? objectiveTexts.join('; ') : 'Demonstrate practical application and understanding'}`,
      language,
      body.teacherInstructions ? `Teacher focus/instructions: ${clean(body.teacherInstructions, 1000)}` : '',
      body.expectedOutput ? `Preferred expected output: ${clean(body.expectedOutput, 500)}` : '',
      body.grouping ? `Grouping mode: ${clean(body.grouping, 50)}` : '',
      body.duration ? `Duration: ${clean(body.duration, 50)}` : '',
      `Teacher-listed resources available: ${resources.length ? resources.join('; ') : 'Standard classroom and household materials'}`,
      '',
      'Return a single JSON object with EXACTLY this structure:',
      '{',
      '  "title": "Title of the Performance Task",',
      '  "scenario": "GRASPS-based or authentic real-world scenario placing learners in an active role addressing a community, school, or practical challenge",',
      '  "learningObjectives": ["Objective 1", "Objective 2"],',
      '  "teacherInstructions": "Guidance for the teacher including setup, scaffolding, and milestone check-ins",',
      '  "studentInstructions": "Step-by-step clear instructions for students detailing what to do from start to finish",',
      '  "expectedOutput": "The tangible product, report, model, brochure, or demonstration to be submitted",',
      '  "grouping": "individual" or "group" or "either",',
      '  "resources": ["Material/Resource 1", "Material/Resource 2"],',
      '  "constraints": ["Constraint 1", "Constraint 2"],',
      '  "duration": "1 week (or specified duration)",',
      '  "milestones": [',
      '    {"id": "mile-1", "title": "Milestone 1 Title", "description": "Description of check-in", "targetDuration": "Day 1-2"},',
      '    {"id": "mile-2", "title": "Milestone 2 Title", "description": "Description of draft", "targetDuration": "Day 3-4"},',
      '    {"id": "mile-3", "title": "Milestone 3 Title", "description": "Final review and submission", "targetDuration": "Day 5"}',
      '  ],',
      '  "rubric": {',
      '    "title": "Analytic Scoring Rubric",',
      '    "totalPoints": 16,',
      '    "criteria": [',
      '      {',
      '        "id": "crit-1",',
      '        "name": "Content & Curriculum Accuracy",',
      '        "description": "Demonstrates accurate understanding of core concepts",',
      '        "pointsPossible": 4,',
      '        "levels": [',
      '          {"id": "lvl-4", "label": "Exemplary", "descriptor": "Comprehensive mastery...", "points": 4},',
      '          {"id": "lvl-3", "label": "Proficient", "descriptor": "Accurate understanding...", "points": 3},',
      '          {"id": "lvl-2", "label": "Developing", "descriptor": "Basic understanding with gaps...", "points": 2},',
      '          {"id": "lvl-1", "label": "Beginning", "descriptor": "Limited understanding...", "points": 1}',
      '        ]',
      '      },',
      '      {',
      '        "id": "crit-2",',
      '        "name": "Application & Practical Execution",',
      '        "description": "Applies concepts effectively to the scenario",',
      '        "pointsPossible": 4,',
      '        "levels": [',
      '          {"id": "lvl-4", "label": "Exemplary", "descriptor": "Highly creative and authentic...", "points": 4},',
      '          {"id": "lvl-3", "label": "Proficient", "descriptor": "Appropriate application...", "points": 3},',
      '          {"id": "lvl-2", "label": "Developing", "descriptor": "Inconsistent application...", "points": 2},',
      '          {"id": "lvl-1", "label": "Beginning", "descriptor": "Minimal application...", "points": 1}',
      '        ]',
      '      },',
      '      {',
      '        "id": "crit-3",',
      '        "name": "Organization & Communication",',
      '        "description": "Clear presentation and structured output",',
      '        "pointsPossible": 4,',
      '        "levels": [',
      '          {"id": "lvl-4", "label": "Exemplary", "descriptor": "Exceptional clarity and polish...", "points": 4},',
      '          {"id": "lvl-3", "label": "Proficient", "descriptor": "Clear, organized delivery...", "points": 3},',
      '          {"id": "lvl-2", "label": "Developing", "descriptor": "Partially organized...", "points": 2},',
      '          {"id": "lvl-1", "label": "Beginning", "descriptor": "Unclear structure...", "points": 1}',
      '        ]',
      '      },',
      '      {',
      '        "id": "crit-4",',
      '        "name": "Product Quality & Craft",',
      '        "description": "Meets constraints and specifications with high quality",',
      '        "pointsPossible": 4,',
      '        "levels": [',
      '          {"id": "lvl-4", "label": "Exemplary", "descriptor": "Exceeds all specifications...", "points": 4},',
      '          {"id": "lvl-3", "label": "Proficient", "descriptor": "Meets all requirements...", "points": 3},',
      '          {"id": "lvl-2", "label": "Developing", "descriptor": "Partially meets requirements...", "points": 2},',
      '          {"id": "lvl-1", "label": "Beginning", "descriptor": "Incomplete submission...", "points": 1}',
      '        ]',
      '      }',
      '    ]',
      '  },',
      '  "reflection": {',
      '    "enabled": true,',
      '    "prompt": "What key insights did you gain from completing this task and how will you apply them?"',
      '  }',
      '}',
      'Output raw JSON only without markdown formatting.',
    ].join('\n')

    const config = { maxOutputTokens: 8192 }
    let rawOutput: string
    let modelUsed: string = settings.preferredModel
    let fallbackUsed = false

    try {
      rawOutput = await callGemini(apiKey, settings.preferredModel, prompt, config)
    } catch (err) {
      if (
        err instanceof GeminiHttpError &&
        isFallbackEligibleStatus(err.status) &&
        fallbackAllowed(settings.preferredModel, settings.fallbackModel, settings.fallbackEnabled)
      ) {
        modelUsed = settings.fallbackModel
        fallbackUsed = true
        rawOutput = await callGemini(apiKey, settings.fallbackModel, prompt, config)
      } else {
        throw err
      }
    }

    const parsed = parseGeminiJson(rawOutput)
    return json({
      performanceTask: parsed,
      modelUsed,
      fallbackUsed,
    })
  } catch (error: any) {
    const msg = error?.message || 'Failed to generate performance task.'
    return json({ error: msg }, 500)
  }
})
