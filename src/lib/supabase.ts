import { createClient } from '@supabase/supabase-js'

// Browser-safe defaults for the production GuroDesk Supabase project.
// VITE_* values still override these when a different environment/project is needed.
const DEFAULT_SUPABASE_URL = 'https://hmeybakjxtzmiebtxonc.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xbSxOwbJ3QWAI4u_OT_2bg_6POFZagD'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
