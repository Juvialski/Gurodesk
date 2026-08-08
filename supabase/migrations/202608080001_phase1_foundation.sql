-- GuroDesk Phase 1 foundation
-- Apply to a NEW Supabase project before connecting the frontend.
-- Curriculum content is intentionally not seeded here. Phase 2 will import only verified DepEd sources.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  school_name text not null default '',
  region text not null default '',
  division text not null default '',
  position_title text not null default 'Teacher I',
  school_year text not null default '2026-2027',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_year text not null,
  grade_level text not null,
  learning_area text not null,
  section_names text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Versioned official-source architecture. Populated in Phase 2.
create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('curriculum_guide','deped_order','memorandum','advisory','other')),
  title text not null,
  issuance_code text,
  source_url text,
  published_on date,
  effective_from date,
  effective_to date,
  content_hash text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','superseded')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  framework text not null,
  effective_from_school_year text not null,
  effective_to_school_year text,
  status text not null default 'draft' check (status in ('draft','active','superseded')),
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete cascade,
  label text not null,
  sequence integer not null check (sequence > 0),
  period_type text not null check (period_type in ('term','quarter','semester','year')),
  grade_min integer,
  grade_max integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (curriculum_version_id, label, grade_min, grade_max)
);

create table if not exists public.curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete cascade,
  grade_level text not null,
  code text,
  name text not null,
  description text,
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (curriculum_version_id, grade_level, name)
);

create table if not exists public.curriculum_domains (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.curriculum_subjects(id) on delete cascade,
  code text,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (subject_id, name)
);

create table if not exists public.curriculum_standards (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.curriculum_subjects(id) on delete cascade,
  domain_id uuid references public.curriculum_domains(id) on delete set null,
  academic_period_id uuid references public.academic_periods(id) on delete set null,
  standard_type text not null check (standard_type in ('content','performance','stage','key_stage','other')),
  standard_text text not null,
  sort_order integer not null default 0,
  source_document_id uuid references public.source_documents(id) on delete set null,
  source_page integer,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.curriculum_competencies (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.curriculum_subjects(id) on delete cascade,
  domain_id uuid references public.curriculum_domains(id) on delete set null,
  academic_period_id uuid references public.academic_periods(id) on delete set null,
  competency_code text,
  competency_text text not null,
  sort_order integer not null default 0,
  source_document_id uuid references public.source_documents(id) on delete set null,
  source_page integer,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  policy_category text not null,
  school_year_from text,
  school_year_to text,
  status text not null default 'draft' check (status in ('draft','active','superseded')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.policy_sections (
  id uuid primary key default gen_random_uuid(),
  policy_document_id uuid not null references public.policy_documents(id) on delete cascade,
  heading text,
  section_text text not null,
  page_number integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- Document base tables are included now so future features do not require a storage-model rewrite.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.teacher_assignments(id) on delete set null,
  document_type text not null,
  title text not null,
  school_year text not null,
  academic_period_label text,
  status text not null default 'draft' check (status in ('draft','final','archived')),
  structured_content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  structured_content jsonb not null default '{}'::jsonb,
  change_note text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, version_number)
);

create index if not exists idx_teacher_assignments_user_id on public.teacher_assignments(user_id);
create index if not exists idx_teacher_assignments_user_active on public.teacher_assignments(user_id, is_active);
create index if not exists idx_curriculum_subjects_lookup on public.curriculum_subjects(curriculum_version_id, grade_level, name);
create index if not exists idx_curriculum_competencies_subject on public.curriculum_competencies(subject_id, academic_period_id, sort_order);
create index if not exists idx_curriculum_competencies_code on public.curriculum_competencies(competency_code) where competency_code is not null;
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_documents_assignment on public.documents(assignment_id);
create index if not exists idx_document_versions_document on public.document_versions(document_id);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger teacher_assignments_set_updated_at before update on public.teacher_assignments
for each row execute function public.set_updated_at();
create trigger source_documents_set_updated_at before update on public.source_documents
for each row execute function public.set_updated_at();
create trigger curriculum_versions_set_updated_at before update on public.curriculum_versions
for each row execute function public.set_updated_at();
create trigger curriculum_subjects_set_updated_at before update on public.curriculum_subjects
for each row execute function public.set_updated_at();
create trigger curriculum_competencies_set_updated_at before update on public.curriculum_competencies
for each row execute function public.set_updated_at();
create trigger policy_documents_set_updated_at before update on public.policy_documents
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS: user-owned tables
alter table public.profiles enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "teacher_assignments_select_own" on public.teacher_assignments
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "teacher_assignments_insert_own" on public.teacher_assignments
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "teacher_assignments_update_own" on public.teacher_assignments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "teacher_assignments_delete_own" on public.teacher_assignments
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "documents_select_own" on public.documents
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "documents_insert_own" on public.documents
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "documents_update_own" on public.documents
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "documents_delete_own" on public.documents
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "document_versions_select_own" on public.document_versions
for select to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = document_versions.document_id
    and d.user_id = (select auth.uid())
));
create policy "document_versions_insert_own" on public.document_versions
for insert to authenticated
with check (exists (
  select 1 from public.documents d
  where d.id = document_versions.document_id
    and d.user_id = (select auth.uid())
));
create policy "document_versions_delete_own" on public.document_versions
for delete to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = document_versions.document_id
    and d.user_id = (select auth.uid())
));

-- Official knowledge tables: readable by signed-in teachers, writable only by trusted backend/admin tooling.
alter table public.source_documents enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.academic_periods enable row level security;
alter table public.curriculum_subjects enable row level security;
alter table public.curriculum_domains enable row level security;
alter table public.curriculum_standards enable row level security;
alter table public.curriculum_competencies enable row level security;
alter table public.policy_documents enable row level security;
alter table public.policy_sections enable row level security;

create policy "knowledge_read_source_documents" on public.source_documents
for select to authenticated
using (verification_status in ('verified','superseded'));

create policy "knowledge_read_curriculum_versions" on public.curriculum_versions
for select to authenticated
using (status in ('active','superseded'));

create policy "knowledge_read_academic_periods" on public.academic_periods
for select to authenticated
using (exists (
  select 1 from public.curriculum_versions cv
  where cv.id = academic_periods.curriculum_version_id
    and cv.status in ('active','superseded')
));

create policy "knowledge_read_curriculum_subjects" on public.curriculum_subjects
for select to authenticated
using (exists (
  select 1 from public.curriculum_versions cv
  where cv.id = curriculum_subjects.curriculum_version_id
    and cv.status in ('active','superseded')
));

create policy "knowledge_read_curriculum_domains" on public.curriculum_domains
for select to authenticated
using (exists (
  select 1
  from public.curriculum_subjects cs
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  where cs.id = curriculum_domains.subject_id
    and cv.status in ('active','superseded')
));

create policy "knowledge_read_curriculum_standards" on public.curriculum_standards
for select to authenticated
using (exists (
  select 1
  from public.curriculum_subjects cs
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  where cs.id = curriculum_standards.subject_id
    and cv.status in ('active','superseded')
));

create policy "knowledge_read_curriculum_competencies" on public.curriculum_competencies
for select to authenticated
using (
  verification_status = 'verified'
  and exists (
    select 1
    from public.curriculum_subjects cs
    join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
    where cs.id = curriculum_competencies.subject_id
      and cv.status in ('active','superseded')
  )
);

create policy "knowledge_read_policy_documents" on public.policy_documents
for select to authenticated
using (status in ('active','superseded'));

create policy "knowledge_read_policy_sections" on public.policy_sections
for select to authenticated
using (exists (
  select 1 from public.policy_documents pd
  where pd.id = policy_sections.policy_document_id
    and pd.status in ('active','superseded')
));

comment on table public.curriculum_competencies is 'Phase 2: only verified DepEd curriculum records should become teacher-visible.';
comment on table public.source_documents is 'Canonical registry for official DepEd source provenance and version status.';
