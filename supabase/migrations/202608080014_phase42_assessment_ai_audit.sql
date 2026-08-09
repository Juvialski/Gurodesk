-- GuroDesk Phase 4.2: teacher-owned assessment AI audit metadata.
-- No prompt, answer text, secret, learner data, or generated content is stored.

create table if not exists public.assessment_ai_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_document_id uuid not null references public.documents(id) on delete cascade,
  -- Item UUIDs are stable in the document API but draft saves may replace the
  -- normalized projection.  Keep the audited UUID without an FK so history is
  -- never erased by a later draft save.
  assessment_item_id uuid not null,
  question_type public.assessment_question_type not null,
  alternative boolean not null default false,
  provider text not null default 'google' check (provider = 'google'),
  model text not null check (char_length(model) between 1 and 120),
  fallback_used boolean not null default false,
  outcome text not null check (outcome in ('success', 'rejected', 'error', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_assessment_ai_audit_user_created
  on public.assessment_ai_audit_events(user_id, created_at desc);
create index if not exists idx_assessment_ai_audit_assessment_created
  on public.assessment_ai_audit_events(assessment_document_id, created_at desc);
create index if not exists idx_assessment_ai_audit_item_created
  on public.assessment_ai_audit_events(assessment_item_id, created_at desc);

alter table public.assessment_ai_audit_events enable row level security;

drop policy if exists assessment_ai_audit_select_own on public.assessment_ai_audit_events;
create policy assessment_ai_audit_select_own on public.assessment_ai_audit_events
for select to authenticated
using ((select auth.uid()) = user_id);

-- The generator Edge Function writes through the service-role client after it has
-- authenticated the teacher and rechecked assessment/item ownership.  Browser
-- sessions receive no insert/update/delete policy.
drop policy if exists assessment_ai_audit_insert_service on public.assessment_ai_audit_events;
create policy assessment_ai_audit_insert_service on public.assessment_ai_audit_events
for insert to service_role
with check (true);

create or replace function public.guard_assessment_ai_audit_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assessment_owner uuid;
  item_assessment uuid;
begin
  select d.user_id into assessment_owner
  from public.documents d
  where d.id = new.assessment_document_id and d.document_type = 'assessment';
  select ai.assessment_document_id into item_assessment
  from public.assessment_items ai where ai.id = new.assessment_item_id;
  if assessment_owner is null or item_assessment is distinct from new.assessment_document_id
     or assessment_owner is distinct from new.user_id then
    raise exception 'Assessment AI audit event must belong to the same teacher-owned assessment item';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_ai_audit_owner_guard on public.assessment_ai_audit_events;
create trigger assessment_ai_audit_owner_guard
before insert on public.assessment_ai_audit_events
for each row execute function public.guard_assessment_ai_audit_owner();

comment on table public.assessment_ai_audit_events is
'Teacher-owned, content-free audit metadata for assessment question drafting: assessment/item/model/fallback/outcome only. Prompts, answers, learner data, and BYOK secrets are excluded.';
