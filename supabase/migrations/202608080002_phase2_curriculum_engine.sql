-- GuroDesk Phase 2 — Curriculum Engine
-- Adds phased curriculum applicability and separates curriculum sequence periods
-- from school-year grading periods. No browser client receives write access to
-- official knowledge tables.

alter table public.curriculum_versions
  add column if not exists implementation_notes text;

alter table public.source_documents
  add column if not exists publisher text not null default 'Department of Education',
  add column if not exists retrieved_on date;

-- `academic_periods` now represents sequence periods inside a specific curriculum
-- subject (for example Quarter 1 in a Grade 7 Mathematics guide). This is kept
-- separate from three-term grading/reporting periods introduced for SY 2026-2027.
alter table public.academic_periods
  add column if not exists subject_id uuid references public.curriculum_subjects(id) on delete cascade;

-- Phase 1 used version+label+grade bounds as a table-level unique constraint.
-- Once periods belong to subjects, two Grade 7 subjects may both legitimately
-- have a `Quarter 1`, so that old constraint must be replaced.
alter table public.academic_periods
  drop constraint if exists academic_periods_curriculum_version_id_label_grade_min_grade_max_key;

create index if not exists idx_academic_periods_subject_sequence
  on public.academic_periods(subject_id, sequence);

create unique index if not exists uq_academic_periods_subject_label
  on public.academic_periods(subject_id, label)
  where subject_id is not null;

create unique index if not exists uq_academic_periods_generic_label
  on public.academic_periods(
    curriculum_version_id,
    label,
    coalesce(grade_min, -1),
    coalesce(grade_max, -1)
  )
  where subject_id is null;

-- Keep the duplicated version reference consistent with the selected subject.
-- It exists for efficient version-level filtering, but must never point at a
-- different curriculum version than the subject itself.
create or replace function public.validate_academic_period_subject_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  subject_version_id uuid;
begin
  if new.subject_id is null then
    return new;
  end if;

  select curriculum_version_id into subject_version_id
  from public.curriculum_subjects
  where id = new.subject_id;

  if subject_version_id is null or subject_version_id <> new.curriculum_version_id then
    raise exception 'academic_periods subject_id and curriculum_version_id must refer to the same curriculum version';
  end if;

  return new;
end;
$$;

drop trigger if exists academic_periods_validate_subject_version on public.academic_periods;
create trigger academic_periods_validate_subject_version
before insert or update of subject_id, curriculum_version_id on public.academic_periods
for each row execute function public.validate_academic_period_subject_version();

create unique index if not exists uq_source_documents_source_url
  on public.source_documents(source_url)
  where source_url is not null;

create unique index if not exists uq_source_documents_issuance_code
  on public.source_documents(issuance_code)
  where issuance_code is not null;

-- Curriculum versions are phased by grade and school year. A version-wide
-- effective date is not enough to represent MATATAG/Revised K to 10 rollout or
-- Senior High School transitions.
create table if not exists public.curriculum_applicability (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete cascade,
  school_year text not null,
  grade_level text not null,
  implementation_status text not null check (implementation_status in ('full','pilot','transitional','legacy')),
  priority integer not null default 100 check (priority > 0),
  source_document_id uuid references public.source_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (curriculum_version_id, school_year, grade_level, implementation_status)
);

create index if not exists idx_curriculum_applicability_lookup
  on public.curriculum_applicability(school_year, grade_level, priority);

-- Grading/reporting calendar is intentionally independent from curriculum guide
-- sequence. For SY 2026-2027 DepEd uses three grading terms while the underlying
-- K-10 curriculum guides may still be organized in quarters.
create table if not exists public.school_year_calendars (
  id uuid primary key default gen_random_uuid(),
  school_year text not null unique,
  calendar_type text not null check (calendar_type in ('three_term','four_quarter','semester','other')),
  grading_period_count integer not null check (grading_period_count > 0),
  source_document_id uuid references public.source_documents(id) on delete set null,
  status text not null default 'active' check (status in ('draft','active','superseded')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.grading_periods (
  id uuid primary key default gen_random_uuid(),
  school_year_calendar_id uuid not null references public.school_year_calendars(id) on delete cascade,
  label text not null,
  sequence integer not null check (sequence > 0),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_year_calendar_id, sequence),
  unique (school_year_calendar_id, label)
);

create trigger school_year_calendars_set_updated_at before update on public.school_year_calendars
for each row execute function public.set_updated_at();

alter table public.curriculum_applicability enable row level security;
alter table public.school_year_calendars enable row level security;
alter table public.grading_periods enable row level security;

create policy "knowledge_read_curriculum_applicability" on public.curriculum_applicability
for select to authenticated
using (exists (
  select 1 from public.curriculum_versions cv
  where cv.id = curriculum_applicability.curriculum_version_id
    and cv.status in ('active','superseded')
));

create policy "knowledge_read_school_year_calendars" on public.school_year_calendars
for select to authenticated
using (status in ('active','superseded'));

create policy "knowledge_read_grading_periods" on public.grading_periods
for select to authenticated
using (exists (
  select 1 from public.school_year_calendars syc
  where syc.id = grading_periods.school_year_calendar_id
    and syc.status in ('active','superseded')
));

comment on table public.curriculum_applicability is
  'Maps a curriculum version to the grade levels and school years where it actually applies; supports phased and transitional rollouts.';
comment on table public.school_year_calendars is
  'School-year grading/reporting calendar. Intentionally separate from academic_periods used by curriculum guides.';
comment on column public.academic_periods.subject_id is
  'When set, identifies the curriculum subject whose internal sequence this period belongs to.';


-- Verified school-calendar metadata for the active school year. Dates are left
-- null until they are transcribed from the order itself; the app must never infer
-- term boundaries from press releases.
insert into public.source_documents (
  source_type, title, issuance_code, published_on, verification_status, retrieved_on
) values (
  'deped_order',
  'Guidelines on the Implementation of the Three-Term School Calendar in Basic Education',
  'DO 009, s. 2026',
  '2026-04-16',
  'verified',
  '2026-08-08'
)
on conflict (issuance_code) where issuance_code is not null do update set
  title = excluded.title,
  published_on = excluded.published_on,
  verification_status = 'verified',
  retrieved_on = excluded.retrieved_on,
  updated_at = timezone('utc', now());

insert into public.school_year_calendars (
  school_year, calendar_type, grading_period_count, source_document_id, status, notes
)
select
  '2026-2027',
  'three_term',
  3,
  sd.id,
  'active',
  'Three grading periods. Curriculum-guide sequence periods are stored separately and may still be quarter-based.'
from public.source_documents sd
where sd.issuance_code = 'DO 009, s. 2026'
on conflict (school_year) do update set
  calendar_type = excluded.calendar_type,
  grading_period_count = excluded.grading_period_count,
  source_document_id = excluded.source_document_id,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = timezone('utc', now());

insert into public.grading_periods (school_year_calendar_id, label, sequence)
select syc.id, v.label, v.sequence
from public.school_year_calendars syc
cross join (values ('Term 1', 1), ('Term 2', 2), ('Term 3', 3)) as v(label, sequence)
where syc.school_year = '2026-2027'
on conflict (school_year_calendar_id, sequence) do update set label = excluded.label;
