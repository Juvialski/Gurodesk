-- Philippine school identity foundation
-- Official reference source: DepEd National Inventory Dashboard (NID).
-- This migration preserves legacy free-text profile columns for backwards compatibility.

create table if not exists public.philippine_schools (
  id uuid primary key default gen_random_uuid(),
  school_id text not null unique,
  school_name text not null,
  search_name text not null default '',
  region_code text not null default '',
  region_name text not null,
  division_code text,
  division_name text not null,
  municipality text,
  province text,
  school_type text,
  classification text,
  is_active boolean not null default true,
  source_name text not null default 'DepEd National Inventory Dashboard',
  source_url text,
  source_version text,
  source_checked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_philippine_schools_region_division
  on public.philippine_schools(region_name, division_name);
create index if not exists idx_philippine_schools_search_name
  on public.philippine_schools(search_name);
create index if not exists idx_philippine_schools_active
  on public.philippine_schools(is_active) where is_active = true;

drop trigger if exists set_philippine_schools_updated_at on public.philippine_schools;
create trigger set_philippine_schools_updated_at
before update on public.philippine_schools
for each row execute procedure public.set_updated_at();

create or replace function public.normalize_philippine_school_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(translate(upper(coalesce(value, '')), 'ÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ', 'AAAAAEEEEIIIIOOOOOUUUUNC'), '[^A-Z0-9]+', ' ', 'g'));
$$;

create or replace function public.prepare_philippine_school_search_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.school_id := trim(new.school_id);
  new.school_name := trim(new.school_name);
  new.region_code := trim(coalesce(new.region_code, ''));
  new.region_name := trim(new.region_name);
  new.division_name := trim(new.division_name);
  new.search_name := public.normalize_philippine_school_search(new.school_id || ' ' || new.school_name);
  return new;
end;
$$;

drop trigger if exists prepare_philippine_school_search_name on public.philippine_schools;
create trigger prepare_philippine_school_search_name
before insert or update of school_id, school_name, region_code, region_name, division_name
on public.philippine_schools
for each row execute procedure public.prepare_philippine_school_search_name();

alter table public.profiles
  add column if not exists school_directory_id uuid references public.philippine_schools(id) on delete set null,
  add column if not exists school_id text,
  add column if not exists school_source text not null default 'custom',
  add column if not exists school_is_custom boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_school_source_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_school_source_check
      check (school_source in ('deped_nid', 'custom'));
  end if;
end $$;

create index if not exists idx_profiles_school_directory_id
  on public.profiles(school_directory_id);

create or replace function public.guard_profile_school_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  directory_school public.philippine_schools%rowtype;
begin
  if new.school_directory_id is not null and coalesce(new.school_is_custom, false) = false then
    select * into directory_school
    from public.philippine_schools
    where id = new.school_directory_id
      and is_active = true;

    if not found then
      raise exception 'Selected school directory record is unavailable or inactive.';
    end if;

    new.school_id := directory_school.school_id;
    new.school_name := directory_school.school_name;
    new.region := directory_school.region_name;
    new.division := directory_school.division_name;
    new.school_source := 'deped_nid';
    new.school_is_custom := false;
  else
    new.school_directory_id := null;
    new.school_id := nullif(trim(coalesce(new.school_id, '')), '');
    new.school_name := trim(coalesce(new.school_name, ''));
    new.region := trim(coalesce(new.region, ''));
    new.division := trim(coalesce(new.division, ''));
    new.school_source := 'custom';
    new.school_is_custom := true;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_school_identity on public.profiles;
create trigger guard_profile_school_identity
before insert or update of school_directory_id, school_id, school_name, region, division, school_source, school_is_custom
on public.profiles
for each row execute procedure public.guard_profile_school_identity();

alter table public.philippine_schools enable row level security;

drop policy if exists "Authenticated users can read Philippine school directory" on public.philippine_schools;
create policy "Authenticated users can read Philippine school directory"
on public.philippine_schools
for select
to authenticated
using (is_active = true);

grant select on public.philippine_schools to authenticated;

create or replace function public.search_philippine_schools(
  p_query text default '',
  p_region text default null,
  p_division text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  school_id text,
  school_name text,
  region_code text,
  region_name text,
  division_code text,
  division_name text,
  municipality text,
  province text,
  school_type text,
  classification text,
  is_active boolean,
  source_name text,
  source_url text,
  source_version text,
  source_checked_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id, s.school_id, s.school_name, s.region_code, s.region_name,
    s.division_code, s.division_name, s.municipality, s.province,
    s.school_type, s.classification, s.is_active, s.source_name,
    s.source_url, s.source_version, s.source_checked_at
  from public.philippine_schools s
  where s.is_active = true
    and (nullif(trim(p_region), '') is null or s.region_name = trim(p_region))
    and (nullif(trim(p_division), '') is null or s.division_name = trim(p_division))
    and (
      nullif(public.normalize_philippine_school_search(p_query), '') is null
      or s.search_name like '%' || public.normalize_philippine_school_search(p_query) || '%'
    )
  order by
    case when s.school_id = trim(p_query) then 0 else 1 end,
    s.school_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.list_philippine_school_regions()
returns table (region_code text, region_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select min(s.region_code) as region_code, s.region_name
  from public.philippine_schools s
  where s.is_active = true
  group by s.region_name
  order by s.region_name;
$$;

create or replace function public.list_philippine_school_divisions(p_region text)
returns table (division_code text, division_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select min(s.division_code) as division_code, s.division_name
  from public.philippine_schools s
  where s.is_active = true
    and s.region_name = trim(p_region)
  group by s.division_name
  order by s.division_name;
$$;

grant execute on function public.search_philippine_schools(text, text, text, integer) to authenticated;
grant execute on function public.list_philippine_school_regions() to authenticated;
grant execute on function public.list_philippine_school_divisions(text) to authenticated;

-- Historical records get an immutable school-identity snapshot on creation.
-- Existing records are intentionally NOT backfilled with today's profile values.
alter table public.documents
  add column if not exists school_identity_snapshot jsonb;

alter table public.assessment_documents
  add column if not exists school_identity_snapshot jsonb;

alter table public.result_sessions
  add column if not exists school_identity_snapshot jsonb;

create or replace function public.capture_school_identity_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.school_identity_snapshot := old.school_identity_snapshot;
    return new;
  end if;

  select jsonb_build_object(
      'schoolDirectoryId', p.school_directory_id,
      'schoolId', p.school_id,
      'schoolName', p.school_name,
      'region', p.region,
      'division', p.division,
      'source', p.school_source,
      'isCustom', p.school_is_custom
    )
  into new.school_identity_snapshot
  from public.profiles p
  where p.id = new.user_id;

  return new;
end;
$$;

drop trigger if exists capture_documents_school_identity on public.documents;
create trigger capture_documents_school_identity
before insert or update of school_identity_snapshot on public.documents
for each row execute procedure public.capture_school_identity_snapshot();

drop trigger if exists capture_assessment_documents_school_identity on public.assessment_documents;
create trigger capture_assessment_documents_school_identity
before insert or update of school_identity_snapshot on public.assessment_documents
for each row execute procedure public.capture_school_identity_snapshot();

drop trigger if exists capture_result_sessions_school_identity on public.result_sessions;
create trigger capture_result_sessions_school_identity
before insert or update of school_identity_snapshot on public.result_sessions
for each row execute procedure public.capture_school_identity_snapshot();
