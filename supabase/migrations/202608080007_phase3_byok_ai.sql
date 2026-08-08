-- GuroDesk Phase 3 BYOK checkpoint
-- Per-teacher Gemini credentials are encrypted by Edge Functions and are never readable
-- through the normal authenticated Data API. AI settings are also server-managed.

create table if not exists public.teacher_ai_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  api_key_ciphertext text not null,
  api_key_iv text not null,
  encryption_key_source text not null default 'service_role' check (encryption_key_source in ('dedicated','service_role')),
  api_key_last4 text not null,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teacher_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_model text not null default 'gemini-3.5-flash-lite' check (preferred_model in (
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
  )),
  fallback_model text not null default 'gemini-3.1-flash-lite' check (fallback_model in (
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
  )),
  fallback_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger teacher_ai_credentials_set_updated_at
before update on public.teacher_ai_credentials
for each row execute function public.set_updated_at();

create trigger teacher_ai_settings_set_updated_at
before update on public.teacher_ai_settings
for each row execute function public.set_updated_at();

alter table public.teacher_ai_credentials enable row level security;
alter table public.teacher_ai_settings enable row level security;

-- Intentionally no authenticated CRUD policies on either table.
-- Browser clients interact only with the authenticated ai-settings Edge Function.
-- The function validates the user's JWT, then uses the service role server-side.

comment on table public.teacher_ai_credentials is
'Encrypted per-teacher Gemini BYOK credentials. No browser Data API policies by design.';
comment on table public.teacher_ai_settings is
'Server-managed per-teacher Gemini model/fallback preferences. No browser Data API policies by design.';
