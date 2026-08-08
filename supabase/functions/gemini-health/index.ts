import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: 'Authentication required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      mode: 'teacher_byok',
      sharedGeminiKeyRequired: false,
      note: 'Each teacher connects an individual Gemini API key from GuroDesk Settings.',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
