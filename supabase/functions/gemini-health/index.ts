import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: 'Authentication required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return new Response(JSON.stringify({ ok: false, error: 'Invalid authentication session.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  return new Response(
    JSON.stringify({
      ok: true,
      mode: 'sponsored_or_teacher_byok',
      sponsoredConfigured: Boolean(Deno.env.get('GURODESK_SPONSORED_GEMINI_KEY')?.trim()),
      note: 'Free calls use the shared daily allowance. A saved personal key takes priority.',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
