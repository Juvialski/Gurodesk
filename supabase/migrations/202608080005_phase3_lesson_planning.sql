-- GuroDesk Phase 3: ILAW lesson planning support
-- Extends the generic documents model without duplicating lesson-plan content.

create table if not exists public.lesson_plan_competencies (
  document_id uuid not null references public.documents(id) on delete cascade,
  competency_id uuid not null references public.curriculum_competencies(id) on delete restrict,
  competency_text_snapshot text not null,
  competency_code_snapshot text,
  source_page_snapshot integer,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (document_id, competency_id)
);

create table if not exists public.lesson_plan_ai_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  support_type text not null check (support_type in ('refine_clarity','organize_text','grammar_spelling','format_text','translate')),
  section_key text not null,
  declaration_category text not null check (declaration_category in ('limited','guided')),
  provider text not null default 'google',
  model text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_lesson_plan_competencies_document on public.lesson_plan_competencies(document_id);
create index if not exists idx_lesson_plan_competencies_competency on public.lesson_plan_competencies(competency_id);
create index if not exists idx_lesson_plan_ai_events_user on public.lesson_plan_ai_events(user_id, created_at desc);
create index if not exists idx_lesson_plan_ai_events_document on public.lesson_plan_ai_events(document_id, created_at desc);

alter table public.lesson_plan_competencies enable row level security;
alter table public.lesson_plan_ai_events enable row level security;

create policy "lesson_plan_competencies_select_own" on public.lesson_plan_competencies
for select to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = lesson_plan_competencies.document_id
    and d.user_id = (select auth.uid())
    and d.document_type = 'lesson_plan'
));

create policy "lesson_plan_competencies_insert_own" on public.lesson_plan_competencies
for insert to authenticated
with check (
  exists (
    select 1 from public.documents d
    where d.id = lesson_plan_competencies.document_id
      and d.user_id = (select auth.uid())
      and d.document_type = 'lesson_plan'
  )
  and exists (
    select 1 from public.curriculum_competencies c
    where c.id = lesson_plan_competencies.competency_id
      and c.verification_status = 'verified'
  )
);

create policy "lesson_plan_competencies_delete_own" on public.lesson_plan_competencies
for delete to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = lesson_plan_competencies.document_id
    and d.user_id = (select auth.uid())
    and d.document_type = 'lesson_plan'
));

create policy "lesson_plan_ai_events_select_own" on public.lesson_plan_ai_events
for select to authenticated
using ((select auth.uid()) = user_id);

-- Normal browser clients do not insert audit events directly. The Edge Function uses
-- the authenticated user's JWT and can insert only its own user_id through this policy.
create policy "lesson_plan_ai_events_insert_own" on public.lesson_plan_ai_events
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = lesson_plan_ai_events.document_id
        and d.user_id = (select auth.uid())
        and d.document_type = 'lesson_plan'
    )
  )
);

-- Prevent a lesson-plan competency link from pointing to a non-lesson document.
create or replace function public.guard_lesson_plan_competency_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.document_type = 'lesson_plan'
  ) then
    raise exception 'lesson_plan_competencies can only link lesson_plan documents';
  end if;
  return new;
end;
$$;

drop trigger if exists lesson_plan_competency_guard on public.lesson_plan_competencies;
create trigger lesson_plan_competency_guard
before insert or update on public.lesson_plan_competencies
for each row execute function public.guard_lesson_plan_competency_link();
