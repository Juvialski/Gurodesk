-- GuroDesk school district identity foundation.
--
-- District is a real DepEd school-profile field, but DepEd NID does not expose
-- a complete national School ID -> District mapping.  District metadata is
-- therefore nullable on directory records and may be enriched only from
-- verified official DepEd sources.  Teacher-entered district remains supported
-- for schools whose verified mapping has not been loaded yet.

alter table public.philippine_schools
  add column if not exists district_code text,
  add column if not exists district_name text,
  add column if not exists district_source_name text,
  add column if not exists district_source_url text,
  add column if not exists district_verified_at timestamptz;

create index if not exists idx_philippine_schools_region_division_district
  on public.philippine_schools(region_name, division_name, district_name)
  where is_active = true;

alter table public.profiles
  add column if not exists district text not null default '',
  add column if not exists district_source text not null default 'unknown',
  add column if not exists district_verified boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_district_source_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_district_source_check
      check (district_source in ('deped_official', 'manual', 'unknown'));
  end if;
end $$;

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

    if nullif(trim(coalesce(directory_school.district_name, '')), '') is not null then
      new.district := trim(directory_school.district_name);
      new.district_source := 'deped_official';
      new.district_verified := true;
    else
      new.district := trim(coalesce(new.district, ''));
      new.district_source := case when new.district = '' then 'unknown' else 'manual' end;
      new.district_verified := false;
    end if;
  else
    new.school_directory_id := null;
    new.school_id := nullif(trim(coalesce(new.school_id, '')), '');
    new.school_name := trim(coalesce(new.school_name, ''));
    new.region := trim(coalesce(new.region, ''));
    new.division := trim(coalesce(new.division, ''));
    new.school_source := 'custom';
    new.school_is_custom := true;
    new.district := trim(coalesce(new.district, ''));
    new.district_source := case when new.district = '' then 'unknown' else 'manual' end;
    new.district_verified := false;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_school_identity on public.profiles;
create trigger guard_profile_school_identity
before insert or update of
  school_directory_id, school_id, school_name, region, division,
  school_source, school_is_custom, district, district_source, district_verified
on public.profiles
for each row execute procedure public.guard_profile_school_identity();

create or replace function public.list_philippine_school_districts(
  p_region text,
  p_division text
)
returns table (district_code text, district_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select min(s.district_code) as district_code, s.district_name
  from public.philippine_schools s
  where s.is_active = true
    and s.region_name = trim(p_region)
    and s.division_name = trim(p_division)
    and nullif(trim(coalesce(s.district_name, '')), '') is not null
  group by s.district_name
  order by s.district_name;
$$;

grant execute on function public.list_philippine_school_districts(text, text) to authenticated;

create or replace function public.search_philippine_schools_v2(
  p_query text default '',
  p_region text default null,
  p_division text default null,
  p_district text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  school_id text,
  school_name text,
  region_code text,
  region_name text,
  division_code text,
  division_name text,
  district_code text,
  district_name text,
  municipality text,
  province text,
  school_type text,
  classification text,
  is_active boolean,
  source_name text,
  source_url text,
  source_version text,
  source_checked_at timestamptz,
  district_source_name text,
  district_source_url text,
  district_verified_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id, s.school_id, s.school_name, s.region_code, s.region_name,
    s.division_code, s.division_name, s.district_code, s.district_name,
    s.municipality, s.province, s.school_type, s.classification,
    s.is_active, s.source_name, s.source_url, s.source_version,
    s.source_checked_at, s.district_source_name, s.district_source_url,
    s.district_verified_at
  from public.philippine_schools s
  where s.is_active = true
    and (nullif(trim(p_region), '') is null or s.region_name = trim(p_region))
    and (nullif(trim(p_division), '') is null or s.division_name = trim(p_division))
    and (nullif(trim(p_district), '') is null or s.district_name = trim(p_district))
    and (
      nullif(public.normalize_philippine_school_search(p_query), '') is null
      or s.search_name like '%' || public.normalize_philippine_school_search(p_query) || '%'
    )
  order by
    case when s.school_id = trim(p_query) then 0 else 1 end,
    s.school_name,
    s.school_id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_philippine_schools_v2(
  text, text, text, text, integer, integer
) to authenticated;

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
      'district', p.district,
      'districtSource', p.district_source,
      'districtVerified', p.district_verified,
      'source', p.school_source,
      'isCustom', p.school_is_custom
    )
  into new.school_identity_snapshot
  from public.profiles p
  where p.id = new.user_id;

  return new;
end;
$$;
