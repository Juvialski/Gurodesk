import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import {
  DEFAULT_MODEL,
  type AiModelId,
} from '../_shared/ai-models.ts'
import { extractGeminiText, GeminiHttpError, GeminiResponseError } from '../_shared/gemini.ts'

type RequestBody = {
  mode?: unknown
  imageBase64?: unknown
  promptHint?: unknown
  questionType?: unknown
  pointsPossible?: unknown
  expectedAnswer?: unknown
  learningArea?: unknown
  gradeLevel?: unknown
}

type CredentialRow = {
  api_key_ciphertext: string
  api_key_iv: string
  encryption_key_source: EncryptionKeySource
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function parseJsonCandidate(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const matched = trimmed.match(/\{[\s\S]*\}/u)
    if (matched) {
      try {
        return JSON.parse(matched[0]) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'UNAUTHORIZED', message: 'Missing Authorization header.' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return json({ error: 'UNAUTHORIZED', message: 'Unauthorized user token.' }, 401)
    }

    // 1. Fetch encrypted teacher BYOK credential
    const { data: credRow, error: credError } = await supabase
      .from('user_ai_credentials')
      .select('api_key_ciphertext, api_key_iv, encryption_key_source')
      .eq('user_id', user.id)
      .maybeSingle()

    if (credError || !credRow) {
      return json(
        {
          error: 'NO_BYOK_KEY',
          message: 'No Gemini API key configured. AI grading and transcription requires a BYOK API key in Settings.',
        },
        400,
      )
    }

    const credential = credRow as CredentialRow
    const apiKey = await decryptCredential(
      credential.api_key_ciphertext,
      credential.api_key_iv,
      credential.encryption_key_source,
    )

    if (!apiKey || apiKey.length < 10) {
      return json({ error: 'INVALID_KEY', message: 'Stored Gemini API key could not be decrypted.' }, 400)
    }

    // 2. Parse and validate payload
    const body = (await req.json().catch(() => ({}))) as RequestBody
    const mode = text(body.mode, 20) || 'transcribe'
    const rawImage = text(body.imageBase64, 4_000_000)
    const promptHint = text(body.promptHint, 2000)
    const questionType = text(body.questionType, 50) || 'essay'
    const pointsPossible = typeof body.pointsPossible === 'number' && Number.isFinite(body.pointsPossible) && body.pointsPossible > 0
      ? body.pointsPossible
      : 1
    const expectedAnswer = typeof body.expectedAnswer === 'string'
      ? text(body.expectedAnswer, 2000)
      : typeof body.expectedAnswer === 'object' && body.expectedAnswer !== null
      ? JSON.stringify(body.expectedAnswer).slice(0, 2000)
      : ''
    const learningArea = text(body.learningArea, 100)
    const gradeLevel = text(body.gradeLevel, 50)

    if (!rawImage) {
      return json({ error: 'MISSING_IMAGE', message: 'No image crop provided.' }, 400)
    }

    // Clean base64 header if present
    const cleanBase64 = rawImage.replace(/^data:image\/[a-z]+;base64,/iu, '').trim()

    // 3. Construct instruction based on mode
    let promptInstruction: string
    let responseSchemaConfig: Record<string, unknown> | undefined

    if (mode === 'grade') {
      promptInstruction = [
        'You are an expert pedagogical assistant helping a Philippine DepEd teacher evaluate a student\'s handwritten answer.',
        `Subject: ${learningArea || 'General'} | Grade: ${gradeLevel || 'Secondary'}`,
        `Question Type: ${questionType.replace('_', ' ')}`,
        `Maximum Points: ${pointsPossible}`,
        promptHint ? `Question Prompt: "${promptHint}"` : '',
        expectedAnswer ? `Expected Answer / Scoring Criteria / Key Points: ${expectedAnswer}` : '',
        '',
        'TASK:',
        '1. Transcribe the student\'s handwritten answer in the image verbatim.',
        `2. Evaluate the student's answer against the question prompt and scoring criteria/key points.`,
        `3. Assign suggestedPoints as a number between 0 and ${pointsPossible} (proportional to correctness, accuracy, and completeness).`,
        '4. Provide feedback: 1-2 concise, constructive pedagogical sentences explaining what was correct and what was missing.',
        '5. Assess your confidence score from 0.0 to 1.0.',
        '',
        'IMPORTANT RULES:',
        `- suggestedPoints MUST be between 0 and ${pointsPossible}.`,
        '- If the student box is blank, empty, or unreadable, set transcript to "", suggestedPoints to 0, and feedback to "No legible response provided.".',
        '- Output MUST be valid JSON only with keys: "transcript", "suggestedPoints", "feedback", "confidence".',
      ].filter(Boolean).join('\n')

      responseSchemaConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            transcript: { type: 'STRING' },
            suggestedPoints: { type: 'NUMBER' },
            feedback: { type: 'STRING' },
            confidence: { type: 'NUMBER' },
          },
          required: ['transcript', 'suggestedPoints', 'feedback', 'confidence'],
        },
      }
    } else {
      // Transcription only
      promptInstruction = [
        'You are an OCR handwriting transcription assistant for Philippine teachers.',
        'Transcribe the student\'s handwritten answer in the image verbatim into plain text.',
        'CRITICAL RULES:',
        '- Transcribe ONLY what is written. Do NOT evaluate, grade, or critique the answer.',
        '- Do NOT correct spelling or grammar mistakes.',
        '- If the box is blank, empty, or unreadable, return an empty string "".',
        '- Return ONLY the transcribed text without conversational markdown or commentary.',
        promptHint ? `Question prompt context: "${promptHint}"` : '',
      ].filter(Boolean).join('\n')
    }

    // 4. Invoke Gemini Vision Model
    const model: AiModelId = 'gemini-2.5-flash'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              { text: promptInstruction },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          ...(responseSchemaConfig || {}),
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new GeminiHttpError(response.status, detail)
    }

    const result = await response.json()
    const extracted = extractGeminiText(result)
    const rawText = extracted.text.trim()

    if (mode === 'grade') {
      const parsed = parseJsonCandidate(rawText)
      const transcript = typeof parsed?.transcript === 'string' ? parsed.transcript.trim() : rawText
      const rawPoints = typeof parsed?.suggestedPoints === 'number' && Number.isFinite(parsed.suggestedPoints)
        ? parsed.suggestedPoints
        : 0
      const clampedPoints = Math.max(0, Math.min(pointsPossible, Math.round(rawPoints * 2) / 2))
      const feedback = typeof parsed?.feedback === 'string' ? parsed.feedback.trim() : ''
      const confidence = typeof parsed?.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.85

      return json({
        success: true,
        mode: 'grade',
        transcript,
        suggestedPoints: clampedPoints,
        feedback,
        confidence,
      })
    }

    return json({
      success: true,
      mode: 'transcribe',
      transcript: rawText,
    })
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return json({ error: 'GEMINI_HTTP_ERROR', message: error.message, detail: error.detail }, 502)
    }
    if (error instanceof GeminiResponseError) {
      return json({ error: error.category, message: error.message }, 502)
    }
    const message = error instanceof Error ? error.message : 'Processing failed.'
    return json({ error: 'INTERNAL_ERROR', message }, 500)
  }
})
