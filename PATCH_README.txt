HISTORICAL NOTE — NO SEPARATE PATCH ACTION IS REQUIRED FOR THE COMPLETE PHASE 4.3 ZIP

This retained note described an older standalone Supabase connection patch. The
complete project already contains its current connection module. Follow
CODEX_HANDOVER.md and .env.example; do not copy secrets into browser variables.

GuroDesk Supabase connection patch (historical)

Replace:
src/lib/supabase.ts

with the file in this patch.

This uses the production Supabase project URL and browser-safe publishable key as defaults,
while preserving VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as overrides.

No service-role key, database password, or Gemini secret is included.
