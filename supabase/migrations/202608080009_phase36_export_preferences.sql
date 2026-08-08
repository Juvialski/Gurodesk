-- GuroDesk Phase 3.6: reusable document export preferences.
-- Exported PDF/DOCX bytes are generated client-side and are not stored in Supabase.

create table if not exists public.teacher_export_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_template_id text not null default 'gurodesk_ilaw_standard'
    check (default_template_id in ('gurodesk_ilaw_standard')),
  paper_size text not null default 'a4'
    check (paper_size in ('a4', 'letter', 'legal')),
  prepared_by_name text not null default '',
  prepared_by_title text not null default '',
  reviewed_by_name text not null default '',
  reviewed_by_title text not null default '',
  noted_by_name text not null default '',
  noted_by_title text not null default '',
  include_ai_declaration boolean not null default true,
  include_source_provenance boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teacher_export_preferences enable row level security;

create policy "teachers can read own export preferences"
on public.teacher_export_preferences
for select
to authenticated
using (auth.uid() = user_id);

create policy "teachers can insert own export preferences"
on public.teacher_export_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "teachers can update own export preferences"
on public.teacher_export_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

comment on table public.teacher_export_preferences is
'Per-teacher printable document settings. Generated files remain local downloads and are not persisted here.';
