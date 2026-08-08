-- GuroDesk Phase 3.7: teacher-owned custom document templates.
-- Stores metadata/mappings in Postgres and original DOCX/XLSX bytes in a private Storage bucket.

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  document_type text not null check (document_type in ('lesson_plan', 'tos')),
  file_type text not null check (file_type in ('docx', 'xlsx')),
  original_filename text not null,
  storage_path text not null,
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0 and file_size_bytes <= 10485760),
  source_hash text not null default '',
  structure_json jsonb not null default '[]'::jsonb,
  mapping_json jsonb not null default '[]'::jsonb,
  analysis_model text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create index if not exists document_templates_user_type_idx
  on public.document_templates(user_id, document_type, updated_at desc);

create unique index if not exists document_templates_one_default_per_type_idx
  on public.document_templates(user_id, document_type)
  where is_default;

alter table public.document_templates enable row level security;

create policy "teachers can read own document templates"
on public.document_templates for select to authenticated
using (auth.uid() = user_id);

create policy "teachers can insert own document templates"
on public.document_templates for insert to authenticated
with check (auth.uid() = user_id);

create policy "teachers can update own document templates"
on public.document_templates for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "teachers can delete own document templates"
on public.document_templates for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.guard_document_template_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default then
    update public.document_templates
    set is_default = false, updated_at = now()
    where user_id = new.user_id
      and document_type = new.document_type
      and id <> new.id
      and is_default = true;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists document_template_default_guard on public.document_templates;
create trigger document_template_default_guard
before insert or update of is_default, mapping_json, name on public.document_templates
for each row execute function public.guard_document_template_default();

-- Supabase Storage is available on the project and keeps uploaded master templates private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-templates',
  'document-templates',
  false,
  10485760,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "teachers can read own template files"
on storage.objects for select to authenticated
using (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "teachers can upload own template files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "teachers can replace own template files"
on storage.objects for update to authenticated
using (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "teachers can delete own template files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'document-templates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.document_templates is
'Teacher-owned custom DOCX/XLSX template metadata and deterministic field mappings. Original master files live in the private document-templates Storage bucket.';
