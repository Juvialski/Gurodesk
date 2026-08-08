import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decryptCredential, encryptCredential, type EncryptionKeySource } from '../_shared/credentialCrypto.ts'
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_MODEL,
  isAiModelId,
  isLiteModel,
  type AiModelId,
  type LiteAiModelId,
} from '../_shared/ai-models.ts'
import { callGemini, GeminiHttpError } from '../_shared/gemini.ts'

type Action = 'status' | 'save_key' | 'update_settings' | 'test_saved_key' | 'remove_key'

type RequestBody = {
  action?: Action
  apiKey?: string
  preferredModel?: AiModelId
  fallbackModel?: LiteAiModelId
  fallbackEnabled?: boolean
}

type SettingRow = {
  preferred_model?: string
  fallback_model?: string
  fallback_enabled?: boolean
}

type CredentialRow = {
  api_key_ciphertext: string
  api_key_iv: string
  encryption_key_source: EncryptionKeySource
  api_key_last4: string
  verified_at: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeSettings(body?: RequestBody, existing?: SettingRow) {
  const preferred = isAiModelId(body?.preferredModel)
    ? body!.preferredModel!
    : isAiModelId(existing?.preferred_model)
      ? existing!.preferred_model as AiModelId
      : DEFAULT_MODEL

  const requestedFallback = body?.fallbackModel ?? existing?.fallback_model
  const fallback: LiteAiModelId = isLiteModel(requestedFallback)
    ? requestedFallback
    : DEFAULT_FALLBACK_MODEL

  const fallbackEnabled = typeof body?.fallbackEnabled === 'boolean'
    ? body.fallbackEnabled
    : existing?.fallback_enabled ?? true

  return { preferredModel: preferred, fallbackModel: fallback, fallbackEnabled }
}

function statusPayload(credential: CredentialRow | null, settings: ReturnType<typeof normalizeSettings>) {
  return {
    configured: Boolean(credential),
    keyLast4: credential?.api_key_last4 ?? null,
    verifiedAt: credential?.verified_at ?? null,
    ...settings,
  }
}

function friendlyGeminiError(error: unknown) {
  if (!(error instanceof GeminiHttpError)) return { status: 502, message: 'Unable to verify the Gemini API key.' }
  if (error.status === 400 || error.status === 401 || error.status === 403) {
    return { status: 400, message: 'Google rejected this API key or model access. Check the key in Google AI Studio and try again.' }
  }
  if (error.status === 429) {
    return { status: 429, message: 'This Gemini API project is currently rate-limited or out of quota. Try again later or choose another available model.' }
  }
  if (error.status === 404) {
    return { status: 400, message: 'The selected Gemini model is not available to this API project.' }
  }
  return { status: 502, message: 'Gemini could not be reached right now. Your key was not changed.' }
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
    if (!supabaseUrl || !anonKey || !serviceRole) {
      return json({ error: 'Supabase function environment is incomplete.' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid authentication session.' }, 401)

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const userId = userData.user.id
    const body = await req.json() as RequestBody
    const action = body.action
    if (!action) return json({ error: 'Missing AI settings action.' }, 400)

    const [credentialResult, settingsResult] = await Promise.all([
      admin.from('teacher_ai_credentials').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('teacher_ai_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])
    if (credentialResult.error) throw credentialResult.error
    if (settingsResult.error) throw settingsResult.error

    const credential = credentialResult.data as CredentialRow | null
    const existingSettings = (settingsResult.data ?? {}) as SettingRow
    const settings = normalizeSettings(body, existingSettings)

    if (action === 'status') return json(statusPayload(credential, settings))

    if (action === 'update_settings') {
      const { error } = await admin.from('teacher_ai_settings').upsert({
        user_id: userId,
        preferred_model: settings.preferredModel,
        fallback_model: settings.fallbackModel,
        fallback_enabled: settings.fallbackEnabled,
      })
      if (error) throw error
      return json(statusPayload(credential, settings))
    }

    if (action === 'remove_key') {
      const { error } = await admin.from('teacher_ai_credentials').delete().eq('user_id', userId)
      if (error) throw error
      return json(statusPayload(null, settings))
    }

    if (action === 'save_key') {
      const apiKey = body.apiKey?.trim() ?? ''
      if (apiKey.length < 20 || apiKey.length > 300) return json({ error: 'Enter a valid Gemini API key.' }, 400)

      try {
        await callGemini(
          apiKey,
          settings.preferredModel,
          'Connection test for GuroDesk. Reply with exactly: OK',
          { temperature: 0, maxOutputTokens: 512 },
        )
      } catch (error) {
        const friendly = friendlyGeminiError(error)
        console.error('BYOK save-key test failed', error)
        return json({ error: friendly.message }, friendly.status)
      }

      const encrypted = await encryptCredential(apiKey)
      const verifiedAt = new Date().toISOString()
      const { error: credentialError } = await admin.from('teacher_ai_credentials').upsert({
        user_id: userId,
        provider: 'google',
        api_key_ciphertext: encrypted.ciphertext,
        api_key_iv: encrypted.iv,
        encryption_key_source: encrypted.keySource,
        api_key_last4: apiKey.slice(-4),
        verified_at: verifiedAt,
      })
      if (credentialError) throw credentialError

      const { error: settingError } = await admin.from('teacher_ai_settings').upsert({
        user_id: userId,
        preferred_model: settings.preferredModel,
        fallback_model: settings.fallbackModel,
        fallback_enabled: settings.fallbackEnabled,
      })
      if (settingError) throw settingError

      return json({
        ...statusPayload({
          api_key_ciphertext: '',
          api_key_iv: '',
          encryption_key_source: encrypted.keySource,
          api_key_last4: apiKey.slice(-4),
          verified_at: verifiedAt,
        }, settings),
        testedModel: settings.preferredModel,
        message: 'Gemini key verified and encrypted for your account.',
      })
    }

    if (action === 'test_saved_key') {
      if (!credential) return json({ error: 'Connect a Gemini API key first.' }, 400)
      const apiKey = await decryptCredential(
        credential.api_key_ciphertext,
        credential.api_key_iv,
        credential.encryption_key_source,
      )
      try {
        await callGemini(
          apiKey,
          settings.preferredModel,
          'Connection test for GuroDesk. Reply with exactly: OK',
          { temperature: 0, maxOutputTokens: 512 },
        )
      } catch (error) {
        const friendly = friendlyGeminiError(error)
        console.error('BYOK saved-key test failed', error)
        return json({ error: friendly.message }, friendly.status)
      }
      const verifiedAt = new Date().toISOString()
      await admin.from('teacher_ai_credentials').update({ verified_at: verifiedAt }).eq('user_id', userId)
      return json({ ok: true, model: settings.preferredModel, message: 'Gemini connection is working.' })
    }

    return json({ error: 'Unsupported AI settings action.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: 'Unable to update Gemini settings.' }, 500)
  }
})
