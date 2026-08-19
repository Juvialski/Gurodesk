import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import {
  DEFAULT_MODEL,
  type AiModelId,
} from '../_shared/ai-models.ts'
import { extractGeminiText, GeminiHttpError, GeminiResponseError } from '../_shared/gemini.ts'

type RequestBody = {
  imageBase64?: unknown
  promptHint?: unknown
  questionType?: unknown
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
          message: 'No Gemini API key configured. Handwriting transcription requires a BYOK API key in Settings.',
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

    // 2. Parse and validate image payload
    const body = (await req.json().catch(() => ({}))) as RequestBody
    const rawImage = text(body.imageBase64, 4_000_000)
    const promptHint = text(body.promptHint, 500)
    const questionType = text(body.questionType, 50)

    if (!rawImage) {
      return json({ error: 'MISSING_IMAGE', message: 'No handwritten image crop provided.' }, 400)
    }

    // Clean base64 header if present
    const cleanBase64 = rawImage.replace(/^data:image\/[a-z]+;base64,/iu, '').trim()

    // 3. Construct transcription instruction
    const promptInstruction = [
      'You are an OCR handwriting transcription assistant for Philippine teachers.',
      'Transcribe the student\'s handwritten answer in the image verbatim into plain text.',
      'CRITICAL RULES:',
      '- Transcribe ONLY what is written. Do NOT evaluate, grade, or critique the answer.',
      '- Do NOT correct spelling or grammar mistakes.',
      '- If the box is blank, empty, or unreadable, return an empty string "".',
      '- Return ONLY the transcribed text without conversational markdown or commentary.',
      promptHint ? `Question prompt context: "${promptHint}"` : '',
    ].filter(Boolean).join('\n')

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
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new GeminiHttpError(response.status, detail)
    }

    const result = await response.json()
    const extracted = extractGeminiText(result)

    return json({
      transcript: extracted.text.trim(),
      success: true,
    })
  } catch (error) {
    if (error instanceof GeminiHttpError) {
      return json({ error: 'GEMINI_HTTP_ERROR', message: error.message, detail: error.detail }, 502)
    }
    if (error instanceof GeminiResponseError) {
      return json({ error: error.category, message: error.message }, 502)
    }
    const message = error instanceof Error ? error.message : 'Transcription failed.'
    return json({ error: 'INTERNAL_ERROR', message }, 500)
  }
})
