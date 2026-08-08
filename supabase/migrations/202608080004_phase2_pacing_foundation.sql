-- GuroDesk Phase 2 — instructional pacing / Budget of Work foundation
-- Curriculum-guide sequence, instructional pacing, and grading periods are
-- deliberately separate concepts. This prevents a quarter in a source curriculum
-- guide from being incorrectly treated as a three-term school-calendar term.

create table if not exists public.instructional_pacing_plans (
  id uuid primary key default gen_random_uuid(),
  school_year text not null,
  curriculum_subject_id uuid not null references public.curriculum_subjects(id) on delete cascade,
  school_year_calendar_id uuid references public.school_year_calendars(id) on delete set null,
  title text not null,
  pacing_type text not null default 'budget_of_work' check (pacing_type in ('budget_of_work','learning_delivery_guide','local_pacing','other')),
  scope text not null default 'national' check (scope in ('national','regional','division','school','teacher')),
  region text,
  division text,
  source_document_id uuid references public.source_documents(id) on delete set null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','superseded')),
  status text not null default 'draft' check (status in ('draft','active','superseded')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_year, curriculum_subject_id, title, scope)
);

create table if not exists public.instructional_pacing_entries (
  id uuid primary key default gen_random_uuid(),
  pacing_plan_id uuid not null references public.instructional_pacing_plans(id) on delete cascade,
  grading_period_id uuid references public.grading_periods(id) on delete set null,
  competency_id uuid not null references public.curriculum_competencies(id) on delete cascade,
  week_number integer check (week_number is null or week_number > 0),
  sequence integer not null default 0 check (sequence >= 0),
  suggested_sessions integer check (suggested_sessions is null or suggested_sessions > 0),
  suggested_minutes integer check (suggested_minutes is null or suggested_minutes > 0),
  pacing_note text,
  source_page integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (pacing_plan_id, competency_id, grading_period_id, week_number)
);

create index if not exists idx_pacing_plans_lookup
  on public.instructional_pacing_plans(school_year, curriculum_subject_id, status, verification_status);

create index if not exists idx_pacing_entries_plan_term_week
  on public.instructional_pacing_entries(pacing_plan_id, grading_period_id, week_number, sequence);

create index if not exists idx_pacing_entries_competency
  on public.instructional_pacing_entries(competency_id);

-- Prevent accidental cross-subject or cross-calendar mappings. A pacing entry
-- must point to a competency from the plan's curriculum subject and, when a
-- grading period is supplied, that period must belong to the plan's calendar.
create or replace function public.validate_instructional_pacing_entry_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  plan_subject_id uuid;
  plan_calendar_id uuid;
  competency_subject_id uuid;
  period_calendar_id uuid;
begin
  select curriculum_subject_id, school_year_calendar_id
    into plan_subject_id, plan_calendar_id
  from public.instructional_pacing_plans
  where id = new.pacing_plan_id;

  select subject_id into competency_subject_id
  from public.curriculum_competencies
  where id = new.competency_id;

  if plan_subject_id is null or competency_subject_id is null or plan_subject_id <> competency_subject_id then
    raise exception 'pacing competency must belong to the pacing plan curriculum subject';
  end if;

  if new.grading_period_id is not null then
    select school_year_calendar_id into period_calendar_id
    from public.grading_periods
    where id = new.grading_period_id;

    if plan_calendar_id is null or period_calendar_id is null or plan_calendar_id <> period_calendar_id then
      raise exception 'pacing grading period must belong to the pacing plan school-year calendar';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists instructional_pacing_entries_validate_context on public.instructional_pacing_entries;
create trigger instructional_pacing_entries_validate_context
before insert or update of pacing_plan_id, grading_period_id, competency_id
on public.instructional_pacing_entries
for each row execute function public.validate_instructional_pacing_entry_context();

alter table public.instructional_pacing_plans enable row level security;
alter table public.instructional_pacing_entries enable row level security;

create policy "knowledge_read_verified_pacing_plans" on public.instructional_pacing_plans
for select to authenticated
using (
  verification_status in ('verified','superseded')
  and status in ('active','superseded')
  and exists (
    select 1
    from public.curriculum_subjects cs
    join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
    where cs.id = instructional_pacing_plans.curriculum_subject_id
      and cv.status in ('active','superseded')
  )
  and (
    source_document_id is null
    or exists (
      select 1 from public.source_documents sd
      where sd.id = instructional_pacing_plans.source_document_id
        and sd.verification_status in ('verified','superseded')
    )
  )
);

create policy "knowledge_read_verified_pacing_entries" on public.instructional_pacing_entries
for select to authenticated
using (exists (
  select 1
  from public.instructional_pacing_plans ipp
  where ipp.id = instructional_pacing_entries.pacing_plan_id
    and ipp.verification_status in ('verified','superseded')
    and ipp.status in ('active','superseded')
));

create trigger instructional_pacing_plans_set_updated_at
before update on public.instructional_pacing_plans
for each row execute function public.set_updated_at();

comment on table public.instructional_pacing_plans is
  'Verified Budget of Work / learning-delivery pacing layer connecting curriculum competencies to the school-year grading calendar.';
comment on table public.instructional_pacing_entries is
  'Maps verified curriculum competencies to pacing-plan grading periods/weeks; prevents direct quarter-to-term assumptions.';
