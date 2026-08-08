import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type SupportType = 'refine_clarity' | 'organize_text' | 'grammar_spelling' | 'format_text' | 'translate'

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
    teacherIntent?: string
  }
}

const allowedSupport = new Set<SupportType>(['refine_clarity', 'organize_text', 'grammar_spelling', 'format_text', 'translate'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function instructionFor(type: SupportType, targetLanguage?: string) {
  switch (type) {
    case 'refine_clarity': return 'Improve clarity and concision without adding new instructional ideas, objectives, activities, assessments, strategies, or judgments.'
    case 'organize_text': return 'Organize the teacher-authored text for readability. Preserve every instructional decision and do not add new instructional content.'
    case 'grammar_spelling': return 'Correct grammar, spelling, punctuation, and awkward wording only. Preserve meaning and instructional decisions.'
    case 'format_text': return 'Format the teacher-authored text into clear paragraphs or bullets without adding, deleting, or changing instructional decisions.'
    case 'translate': return `Translate the teacher-authored text into ${targetLanguage || 'the requested target language'} while preserving its meaning. Do not add instructional content.`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const body = await req.json() as RequestBody
    const supportType = body.supportType
    const text = body.text?.trim() ?? ''
    if (!supportType || !allowedSupport.has(supportType)) return json({ error: 'Unsupported AI support task.' }, 400)
    if (text.length < 10) return json({ error: 'Write the section yourself before requesting AI support.' }, 400)
    if (text.length > 12000) return json({ error: 'Section is too long for one support request.' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite'
    if (!supabaseUrl || !anonKey) return json({ error: 'Supabase function environment is incomplete.' }, 500)
    if (!apiKey) return json({ error: 'Gemini is not configured on the server.' }, 503)

    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)

    const ctx = body.lessonContext ?? {}
    const declarationCategory = supportType === 'refine_clarity' || supportType === 'organize_text' ? 'limited' : 'guided'
    const systemGuardrail = `You are a text-support assistant for a Philippine DepEd teacher using DO 016, s. 2026. The teacher has already made the core instructional decision. You MUST NOT invent or propose learning objectives, unpack competencies, design learning experiences, choose instructional strategies, design assessments, make learner-needs judgments, or create a lesson plan. Perform only the requested text-support operation. Do not introduce facts that are absent from the teacher's text. Return only the revised text.`
    const context = [
      ctx.gradeLevel ? `Grade: ${ctx.gradeLevel}` : '',
      ctx.learningArea ? `Learning area: ${ctx.learningArea}` : '',
      ctx.competencyText ? `Verified competency context: ${ctx.competencyText}` : '',
      ctx.teacherIntent ? `Teacher-authored intention context: ${ctx.teacherIntent}` : '',
    ].filter(Boolean).join('\n')

    const prompt = `${systemGuardrail}\n\nTask: ${instructionFor(supportType, body.targetLanguage)}\n${context ? `\nContext for preserving meaning only:\n${context}\n` : ''}\nTeacher-authored text:\n---\n${text}\n---`

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      console.error('Gemini support error', response.status, detail.slice(0, 500))
      return json({ error: 'Gemini support is temporarily unavailable.' }, 502)
    }
    const result = await response.json()
    const output = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim()
    if (!output) return json({ error: 'Gemini returned an empty revision.' }, 502)

    const documentId = body.documentId?.trim()
    if (documentId) {
      const { error: auditError } = await client.from('lesson_plan_ai_events').insert({
        document_id: documentId,
        user_id: userData.user.id,
        support_type: supportType,
        section_key: body.sectionKey || 'unknown',
        declaration_category: declarationCategory,
        provider: 'google',
        model,
      })
      if (auditError) console.error('AI audit insert failed', auditError.message)
    }

    return json({ output, model, supportType, declarationCategory })
  } catch (error) {
    console.error(error)
    return json({ error: 'Unable to process AI support request.' }, 500)
  }
})
