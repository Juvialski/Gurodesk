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

  // Phase 1 deliberately does not call Gemini yet. This endpoint only verifies
  // that the server-side secret exists without exposing the secret value.
  const geminiConfigured = Boolean(Deno.env.get('GEMINI_API_KEY'))

  return new Response(
    JSON.stringify({
      ok: true,
      phase: 1,
      geminiConfigured,
      note: 'Gemini generation is intentionally deferred to the lesson-planning phase.',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
