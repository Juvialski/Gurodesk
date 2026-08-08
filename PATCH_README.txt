GuroDesk Supabase connection patch

Replace:
src/lib/supabase.ts

with the file in this patch.

This uses the production Supabase project URL and browser-safe publishable key as defaults,
while preserving VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as overrides.

No service-role key, database password, or Gemini secret is included.
