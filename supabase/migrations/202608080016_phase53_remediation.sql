-- GuroDesk Phase 5.3: teacher-reviewed remediation plans.
--
-- Targets are snapshots of deterministic analysis evidence.  Thresholds are
-- configurable product/teacher settings, not national DepEd cutoffs.  A plan
-- stores only the selected participant references needed by its owning
-- teacher; the optional AI function never receives these references.

create table if not exists public.remediation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_session_id uuid not null,
  scope text not null check (scope in ('whole_class', 'selected_learners')),
  threshold numeric(7,5) not null default 0.75 check (threshold between 0 and 1),
  threshold_basis text not null default 'percentage_correct'
    check (threshold_basis in ('percentage_correct', 'point_facility')),
  threshold_comparison text not null default 'below'
    check (threshold_comparison in ('below', 'at_or_below')),
  teacher_selected_target text not null default '' check (octet_length(teacher_selected_target) <= 500),
  planned_activity text not null default '' check (octet_length(planned_activity) <= 8000),
  scheduled_for date,
  follow_up_evidence text not null default '' check (octet_length(follow_up_evidence) <= 5000),
  notes text not null default '' check (octet_length(notes) <= 5000),
  teacher_reviewed boolean not null default false,
  review_state text not null default 'draft' check (review_state in ('draft', 'teacher_reviewed', 'archived')),
  optional_assistant_suggestion text check (optional_assistant_suggestion is null or octet_length(optional_assistant_suggestion) <= 8000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (result_session_id, user_id)
    references public.result_sessions(id, user_id) on delete cascade
);

create table if not exists public.remediation_plan_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  remediation_plan_id uuid not null,
  competency_id text not null check (char_length(btrim(competency_id)) between 1 and 160),
  competency_text_snapshot text not null check (char_length(btrim(competency_text_snapshot)) between 1 and 1000),
  curriculum_period_id text,
  curriculum_period_label text not null default '',
  evidence_value numeric(9,6) check (evidence_value is null or evidence_value between 0 and 1),
  evidence_label text not null check (evidence_label in ('percentage_correct', 'point_facility')),
  item_numbers integer[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  unique (remediation_plan_id, competency_id, curriculum_period_id),
  foreign key (remediation_plan_id, user_id)
    references public.remediation_plans(id, user_id) on delete cascade
);

create table if not exists public.remediation_plan_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  remediation_plan_id uuid not null,
  result_session_id uuid not null,
  participant_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (remediation_plan_id, participant_id),
  foreign key (remediation_plan_id, user_id)
    references public.remediation_plans(id, user_id) on delete cascade,
  foreign key (participant_id, result_session_id, user_id)
    references public.result_session_learners(id, result_session_id, user_id) on delete restrict
);

create index if not exists idx_remediation_plans_owner_updated
  on public.remediation_plans(user_id, updated_at desc);
create index if not exists idx_remediation_plans_owner_session
  on public.remediation_plans(user_id, result_session_id, review_state, updated_at desc);
create index if not exists idx_remediation_plan_targets_owner_plan
  on public.remediation_plan_targets(user_id, remediation_plan_id, competency_id);
create index if not exists idx_remediation_plan_participants_owner_plan
  on public.remediation_plan_participants(user_id, remediation_plan_id, participant_id);

drop trigger if exists remediation_plans_set_updated_at on public.remediation_plans;
create trigger remediation_plans_set_updated_at
before update on public.remediation_plans
for each row execute function public.set_updated_at();

create or replace function public.guard_remediation_plan_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_owner uuid;
  session_status text;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select rs.user_id, rs.status into session_owner, session_status
  from public.result_sessions rs where rs.id = new.result_session_id;
  if session_owner is null or session_owner is distinct from new.user_id or session_status = 'archived' then
    raise exception 'Remediation plan must belong to the result owner and a non-archived result session';
  end if;
  if new.review_state = 'teacher_reviewed' and not new.teacher_reviewed then
    raise exception 'Reviewed remediation plans must be marked teacher reviewed';
  end if;
  if new.review_state = 'draft' and new.teacher_reviewed then
    raise exception 'Teacher-reviewed remediation plans must use the reviewed state';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.result_session_id is distinct from old.result_session_id
    or new.created_at is distinct from old.created_at
  ) then raise exception 'Remediation plan identity is immutable'; end if;
  if tg_op = 'INSERT' and coalesce(current_setting('app.remediation_rpc', true), '') <> '1' then
    raise exception 'Remediation plans must be created through the remediation RPC';
  end if;
  if tg_op = 'UPDATE' and coalesce(current_setting('app.remediation_rpc', true), '') <> '1' then
    raise exception 'Remediation plans must be edited through the remediation RPC';
  end if;
  return new;
end;
$$;

create or replace function public.guard_remediation_child_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_owner uuid;
  plan_state text;
  plan_session_id uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select rp.user_id, rp.review_state, rp.result_session_id into plan_owner, plan_state, plan_session_id
  from public.remediation_plans rp where rp.id = new.remediation_plan_id;
  if plan_owner is null or plan_owner is distinct from new.user_id or plan_state = 'archived' then
    raise exception 'Remediation child row must belong to its active plan owner';
  end if;
  if coalesce(current_setting('app.remediation_rpc', true), '') <> '1' then
    raise exception 'Remediation child rows must be written through the remediation RPC';
  end if;
  if tg_table_name = 'remediation_plan_participants'
     and new.result_session_id is distinct from plan_session_id then
    raise exception 'Remediation participant must belong to the plan result session';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.remediation_plan_id is distinct from old.remediation_plan_id
    or new.created_at is distinct from old.created_at
  ) then raise exception 'Remediation child identity is immutable'; end if;
  return new;
end;
$$;

drop trigger if exists remediation_plan_owner_guard on public.remediation_plans;
create trigger remediation_plan_owner_guard
before insert or update on public.remediation_plans
for each row execute function public.guard_remediation_plan_owner();
drop trigger if exists remediation_plan_target_owner_guard on public.remediation_plan_targets;
create trigger remediation_plan_target_owner_guard
before insert or update on public.remediation_plan_targets
for each row execute function public.guard_remediation_child_owner();
drop trigger if exists remediation_plan_participant_owner_guard on public.remediation_plan_participants;
create trigger remediation_plan_participant_owner_guard
before insert or update on public.remediation_plan_participants
for each row execute function public.guard_remediation_child_owner();

alter table public.remediation_plans enable row level security;
alter table public.remediation_plan_targets enable row level security;
alter table public.remediation_plan_participants enable row level security;

drop policy if exists remediation_plans_select_own on public.remediation_plans;
create policy remediation_plans_select_own on public.remediation_plans
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists remediation_plan_targets_select_own on public.remediation_plan_targets;
create policy remediation_plan_targets_select_own on public.remediation_plan_targets
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists remediation_plan_participants_select_own on public.remediation_plan_participants;
create policy remediation_plan_participants_select_own on public.remediation_plan_participants
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.remediation_plans, public.remediation_plan_targets,
  public.remediation_plan_participants from public;
grant select on public.remediation_plans, public.remediation_plan_targets,
  public.remediation_plan_participants to authenticated;

create or replace function public.save_remediation_plan(p_plan jsonb)
returns public.remediation_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  plan_id uuid;
  session_id uuid;
  plan_row public.remediation_plans%rowtype;
  session_row public.result_sessions%rowtype;
  target_value jsonb;
  participant_value jsonb;
  target_competency_id text;
  target_competency_text text;
  target_period_id text;
  target_period_label text;
  target_evidence numeric;
  target_evidence_label text;
  target_item_numbers integer[];
  target_item_number integer;
  participant_id_value uuid;
  selected_ids uuid[] := '{}';
  scope_value text;
  threshold_value numeric;
  basis_value text;
  comparison_value text;
  teacher_reviewed_value boolean;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if jsonb_typeof(p_plan) is distinct from 'object' or octet_length(p_plan::text) > 256 * 1024 then
    raise exception 'Remediation plan payload is invalid or too large';
  end if;
  session_id := nullif(btrim(p_plan ->> 'resultSessionId'), '')::uuid;
  if session_id is null then raise exception 'A result session is required'; end if;
  select * into session_row from public.result_sessions rs
  where rs.id = session_id and rs.user_id = owner_id and rs.status in ('draft', 'final') for share;
  if session_row.id is null then raise exception 'Owned draft or final result session not found'; end if;
  plan_id := nullif(btrim(p_plan ->> 'id'), '')::uuid;
  scope_value := p_plan ->> 'scope';
  if scope_value not in ('whole_class', 'selected_learners') then raise exception 'Invalid remediation scope'; end if;
  threshold_value := coalesce(nullif(p_plan ->> 'threshold', '')::numeric, 0.75);
  if threshold_value < 0 or threshold_value > 1 then raise exception 'Threshold must be between 0 and 1'; end if;
  basis_value := coalesce(nullif(p_plan ->> 'thresholdBasis', ''), 'percentage_correct');
  comparison_value := coalesce(nullif(p_plan ->> 'thresholdComparison', ''), 'below');
  if basis_value not in ('percentage_correct', 'point_facility') or comparison_value not in ('below', 'at_or_below') then
    raise exception 'Invalid remediation threshold configuration';
  end if;
  teacher_reviewed_value := coalesce((p_plan ->> 'teacherReviewed')::boolean, false);
  if jsonb_typeof(coalesce(p_plan -> 'targets', '[]'::jsonb)) is distinct from 'array'
     or jsonb_array_length(coalesce(p_plan -> 'targets', '[]'::jsonb)) not between 1 and 100 then
    raise exception 'At least one and at most 100 remediation targets are required';
  end if;
  if jsonb_typeof(coalesce(p_plan -> 'selectedParticipantIds', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Selected participants must be an array';
  end if;
  if jsonb_array_length(coalesce(p_plan -> 'selectedParticipantIds', '[]'::jsonb)) > 1000 then
    raise exception 'Too many selected participants';
  end if;
  if scope_value = 'whole_class' and jsonb_array_length(coalesce(p_plan -> 'selectedParticipantIds', '[]'::jsonb)) <> 0 then
    raise exception 'Whole-class plans cannot carry a selected participant list';
  end if;
  if scope_value = 'selected_learners' and jsonb_array_length(coalesce(p_plan -> 'selectedParticipantIds', '[]'::jsonb)) < 1 then
    raise exception 'Selected-learner plans require at least one participant';
  end if;
  if exists (
    select value::uuid from jsonb_array_elements_text(coalesce(p_plan -> 'selectedParticipantIds', '[]'::jsonb)) value
    group by value::uuid having count(*) > 1
  ) then raise exception 'Duplicate selected participants are not allowed'; end if;
  for participant_value in select value from jsonb_array_elements(coalesce(p_plan -> 'selectedParticipantIds', '[]'::jsonb)) loop
    if participant_value #>> '{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Selected participants must be UUIDs';
    end if;
    selected_ids := array_append(selected_ids, (participant_value #>> '{}')::uuid);
  end loop;
  if cardinality(selected_ids) > 0 and not exists (
    select 1 from public.result_session_learners p
    where p.result_session_id = session_id and p.user_id = owner_id and p.id = any(selected_ids)
  ) then raise exception 'Selected participant is not in the result session'; end if;
  if cardinality(selected_ids) > 0 and (
    select count(*) from public.result_session_learners p
    where p.result_session_id = session_id and p.user_id = owner_id and p.id = any(selected_ids)
  ) <> cardinality(selected_ids) then raise exception 'Selected participant is not in the result session'; end if;
  perform set_config('app.remediation_rpc', '1', true);
  if plan_id is null then
    insert into public.remediation_plans (
      user_id, result_session_id, scope, threshold, threshold_basis, threshold_comparison,
      teacher_selected_target, planned_activity, scheduled_for, follow_up_evidence, notes,
      teacher_reviewed, review_state, optional_assistant_suggestion
    ) values (
      owner_id, session_id, scope_value, threshold_value, basis_value, comparison_value,
      left(coalesce(p_plan ->> 'teacherSelectedTarget', ''), 500),
      left(coalesce(p_plan ->> 'plannedActivity', ''), 8000),
      nullif(p_plan ->> 'scheduledFor', '')::date,
      left(coalesce(p_plan ->> 'followUpEvidence', ''), 5000),
      left(coalesce(p_plan ->> 'notes', ''), 5000), teacher_reviewed_value,
      case when teacher_reviewed_value then 'teacher_reviewed' else 'draft' end,
      nullif(left(coalesce(p_plan ->> 'optionalAssistantSuggestion', ''), 8000), '')
    ) returning * into plan_row;
  else
    select * into plan_row from public.remediation_plans where id = plan_id and user_id = owner_id for update;
    if plan_row.id is null then raise exception 'Remediation plan not found'; end if;
    if plan_row.review_state = 'archived' then raise exception 'Archived remediation plans are immutable'; end if;
    if plan_row.result_session_id is distinct from session_id then raise exception 'Remediation plan result session is immutable'; end if;
    update public.remediation_plans set
      scope = scope_value, threshold = threshold_value, threshold_basis = basis_value,
      threshold_comparison = comparison_value,
      teacher_selected_target = left(coalesce(p_plan ->> 'teacherSelectedTarget', ''), 500),
      planned_activity = left(coalesce(p_plan ->> 'plannedActivity', ''), 8000),
      scheduled_for = nullif(p_plan ->> 'scheduledFor', '')::date,
      follow_up_evidence = left(coalesce(p_plan ->> 'followUpEvidence', ''), 5000),
      notes = left(coalesce(p_plan ->> 'notes', ''), 5000),
      teacher_reviewed = teacher_reviewed_value,
      review_state = case when teacher_reviewed_value then 'teacher_reviewed' else 'draft' end,
      optional_assistant_suggestion = nullif(left(coalesce(p_plan ->> 'optionalAssistantSuggestion', ''), 8000), '')
    where id = plan_row.id returning * into plan_row;
  end if;
  delete from public.remediation_plan_targets where remediation_plan_id = plan_row.id;
  delete from public.remediation_plan_participants where remediation_plan_id = plan_row.id;
  for target_value in select value from jsonb_array_elements(p_plan -> 'targets') loop
    target_competency_id := btrim(target_value ->> 'competencyId');
    target_competency_text := btrim(target_value ->> 'competencyText');
    target_period_id := nullif(btrim(target_value ->> 'curriculumPeriodId'), '');
    target_period_label := coalesce(target_value ->> 'curriculumPeriodLabel', '');
    target_evidence := case when target_value ->> 'evidenceValue' is null then null else (target_value ->> 'evidenceValue')::numeric end;
    target_evidence_label := target_value ->> 'evidenceLabel';
    if target_competency_id = '' or target_competency_text = '' or char_length(target_competency_text) > 1000
       or target_evidence_label not in ('percentage_correct', 'point_facility')
       or target_evidence is not null and (target_evidence < 0 or target_evidence > 1) then
      raise exception 'Remediation target evidence is invalid';
    end if;
    if jsonb_typeof(coalesce(target_value -> 'itemNumbers', '[]'::jsonb)) is distinct from 'array' then
      raise exception 'Remediation target item numbers must be an array';
    end if;
    select coalesce(array_agg((value #>> '{}')::integer order by (value #>> '{}')::integer), '{}')
      into target_item_numbers from jsonb_array_elements(target_value -> 'itemNumbers') value;
    if cardinality(target_item_numbers) = 0 then raise exception 'Remediation targets require mapped item numbers'; end if;
    if exists (
      select 1 from unnest(target_item_numbers) number_value
      where number_value < 1 or number_value > 10000
    ) then raise exception 'Remediation target item number is invalid'; end if;
    if not exists (
      select 1 from jsonb_array_elements(session_row.assessment_snapshot -> 'items') snapshot_item
      where snapshot_item -> 'competencySnapshot' ->> 'id' = target_competency_id
        and snapshot_item -> 'competencySnapshot' ->> 'text' = target_competency_text
        and (target_period_id is null or snapshot_item -> 'competencySnapshot' ->> 'curriculumPeriodId' = target_period_id)
    ) then raise exception 'Remediation target is not present in the immutable assessment mapping'; end if;
    foreach target_item_number in array target_item_numbers loop
      if not exists (
        select 1 from jsonb_array_elements(session_row.assessment_snapshot -> 'items') snapshot_item
        where (snapshot_item ->> 'itemNumber')::integer = target_item_number
          and snapshot_item -> 'competencySnapshot' ->> 'id' = target_competency_id
      ) then raise exception 'Remediation target item is outside its competency mapping'; end if;
    end loop;
    insert into public.remediation_plan_targets (
      user_id, remediation_plan_id, competency_id, competency_text_snapshot,
      curriculum_period_id, curriculum_period_label, evidence_value, evidence_label, item_numbers
    ) values (
      owner_id, plan_row.id, target_competency_id, target_competency_text,
      target_period_id, left(target_period_label, 300), target_evidence, target_evidence_label, target_item_numbers
    );
  end loop;
  foreach participant_id_value in array selected_ids loop
    insert into public.remediation_plan_participants (user_id, remediation_plan_id, result_session_id, participant_id)
    values (owner_id, plan_row.id, session_id, participant_id_value);
  end loop;
  return plan_row;
end;
$$;

revoke all on function public.save_remediation_plan(jsonb) from public;
grant execute on function public.save_remediation_plan(jsonb) to authenticated;

create or replace function public.archive_remediation_plan(p_plan_id uuid)
returns public.remediation_plans
language plpgsql
security definer
set search_path = ''
as $$
declare owner_id uuid := auth.uid(); saved public.remediation_plans%rowtype;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into saved from public.remediation_plans where id = p_plan_id and user_id = owner_id for update;
  if saved.id is null then raise exception 'Remediation plan not found'; end if;
  if saved.review_state = 'archived' then return saved; end if;
  perform set_config('app.remediation_rpc', '1', true);
  update public.remediation_plans set review_state = 'archived' where id = saved.id returning * into saved;
  return saved;
end;
$$;

revoke all on function public.archive_remediation_plan(uuid) from public;
grant execute on function public.archive_remediation_plan(uuid) to authenticated;

create or replace function public.delete_draft_remediation_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare owner_id uuid := auth.uid(); plan_state text;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select review_state into plan_state from public.remediation_plans where id = p_plan_id and user_id = owner_id for update;
  if plan_state is null then raise exception 'Remediation plan not found'; end if;
  if plan_state <> 'draft' then raise exception 'Only draft remediation plans may be deleted'; end if;
  perform set_config('app.remediation_rpc', '1', true);
  delete from public.remediation_plans where id = p_plan_id and user_id = owner_id;
end;
$$;

revoke all on function public.delete_draft_remediation_plan(uuid) from public;
grant execute on function public.delete_draft_remediation_plan(uuid) to authenticated;

comment on table public.remediation_plans is
'Teacher-owned, reviewable remediation plan tied to a result session. Thresholds are configurable analytical conventions, not DepEd mandates; no retention period is asserted.';
comment on table public.remediation_plan_targets is
'Immutable-at-save snapshots of deterministic competency evidence and item traceability for the owning teacher''s plan.';
