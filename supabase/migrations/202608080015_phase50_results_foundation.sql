-- GuroDesk Phase 5.0 / 5.1: teacher-owned learner rosters and result sessions.
--
-- Privacy boundary: a learner is represented only by a teacher-local display
-- name and optional local reference.  There is deliberately no LRN, contact,
-- demographic, household, health, or credential field in this migration.
--
-- Browser writes use the bounded RPCs below.  The RPCs derive the owner from
-- auth.uid(), lock and snapshot the finalized assessment server-side, and save
-- an entire draft batch in one transaction.  There are no per-answer writes.

-- Composite references make it impossible for a child row to pair an ID with
-- a different teacher's owner column, even if a future function is changed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.teacher_assignments'::regclass
      and conname = 'teacher_assignments_id_user_key'
  ) then
    alter table public.teacher_assignments
      add constraint teacher_assignments_id_user_key unique (id, user_id);
  end if;
end;
$$;

create table if not exists public.class_learners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null,
  section_name text not null check (char_length(btrim(section_name)) between 1 and 160),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 200),
  local_reference text check (local_reference is null or char_length(btrim(local_reference)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (assignment_id, user_id)
    references public.teacher_assignments(id, user_id) on delete restrict
);

create index if not exists idx_class_learners_owner_assignment_section
  on public.class_learners(user_id, assignment_id, section_name, status, updated_at desc);
create index if not exists idx_class_learners_assignment_reference
  on public.class_learners(assignment_id, section_name, lower(local_reference))
  where local_reference is not null;

drop trigger if exists class_learners_set_updated_at on public.class_learners;
create trigger class_learners_set_updated_at
before update on public.class_learners
for each row execute function public.set_updated_at();

create table if not exists public.result_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null,
  section_name text not null check (char_length(btrim(section_name)) between 1 and 160),
  assessment_document_id uuid not null references public.assessment_documents(document_id) on delete restrict,
  assessment_version_number integer not null check (assessment_version_number > 0),
  administration_date date not null default current_date,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  entry_mode text not null check (entry_mode in ('answer_sheet', 'item', 'score_only')),
  status text not null default 'draft' check (status in ('draft', 'final', 'archived')),
  assessment_snapshot jsonb not null,
  short_answer_scoring jsonb not null default '{"defaultMode":"manual","itemModes":{}}'::jsonb,
  version_number integer not null default 1 check (version_number > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  foreign key (assignment_id, user_id)
    references public.teacher_assignments(id, user_id) on delete restrict,
  check (jsonb_typeof(assessment_snapshot) = 'object'),
  check (jsonb_typeof(short_answer_scoring) = 'object'),
  check (octet_length(short_answer_scoring::text) <= 8000)
);

create index if not exists idx_result_sessions_owner_updated
  on public.result_sessions(user_id, updated_at desc);
create index if not exists idx_result_sessions_owner_assignment_section
  on public.result_sessions(user_id, assignment_id, section_name, status, updated_at desc);
create index if not exists idx_result_sessions_assessment
  on public.result_sessions(user_id, assessment_document_id, assessment_version_number);

create table if not exists public.result_session_learners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_session_id uuid not null,
  learner_id uuid not null references public.class_learners(id) on delete restrict,
  display_name_snapshot text not null check (char_length(btrim(display_name_snapshot)) between 1 and 200),
  local_reference_snapshot text,
  learner_was_active boolean not null default true,
  raw_score numeric(12,4),
  possible_points numeric(12,4) not null default 0 check (possible_points >= 0),
  percentage numeric(9,4),
  teacher_feedback text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, result_session_id, user_id),
  unique (result_session_id, learner_id),
  foreign key (result_session_id, user_id)
    references public.result_sessions(id, user_id) on delete cascade,
  foreign key (learner_id, user_id)
    references public.class_learners(id, user_id) on delete restrict
);

create index if not exists idx_result_session_learners_owner_session
  on public.result_session_learners(user_id, result_session_id, updated_at desc);
create index if not exists idx_result_session_learners_learner
  on public.result_session_learners(user_id, learner_id, result_session_id);

create table if not exists public.result_item_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_session_id uuid not null,
  participant_id uuid not null,
  learner_id uuid not null,
  item_id uuid not null,
  item_number integer not null check (item_number between 1 and 10000),
  learner_answer jsonb,
  is_correct boolean,
  earned_points numeric(12,4) not null default 0 check (earned_points >= 0),
  possible_points numeric(12,4) not null check (possible_points >= 0),
  teacher_feedback text,
  scoring_source text not null check (scoring_source in ('deterministic', 'teacher')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (result_session_id, participant_id, item_id),
  foreign key (participant_id, result_session_id, user_id)
    references public.result_session_learners(id, result_session_id, user_id) on delete cascade,
  foreign key (result_session_id, user_id)
    references public.result_sessions(id, user_id) on delete cascade,
  check (jsonb_typeof(learner_answer) in ('object', 'null')),
  check (learner_answer is null or octet_length(learner_answer::text) <= 4000),
  check (teacher_feedback is null or octet_length(teacher_feedback) <= 2000)
);

create index if not exists idx_result_item_outcomes_owner_session_item
  on public.result_item_outcomes(user_id, result_session_id, item_number, participant_id);
create index if not exists idx_result_item_outcomes_owner_participant
  on public.result_item_outcomes(user_id, participant_id, item_number);

create table if not exists public.result_score_only_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_session_id uuid not null,
  participant_id uuid not null,
  learner_id uuid not null,
  raw_score numeric(12,4),
  possible_points numeric(12,4) not null check (possible_points >= 0),
  teacher_feedback text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (result_session_id, participant_id),
  foreign key (participant_id, result_session_id, user_id)
    references public.result_session_learners(id, result_session_id, user_id) on delete cascade,
  foreign key (result_session_id, user_id)
    references public.result_sessions(id, user_id) on delete cascade,
  check (teacher_feedback is null or octet_length(teacher_feedback) <= 2000)
);

create index if not exists idx_result_score_only_owner_session
  on public.result_score_only_outcomes(user_id, result_session_id, participant_id);

-- Learner answers are intentionally small, typed value objects. The exact
-- key allow-list prevents a malformed client from smuggling learner names,
-- IDs, metadata, or an answer-sheet-like object into learner_answer while
-- keeping the answer useful for deterministic scoring. Text is bounded at
-- both this shape boundary and the column/RPC boundary below.
create or replace function public.result_answer_shape_valid(
  p_question_type text,
  p_answer jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  answer_type text;
  key_count integer;
begin
  if p_answer is null then return true; end if;
  if jsonb_typeof(p_answer) is distinct from 'object' then return false; end if;
  answer_type := p_answer ->> 'type';
  select count(*)::integer into key_count from jsonb_object_keys(p_answer);

  if p_question_type = 'multiple_choice' then
    return key_count = 2
      and answer_type = 'multiple_choice'
      and jsonb_typeof(p_answer -> 'choiceId') = 'string'
      and char_length(btrim(p_answer ->> 'choiceId')) between 1 and 240
      and octet_length(p_answer ->> 'choiceId') <= 960;
  elsif p_question_type = 'true_false' then
    return key_count = 2
      and answer_type = 'true_false'
      and jsonb_typeof(p_answer -> 'value') = 'boolean';
  elsif p_question_type = 'short_answer' then
    return key_count = 2
      and answer_type = 'short_answer'
      and jsonb_typeof(p_answer -> 'text') = 'string'
      and octet_length(p_answer ->> 'text') <= 3800;
  elsif p_question_type = 'constructed_response' then
    return answer_type = 'constructed_response'
      and key_count between 1 and 2
      and (key_count = 1
        or (key_count = 2 and p_answer ? 'text'))
      and (not (p_answer ? 'text') or jsonb_typeof(p_answer -> 'text') = 'string')
      and (not (p_answer ? 'text') or octet_length(p_answer ->> 'text') <= 3800);
  end if;
  return false;
end;
$$;

drop trigger if exists result_sessions_set_updated_at on public.result_sessions;
create trigger result_sessions_set_updated_at
before update on public.result_sessions
for each row execute function public.set_updated_at();
drop trigger if exists result_session_learners_set_updated_at on public.result_session_learners;
create trigger result_session_learners_set_updated_at
before update on public.result_session_learners
for each row execute function public.set_updated_at();
drop trigger if exists result_item_outcomes_set_updated_at on public.result_item_outcomes;
create trigger result_item_outcomes_set_updated_at
before update on public.result_item_outcomes
for each row execute function public.set_updated_at();
drop trigger if exists result_score_only_outcomes_set_updated_at on public.result_score_only_outcomes;
create trigger result_score_only_outcomes_set_updated_at
before update on public.result_score_only_outcomes
for each row execute function public.set_updated_at();

-- Generic child-row guards complement the composite FKs.  They are deliberately
-- independent of client-provided owner IDs and stop direct service mistakes
-- from mixing an assignment, section, assessment, and roster.
create or replace function public.guard_result_session_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_owner uuid;
  assignment_sections text[];
  assessment_owner uuid;
  assessment_assignment uuid;
  assessment_status text;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select ta.user_id, ta.section_names into assignment_owner, assignment_sections
  from public.teacher_assignments ta where ta.id = new.assignment_id;
  if assignment_owner is null or assignment_owner is distinct from new.user_id
     or not (new.section_name = any(assignment_sections)) then
    raise exception 'Result assignment and section must belong to the result owner';
  end if;
  select d.user_id, ad.assignment_id, d.status
    into assessment_owner, assessment_assignment, assessment_status
  from public.assessment_documents ad
  join public.documents d on d.id = ad.document_id
  where ad.document_id = new.assessment_document_id;
  if assessment_owner is null or assessment_owner is distinct from new.user_id
     or assessment_assignment is distinct from new.assignment_id
     or assessment_status <> 'final' then
    raise exception 'Results require the owner''s finalized assessment for this assignment';
  end if;
  if tg_op = 'INSERT' and (
    coalesce(current_setting('app.results_rpc', true), '') <> '1'
    or new.status <> 'draft'
  ) then
    raise exception 'Result sessions must begin as drafts through the results RPC';
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.assignment_id is distinct from old.assignment_id
       or new.section_name is distinct from old.section_name
       or new.assessment_document_id is distinct from old.assessment_document_id
       or new.assessment_version_number is distinct from old.assessment_version_number
       or new.assessment_snapshot is distinct from old.assessment_snapshot
       or new.created_at is distinct from old.created_at then
      raise exception 'Result session identity and assessment snapshot are immutable';
    end if;
    if old.status = 'archived' then
      raise exception 'Archived result sessions are immutable';
    end if;
    if old.status = 'final' and new.status <> 'archived' then
      raise exception 'Final result sessions are immutable except for archiving';
    end if;
    if old.status = 'draft' and coalesce(current_setting('app.results_rpc', true), '') <> '1' then
      raise exception 'Result session edits must use the results RPC';
    end if;
    if new.status not in ('draft', 'final', 'archived') then
      raise exception 'Invalid result session status';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_result_session_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from old.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  if old.status <> 'draft' or coalesce(current_setting('app.results_rpc', true), '') <> '1' then
    raise exception 'Only draft result sessions may be deleted through the results RPC';
  end if;
  return old;
end;
$$;

drop trigger if exists result_session_owner_guard on public.result_sessions;
create trigger result_session_owner_guard
before insert or update on public.result_sessions
for each row execute function public.guard_result_session_owner();
drop trigger if exists result_session_delete_guard on public.result_sessions;
create trigger result_session_delete_guard
before delete on public.result_sessions
for each row execute function public.guard_result_session_delete();

create or replace function public.guard_class_learner_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_owner uuid;
  assignment_sections text[];
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select ta.user_id, ta.section_names into assignment_owner, assignment_sections
  from public.teacher_assignments ta where ta.id = new.assignment_id;
  if assignment_owner is null or assignment_owner is distinct from new.user_id
     or not (new.section_name = any(assignment_sections)) then
    raise exception 'Learner assignment and section must belong to the learner owner';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.assignment_id is distinct from old.assignment_id
  ) then
    raise exception 'Learner identity and assignment are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists class_learner_owner_guard on public.class_learners;
create trigger class_learner_owner_guard
before insert or update on public.class_learners
for each row execute function public.guard_class_learner_owner();

create or replace function public.guard_result_participant_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.result_sessions%rowtype;
  learner_row public.class_learners%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select * into session_row from public.result_sessions where id = new.result_session_id;
  select * into learner_row from public.class_learners where id = new.learner_id;
  if session_row.id is null or learner_row.id is null
     or session_row.user_id is distinct from new.user_id
     or learner_row.user_id is distinct from new.user_id
     or learner_row.assignment_id is distinct from session_row.assignment_id
     or learner_row.section_name is distinct from session_row.section_name then
    raise exception 'Result participant must belong to the same teacher, assignment, and section';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.result_session_id is distinct from old.result_session_id
    or new.learner_id is distinct from old.learner_id
    or new.display_name_snapshot is distinct from old.display_name_snapshot
    or new.local_reference_snapshot is distinct from old.local_reference_snapshot
    or new.learner_was_active is distinct from old.learner_was_active
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Historical learner identity snapshots are immutable';
  end if;
  if session_row.status <> 'draft' or coalesce(current_setting('app.results_rpc', true), '') <> '1' then
    raise exception 'Result participants are writable only in a draft through the results RPC';
  end if;
  return new;
end;
$$;

drop trigger if exists result_participant_owner_guard on public.result_session_learners;
create trigger result_participant_owner_guard
before insert or update on public.result_session_learners
for each row execute function public.guard_result_participant_owner();

create or replace function public.guard_result_outcome_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.result_sessions%rowtype;
  participant_row public.result_session_learners%rowtype;
  item_value jsonb;
  expected_points numeric;
  question_type text;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select * into session_row from public.result_sessions where id = new.result_session_id;
  select * into participant_row from public.result_session_learners where id = new.participant_id;
  if session_row.id is null or participant_row.id is null
     or participant_row.result_session_id is distinct from new.result_session_id
     or participant_row.user_id is distinct from new.user_id
     or participant_row.learner_id is distinct from new.learner_id then
    raise exception 'Result outcome must belong to its participant and owner';
  end if;
  select value into item_value
  from jsonb_array_elements(session_row.assessment_snapshot -> 'items')
  where value ->> 'id' = new.item_id::text
    and (value ->> 'itemNumber')::integer = new.item_number;
  if item_value is null then raise exception 'Result outcome item is not in the immutable assessment snapshot'; end if;
  expected_points := (item_value ->> 'points')::numeric;
  question_type := item_value ->> 'questionType';
  if new.possible_points is distinct from expected_points or new.earned_points > new.possible_points then
    raise exception 'Result outcome points do not match the assessment snapshot';
  end if;
  if not public.result_answer_shape_valid(question_type, new.learner_answer) then
    raise exception 'Learner answer has an invalid minimized shape for this question type';
  end if;
  if question_type = 'multiple_choice' and new.learner_answer is not null
     and not exists (
       select 1 from jsonb_array_elements(item_value -> 'answer' -> 'choices') choice
       where choice ->> 'id' = new.learner_answer ->> 'choiceId'
     ) then
    raise exception 'Multiple-choice answer must reference an immutable assessment choice';
  end if;
  if question_type = 'constructed_response' then
    if new.scoring_source <> 'teacher' or new.is_correct is not null then
      raise exception 'Constructed responses are teacher-scored and have no deterministic correctness flag';
    end if;
  elsif new.learner_answer is null then
    if new.is_correct is not null or new.earned_points <> 0 then
      raise exception 'Omitted answers cannot receive deterministic points';
    end if;
  elsif question_type = 'short_answer' and new.scoring_source = 'teacher' then
    if new.is_correct is not null then
      raise exception 'Teacher-scored short answers have no deterministic correctness flag';
    end if;
  elsif new.scoring_source <> 'deterministic' and question_type <> 'short_answer' then
    raise exception 'Objective outcomes must use deterministic scoring';
  end if;
  if session_row.status <> 'draft' or coalesce(current_setting('app.results_rpc', true), '') <> '1' then
    raise exception 'Result outcomes are writable only in a draft through the results RPC';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.result_session_id is distinct from old.result_session_id
    or new.participant_id is distinct from old.participant_id
    or new.learner_id is distinct from old.learner_id
    or new.item_id is distinct from old.item_id
    or new.item_number is distinct from old.item_number
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Result outcome identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.guard_result_score_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.result_sessions%rowtype;
  participant_row public.result_session_learners%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;
  select * into session_row from public.result_sessions where id = new.result_session_id;
  select * into participant_row from public.result_session_learners where id = new.participant_id;
  if session_row.id is null or participant_row.id is null
     or participant_row.result_session_id is distinct from new.result_session_id
     or participant_row.user_id is distinct from new.user_id
     or participant_row.learner_id is distinct from new.learner_id then
    raise exception 'Score-only outcome must belong to its participant and owner';
  end if;
  if new.possible_points <> (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric
     or (new.raw_score is not null and (new.raw_score < 0 or new.raw_score > new.possible_points)) then
    raise exception 'Score-only outcome points do not match the assessment snapshot';
  end if;
  if session_row.entry_mode <> 'score_only' then raise exception 'Score-only outcomes require score-only entry mode'; end if;
  if session_row.status <> 'draft' or coalesce(current_setting('app.results_rpc', true), '') <> '1' then
    raise exception 'Score-only outcomes are writable only in a draft through the results RPC';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.result_session_id is distinct from old.result_session_id
    or new.participant_id is distinct from old.participant_id
    or new.learner_id is distinct from old.learner_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Score-only outcome identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists result_outcome_owner_guard on public.result_item_outcomes;
create trigger result_outcome_owner_guard
before insert or update on public.result_item_outcomes
for each row execute function public.guard_result_outcome_owner();
drop trigger if exists result_score_owner_guard on public.result_score_only_outcomes;
create trigger result_score_owner_guard
before insert or update on public.result_score_only_outcomes
for each row execute function public.guard_result_score_owner();

-- RPC-only writes.  Select remains available through strict owner RLS.
alter table public.class_learners enable row level security;
alter table public.result_sessions enable row level security;
alter table public.result_session_learners enable row level security;
alter table public.result_item_outcomes enable row level security;
alter table public.result_score_only_outcomes enable row level security;

drop policy if exists class_learners_select_own on public.class_learners;
create policy class_learners_select_own on public.class_learners
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists result_sessions_select_own on public.result_sessions;
create policy result_sessions_select_own on public.result_sessions
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists result_session_learners_select_own on public.result_session_learners;
create policy result_session_learners_select_own on public.result_session_learners
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists result_item_outcomes_select_own on public.result_item_outcomes;
create policy result_item_outcomes_select_own on public.result_item_outcomes
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists result_score_only_outcomes_select_own on public.result_score_only_outcomes;
create policy result_score_only_outcomes_select_own on public.result_score_only_outcomes
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.class_learners, public.result_sessions,
  public.result_session_learners, public.result_item_outcomes,
  public.result_score_only_outcomes from public;
grant select on public.class_learners, public.result_sessions,
  public.result_session_learners, public.result_item_outcomes,
  public.result_score_only_outcomes to authenticated;

-- Conservative short-answer comparison used only as a server-side validation
-- aid.  It does not strip punctuation or apply semantic similarity.
create or replace function public.result_normalize_short_answer(p_value text, p_case_sensitive boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_case_sensitive, false)
    then regexp_replace(btrim(normalize(coalesce(p_value, ''), NFKC)), '[[:space:]]+', ' ', 'g')
    else lower(regexp_replace(btrim(normalize(coalesce(p_value, ''), NFKC)), '[[:space:]]+', ' ', 'g')) end
$$;

create or replace function public.result_short_answer_mode(
  p_config jsonb,
  p_item_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_config -> 'itemModes' ->> (p_item_id::text) in ('manual', 'normalized_exact')
    then p_config -> 'itemModes' ->> (p_item_id::text)
    when p_config ->> 'defaultMode' in ('manual', 'normalized_exact')
    then p_config ->> 'defaultMode'
    else 'manual' end
$$;

create or replace function public.result_item_is_correct(
  p_item jsonb,
  p_answer jsonb,
  p_short_answer_config jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  question_type text := p_item ->> 'questionType';
  accepted jsonb;
  case_sensitive boolean;
  answer_text text;
  accepted_value text;
begin
  if p_answer is null then return null; end if;
  if question_type = 'multiple_choice' then
    return p_answer ->> 'type' = 'multiple_choice'
      and p_answer ->> 'choiceId' = p_item -> 'answer' ->> 'choiceId';
  elsif question_type = 'true_false' then
    return p_answer ->> 'type' = 'true_false'
      and (p_answer ->> 'value') is not null
      and (p_answer ->> 'value') = (p_item -> 'answer' ->> 'value');
  elsif question_type = 'short_answer'
    and public.result_short_answer_mode(p_short_answer_config, (p_item ->> 'id')::uuid) = 'normalized_exact' then
    answer_text := p_answer ->> 'text';
    case_sensitive := coalesce((p_item -> 'answer' ->> 'caseSensitive')::boolean, false);
    accepted := p_item -> 'answer' -> 'acceptedAnswers';
    for accepted_value in select value #>> '{}' from jsonb_array_elements(accepted) loop
      if public.result_normalize_short_answer(answer_text, case_sensitive)
        = public.result_normalize_short_answer(accepted_value, case_sensitive) then return true; end if;
    end loop;
    return false;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

-- Class roster CRUD.  The owner and assignment/section are always derived or
-- checked in the function; clients never supply a trusted user_id.
create or replace function public.save_class_learner(
  p_learner_id uuid,
  p_assignment_id uuid,
  p_section_name text,
  p_display_name text,
  p_local_reference text default null,
  p_status text default 'active'
)
returns public.class_learners
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved public.class_learners%rowtype;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('active', 'inactive') then raise exception 'Invalid learner status'; end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 200 then
    raise exception 'Learner display name is required';
  end if;
  if not exists (
    select 1 from public.teacher_assignments ta
    where ta.id = p_assignment_id and ta.user_id = owner_id
      and p_section_name = any(ta.section_names)
  ) then raise exception 'A teacher-owned assignment section is required'; end if;
  perform set_config('app.results_rpc', '1', true);
  if p_learner_id is null then
    insert into public.class_learners (user_id, assignment_id, section_name, display_name, local_reference, status)
    values (owner_id, p_assignment_id, btrim(p_section_name), btrim(p_display_name), nullif(btrim(p_local_reference), ''), p_status)
    returning * into saved;
  else
    select * into saved from public.class_learners
    where id = p_learner_id and user_id = owner_id for update;
    if saved.id is null then raise exception 'Learner not found'; end if;
    if saved.assignment_id is distinct from p_assignment_id or saved.section_name is distinct from p_section_name then
      raise exception 'Learner assignment and section are immutable';
    end if;
    update public.class_learners set
      display_name = btrim(p_display_name),
      local_reference = nullif(btrim(p_local_reference), ''),
      status = p_status
    where id = saved.id returning * into saved;
  end if;
  return saved;
end;
$$;

revoke all on function public.save_class_learner(uuid, uuid, text, text, text, text) from public;
grant execute on function public.save_class_learner(uuid, uuid, text, text, text, text) to authenticated;

-- Confirmed roster imports use one bounded request.  Each row is checked
-- against the same owner/assignment/section before any row is written; a
-- malformed row aborts the whole transaction rather than partially importing.
create or replace function public.save_class_learners_bulk(
  p_assignment_id uuid,
  p_section_name text,
  p_rows jsonb
)
returns setof public.class_learners
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  row_value jsonb;
  row_id uuid;
  saved public.class_learners%rowtype;
  row_count integer;
  display_name_value text;
  local_reference_value text;
  status_value text;
  id_text text;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.teacher_assignments ta
    where ta.id = p_assignment_id and ta.user_id = owner_id and p_section_name = any(ta.section_names)
  ) then raise exception 'A teacher-owned assignment section is required'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Roster rows must be an array'; end if;
  if octet_length(p_rows::text) > 2 * 1024 * 1024 then raise exception 'Roster import is too large'; end if;
  row_count := jsonb_array_length(p_rows);
  if row_count > 1000 then raise exception 'Roster imports support at most 1000 rows'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) value where jsonb_typeof(value) is distinct from 'object') then
    raise exception 'Every roster row must be an object';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) value
    where coalesce(btrim(value ->> 'displayName'), '') = ''
       or char_length(btrim(value ->> 'displayName')) > 200
       or char_length(coalesce(value ->> 'localReference', '')) > 120
       or coalesce(value ->> 'status', 'active') not in ('active', 'inactive')
  ) then raise exception 'Every roster row requires a bounded display name and valid status'; end if;
  if exists (
    select value ->> 'id' from jsonb_array_elements(p_rows) value
    where coalesce(value ->> 'id', '') <> ''
      and value ->> 'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then raise exception 'Roster learner IDs must be UUIDs'; end if;
  if exists (
    select value ->> 'id' from jsonb_array_elements(p_rows) value
    where coalesce(value ->> 'id', '') <> ''
    group by value ->> 'id' having count(*) > 1
  ) then raise exception 'Roster import contains duplicate learner IDs'; end if;
  perform set_config('app.results_rpc', '1', true);
  for row_value in select value from jsonb_array_elements(p_rows) loop
    id_text := nullif(btrim(row_value ->> 'id'), '');
    row_id := case when id_text is null then null else id_text::uuid end;
    display_name_value := btrim(row_value ->> 'displayName');
    local_reference_value := nullif(btrim(row_value ->> 'localReference'), '');
    status_value := coalesce(nullif(row_value ->> 'status', ''), 'active');
    if row_id is null then
      insert into public.class_learners (user_id, assignment_id, section_name, display_name, local_reference, status)
      values (owner_id, p_assignment_id, btrim(p_section_name), display_name_value, local_reference_value, status_value)
      returning * into saved;
    else
      select * into saved from public.class_learners
      where id = row_id and user_id = owner_id for update;
      if saved.id is null then raise exception 'Roster update learner was not found'; end if;
      if saved.assignment_id is distinct from p_assignment_id or saved.section_name is distinct from p_section_name then
        raise exception 'Roster update cannot cross assignment sections';
      end if;
      update public.class_learners set display_name = display_name_value,
        local_reference = local_reference_value, status = status_value
      where id = row_id and user_id = owner_id returning * into saved;
    end if;
    return next saved;
  end loop;
  return;
end;
$$;

revoke all on function public.save_class_learners_bulk(uuid, text, jsonb) from public;
grant execute on function public.save_class_learners_bulk(uuid, text, jsonb) to authenticated;

create or replace function public.delete_class_learner(p_learner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.class_learners where id = p_learner_id and user_id = owner_id) then
    raise exception 'Learner not found';
  end if;
  if exists (select 1 from public.result_session_learners where learner_id = p_learner_id) then
    raise exception 'Learner has historical results; deactivate instead of deleting';
  end if;
  perform set_config('app.results_rpc', '1', true);
  delete from public.class_learners where id = p_learner_id and user_id = owner_id;
end;
$$;

revoke all on function public.delete_class_learner(uuid) from public;
grant execute on function public.delete_class_learner(uuid) to authenticated;

-- Build a canonical immutable assessment snapshot from normalized assessment
-- rows, never from a client-supplied JSON payload.
create or replace function public.result_assessment_snapshot(
  p_assessment_document_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents%rowtype;
  ad public.assessment_documents%rowtype;
  item_rows jsonb;
  item_total numeric;
  version_number integer;
  source_content jsonb;
begin
  if p_owner_id is null or auth.uid() is distinct from p_owner_id then
    raise exception 'Authentication is required';
  end if;
  select * into d from public.documents where id = p_assessment_document_id
    and user_id = p_owner_id and document_type = 'assessment' and status = 'final' for share;
  if d.id is null then raise exception 'Finalized teacher-owned assessment not found'; end if;
  select * into ad from public.assessment_documents where document_id = d.id for share;
  if ad.document_id is null or ad.user_id is distinct from p_owner_id then raise exception 'Assessment metadata is missing'; end if;
  select coalesce(max(dv.version_number), 0) into version_number
  from public.document_versions dv where dv.document_id = d.id;
  if version_number <= 0 then raise exception 'Finalized assessment has no immutable version'; end if;
  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number), '[]'::jsonb),
         coalesce(sum(ai.points), 0)
    into item_rows, item_total
  from public.assessment_items ai where ai.assessment_document_id = d.id;
  if jsonb_array_length(item_rows) <> ad.total_items then raise exception 'Finalized assessment item projection is incomplete'; end if;
  source_content := coalesce(d.structured_content, ad.source_tos_content_snapshot);
  return jsonb_build_object(
    'assessmentId', d.id,
    'assessmentVersionNumber', version_number,
    'assessmentTitle', d.title,
    'assignmentId', ad.assignment_id,
    'gradeLevel', coalesce(source_content ->> 'gradeLevel', ''),
    'learningArea', coalesce(source_content ->> 'learningArea', ''),
    'schoolYear', coalesce(source_content ->> 'schoolYear', d.school_year),
    'gradingTermId', coalesce(source_content ->> 'gradingTermId', ''),
    'gradingTermLabel', coalesce(source_content ->> 'gradingTermLabel', d.academic_period_label, ''),
    'curriculumPeriodIds', coalesce(source_content -> 'curriculumPeriodIds', '[]'::jsonb),
    'curriculumPeriodLabels', coalesce(source_content -> 'curriculumPeriodLabels', '[]'::jsonb),
    'totalItems', ad.total_items,
    'totalPossiblePoints', item_total,
    'items', item_rows
  );
end;
$$;

revoke all on function public.result_assessment_snapshot(uuid, uuid) from public;

create or replace function public.create_result_session(
  p_assessment_document_id uuid,
  p_assignment_id uuid,
  p_section_name text,
  p_title text,
  p_administration_date date,
  p_entry_mode text,
  p_learner_ids uuid[] default '{}',
  p_short_answer_scoring jsonb default '{"defaultMode":"manual","itemModes":{}}'::jsonb
)
returns public.result_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  snapshot jsonb;
  saved public.result_sessions%rowtype;
  learner_id uuid;
  learner_row public.class_learners%rowtype;
  learner_ids uuid[] := coalesce(p_learner_ids, '{}');
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_entry_mode not in ('answer_sheet', 'item', 'score_only') then raise exception 'Invalid result entry mode'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 240 then raise exception 'Result title is required'; end if;
  if not exists (
    select 1 from public.teacher_assignments ta
    where ta.id = p_assignment_id and ta.user_id = owner_id and p_section_name = any(ta.section_names)
  ) then raise exception 'A teacher-owned assignment section is required'; end if;
  snapshot := public.result_assessment_snapshot(p_assessment_document_id, owner_id);
  if snapshot ->> 'assignmentId' is distinct from p_assignment_id::text then raise exception 'Assessment assignment does not match result assignment'; end if;
  if exists (select 1 from unnest(learner_ids) value group by value having count(*) > 1) then raise exception 'Duplicate learners are not allowed'; end if;
  if cardinality(learner_ids) < 1 then raise exception 'At least one active learner is required'; end if;
  if cardinality(learner_ids) > 1000 then raise exception 'Result sessions support at most 1000 learners'; end if;
  for learner_id in select unnest(learner_ids) loop
    select * into learner_row from public.class_learners cl
    where cl.id = learner_id and cl.user_id = owner_id for share;
    if learner_row.id is null or learner_row.assignment_id is distinct from p_assignment_id
       or learner_row.section_name is distinct from p_section_name or learner_row.status <> 'active' then
      raise exception 'Every result learner must be an active learner in the same assignment section';
    end if;
  end loop;
  perform set_config('app.results_rpc', '1', true);
  insert into public.result_sessions (
    user_id, assignment_id, section_name, assessment_document_id,
    assessment_version_number, administration_date, title, entry_mode,
    status, assessment_snapshot, short_answer_scoring
  ) values (
    owner_id, p_assignment_id, p_section_name, p_assessment_document_id,
    (snapshot ->> 'assessmentVersionNumber')::integer, coalesce(p_administration_date, current_date),
    btrim(p_title), p_entry_mode, 'draft', snapshot,
    case when jsonb_typeof(p_short_answer_scoring) = 'object' then p_short_answer_scoring
      else '{"defaultMode":"manual","itemModes":{}}'::jsonb end
  ) returning * into saved;
  insert into public.result_session_learners (
    user_id, result_session_id, learner_id, display_name_snapshot,
    local_reference_snapshot, learner_was_active, possible_points
  )
  select owner_id, saved.id, cl.id, cl.display_name, cl.local_reference,
    cl.status = 'active', (snapshot ->> 'totalPossiblePoints')::numeric
  from public.class_learners cl
  where cl.id = any(learner_ids) and cl.user_id = owner_id;
  return saved;
end;
$$;

revoke all on function public.create_result_session(uuid, uuid, text, text, date, text, uuid[], jsonb) from public;
grant execute on function public.create_result_session(uuid, uuid, text, text, date, text, uuid[], jsonb) to authenticated;

-- Parse and atomically replace a draft's normalized outcomes.  The request is
-- bounded and is one network call for a complete class batch.
create or replace function public.save_result_session(
  p_session_id uuid,
  p_title text,
  p_administration_date date,
  p_entry_mode text,
  p_short_answer_scoring jsonb,
  p_item_outcomes jsonb default '[]'::jsonb,
  p_score_only_outcomes jsonb default '[]'::jsonb,
  p_expected_version integer default null,
  p_status text default 'draft'
)
returns public.result_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  session_row public.result_sessions%rowtype;
  outcome_value jsonb;
  score_value jsonb;
  participant_row public.result_session_learners%rowtype;
  item_value jsonb;
  participant_id uuid;
  learner_id uuid;
  item_id uuid;
  item_number integer;
  possible_points numeric;
  earned_points numeric;
  raw_score numeric;
  answer jsonb;
  is_correct boolean;
  scoring_source text;
  question_type text;
  expected_version integer;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Result saves may be draft or final'; end if;
  if octet_length(coalesce(p_item_outcomes::text, '')) > 8 * 1024 * 1024
     or octet_length(coalesce(p_score_only_outcomes::text, '')) > 1024 * 1024 then
    raise exception 'Result batch payload is too large';
  end if;
  if p_short_answer_scoring is not null
     and octet_length(p_short_answer_scoring::text) > 8000 then
    raise exception 'Short-answer scoring configuration is too large';
  end if;
  if jsonb_typeof(coalesce(p_item_outcomes, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(p_score_only_outcomes, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Result outcomes must be arrays';
  end if;
  if jsonb_array_length(coalesce(p_item_outcomes, '[]'::jsonb)) > 10000
     or jsonb_array_length(coalesce(p_score_only_outcomes, '[]'::jsonb)) > 1000 then
    raise exception 'Result batch is too large';
  end if;
  select * into session_row from public.result_sessions
  where id = p_session_id and user_id = owner_id for update;
  if session_row.id is null then raise exception 'Result session not found'; end if;
  if session_row.status <> 'draft' then raise exception 'Only draft result sessions can be saved'; end if;
  if p_expected_version is not null and p_expected_version <> session_row.version_number then
    raise exception 'Result draft changed elsewhere; reload before saving';
  end if;
  if p_entry_mode not in ('answer_sheet', 'item', 'score_only') then raise exception 'Invalid result entry mode'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 240 then raise exception 'Result title is required'; end if;
  if p_entry_mode = 'score_only' and jsonb_array_length(coalesce(p_item_outcomes, '[]'::jsonb)) > 0 then
    raise exception 'Score-only sessions cannot contain item outcomes';
  end if;
  if p_entry_mode <> 'score_only' and jsonb_array_length(coalesce(p_score_only_outcomes, '[]'::jsonb)) > 0 then
    raise exception 'Item-entry sessions cannot contain score-only outcomes';
  end if;
  expected_version := session_row.version_number;
  perform set_config('app.results_rpc', '1', true);
  delete from public.result_item_outcomes where result_session_id = session_row.id;
  delete from public.result_score_only_outcomes where result_session_id = session_row.id;
  for outcome_value in select value from jsonb_array_elements(coalesce(p_item_outcomes, '[]'::jsonb)) loop
    participant_id := (outcome_value ->> 'participantId')::uuid;
    learner_id := (outcome_value ->> 'learnerId')::uuid;
    item_id := (outcome_value ->> 'itemId')::uuid;
    item_number := (outcome_value ->> 'itemNumber')::integer;
    answer := outcome_value -> 'answer';
    if jsonb_typeof(answer) = 'null' then answer := null; end if;
    possible_points := (outcome_value ->> 'possiblePoints')::numeric;
    earned_points := coalesce((outcome_value ->> 'earnedPoints')::numeric, 0);
    scoring_source := coalesce(outcome_value ->> 'scoringSource', 'deterministic');
    if participant_id is null or learner_id is null or item_id is null or item_number is null or possible_points is null then
      raise exception 'Result outcome identity and possible points are required';
    end if;
    if answer is not null and octet_length(answer::text) > 4000 then raise exception 'Learner answer is too long'; end if;
    if outcome_value ->> 'teacherFeedback' is not null
       and octet_length(outcome_value ->> 'teacherFeedback') > 2000 then
      raise exception 'Teacher feedback is too long';
    end if;
    select * into participant_row from public.result_session_learners p
    where p.id = participant_id and p.result_session_id = session_row.id and p.user_id = owner_id;
    if participant_row.id is null or participant_row.learner_id is distinct from learner_id then raise exception 'Result participant is invalid'; end if;
    select value into item_value from jsonb_array_elements(session_row.assessment_snapshot -> 'items')
    where value ->> 'id' = item_id::text and (value ->> 'itemNumber')::integer = item_number;
    if item_value is null then raise exception 'Result item is invalid'; end if;
    if possible_points <> (item_value ->> 'points')::numeric or earned_points < 0 or earned_points > possible_points then
      raise exception 'Result points do not match the immutable assessment snapshot';
    end if;
    question_type := item_value ->> 'questionType';
    if not public.result_answer_shape_valid(question_type, answer) then
      raise exception 'Learner answer has an invalid minimized shape for this question type';
    end if;
    if question_type = 'multiple_choice' and answer is not null and not exists (
      select 1 from jsonb_array_elements(item_value -> 'answer' -> 'choices') choice
      where choice ->> 'id' = answer ->> 'choiceId'
    ) then
      raise exception 'Multiple-choice answer must reference an immutable assessment choice';
    end if;
    is_correct := case when outcome_value ->> 'isCorrect' is null then null else (outcome_value ->> 'isCorrect')::boolean end;
    if answer is null then
      is_correct := null; earned_points := 0;
      scoring_source := case
        when question_type = 'constructed_response' then 'teacher'
        when question_type = 'short_answer'
          and public.result_short_answer_mode(coalesce(p_short_answer_scoring, '{}'), item_id) = 'manual' then 'teacher'
        else 'deterministic' end;
    elsif question_type = 'constructed_response' then
      if scoring_source <> 'teacher' or is_correct is not null then raise exception 'Constructed responses require teacher scoring'; end if;
    elsif scoring_source = 'deterministic' then
      if public.result_short_answer_mode(coalesce(p_short_answer_scoring, '{}'), item_id) = 'normalized_exact'
         and question_type = 'short_answer' then
        is_correct := public.result_item_is_correct(item_value, answer, coalesce(p_short_answer_scoring, '{}'));
      elsif question_type in ('multiple_choice', 'true_false') then
        is_correct := public.result_item_is_correct(item_value, answer, coalesce(p_short_answer_scoring, '{}'));
      else
        raise exception 'Short-answer responses require explicit normalized exact matching or teacher scoring';
      end if;
      if is_correct is null then raise exception 'Deterministic objective correctness is required'; end if;
      if earned_points <> case when is_correct then possible_points else 0 end then
        raise exception 'Deterministic points must be all-or-nothing';
      end if;
    elsif question_type = 'short_answer' and scoring_source = 'teacher' then
      if is_correct is not null then raise exception 'Teacher-scored short answers have no deterministic correctness flag'; end if;
    elsif scoring_source <> 'teacher' or question_type <> 'short_answer' then
      raise exception 'Only short answers may use teacher scoring in an item outcome';
    end if;
    insert into public.result_item_outcomes (
      user_id, result_session_id, participant_id, learner_id, item_id, item_number,
      learner_answer, is_correct, earned_points, possible_points, teacher_feedback, scoring_source
    ) values (
      owner_id, session_row.id, participant_id, learner_id, item_id, item_number,
      answer, is_correct, earned_points, possible_points,
      nullif(outcome_value ->> 'teacherFeedback', ''), scoring_source
    );
  end loop;
  for score_value in select value from jsonb_array_elements(coalesce(p_score_only_outcomes, '[]'::jsonb)) loop
    participant_id := (score_value ->> 'participantId')::uuid;
    learner_id := (score_value ->> 'learnerId')::uuid;
    if score_value ->> 'teacherFeedback' is not null
       and octet_length(score_value ->> 'teacherFeedback') > 2000 then
      raise exception 'Teacher feedback is too long';
    end if;
    raw_score := case when score_value ->> 'rawScore' is null then null else (score_value ->> 'rawScore')::numeric end;
    possible_points := (score_value ->> 'possiblePoints')::numeric;
    if participant_id is null or learner_id is null or possible_points is null then
      raise exception 'Score-only participant and possible points are required';
    end if;
    if possible_points is distinct from (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric
       or possible_points < 0
       or raw_score is not null and (raw_score < 0 or raw_score > possible_points) then
      raise exception 'Score-only points do not match the immutable assessment snapshot';
    end if;
    select * into participant_row from public.result_session_learners p
    where p.id = participant_id and p.result_session_id = session_row.id and p.user_id = owner_id;
    if participant_row.id is null or participant_row.learner_id is distinct from learner_id then raise exception 'Score participant is invalid'; end if;
    insert into public.result_score_only_outcomes (
      user_id, result_session_id, participant_id, learner_id, raw_score, possible_points, teacher_feedback
    ) values (
      owner_id, session_row.id, participant_id, learner_id, raw_score, possible_points,
      nullif(score_value ->> 'teacherFeedback', '')
    );
  end loop;
  update public.result_session_learners p set
    raw_score = case when p_entry_mode = 'score_only'
      then (select so.raw_score from public.result_score_only_outcomes so
            where so.result_session_id = session_row.id and so.participant_id = p.id)
      else coalesce((select sum(io.earned_points) from public.result_item_outcomes io
                     where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end,
    possible_points = (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric,
    percentage = case
      when (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric > 0
       and (case when p_entry_mode = 'score_only'
         then (select so.raw_score from public.result_score_only_outcomes so
               where so.result_session_id = session_row.id and so.participant_id = p.id)
         else coalesce((select sum(io.earned_points) from public.result_item_outcomes io
                        where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end) is not null
      then round(100 * (case when p_entry_mode = 'score_only'
        then (select so.raw_score from public.result_score_only_outcomes so
              where so.result_session_id = session_row.id and so.participant_id = p.id)
        else coalesce((select sum(io.earned_points) from public.result_item_outcomes io
                       where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end)
        / (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric, 4)
      else null end
  where p.result_session_id = session_row.id;
  update public.result_sessions set
    title = btrim(p_title), administration_date = coalesce(p_administration_date, administration_date),
    entry_mode = p_entry_mode, short_answer_scoring = case when jsonb_typeof(p_short_answer_scoring) = 'object'
      then p_short_answer_scoring else short_answer_scoring end,
    status = p_status, version_number = expected_version + 1
  where id = session_row.id returning * into session_row;
  return session_row;
end;
$$;

revoke all on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) from public;
grant execute on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) to authenticated;

create or replace function public.archive_result_session(p_session_id uuid)
returns public.result_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid(); saved public.result_sessions%rowtype;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into saved from public.result_sessions where id = p_session_id and user_id = owner_id for update;
  if saved.id is null then raise exception 'Result session not found'; end if;
  if saved.status = 'archived' then return saved; end if;
  if saved.status <> 'final' then raise exception 'Only final result sessions may be archived'; end if;
  perform set_config('app.results_rpc', '1', true);
  update public.result_sessions set status = 'archived' where id = saved.id returning * into saved;
  return saved;
end;
$$;

revoke all on function public.archive_result_session(uuid) from public;
grant execute on function public.archive_result_session(uuid) to authenticated;

create or replace function public.delete_draft_result_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare owner_id uuid := auth.uid(); session_status text;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select status into session_status from public.result_sessions where id = p_session_id and user_id = owner_id for update;
  if session_status is null then raise exception 'Result session not found'; end if;
  if session_status <> 'draft' then raise exception 'Only draft result sessions may be deleted'; end if;
  perform set_config('app.results_rpc', '1', true);
  delete from public.result_sessions where id = p_session_id and user_id = owner_id;
end;
$$;

revoke all on function public.delete_draft_result_session(uuid) from public;
grant execute on function public.delete_draft_result_session(uuid) to authenticated;

-- Result-list cards need progress without loading every participant/outcome
-- row. This single owner-scoped summary RPC avoids N+1 requests and returns
-- only aggregate counts; detailed rows remain available through the session
-- loader with deterministic pagination.
create or replace function public.list_result_session_summaries()
returns table (
  result_session_id uuid,
  learner_count bigint,
  encoded_learner_count bigint,
  response_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with participant_counts as (
    select result_session_id, count(*)::bigint as learner_count
    from public.result_session_learners
    where user_id = auth.uid()
    group by result_session_id
  ), item_counts as (
    select result_session_id,
      count(*) filter (where learner_answer is not null)::bigint as response_count,
      count(distinct participant_id) filter (where learner_answer is not null)::bigint as encoded_learner_count
    from public.result_item_outcomes
    where user_id = auth.uid()
    group by result_session_id
  ), score_counts as (
    select result_session_id,
      count(*) filter (where raw_score is not null)::bigint as response_count,
      count(distinct participant_id) filter (where raw_score is not null)::bigint as encoded_learner_count
    from public.result_score_only_outcomes
    where user_id = auth.uid()
    group by result_session_id
  )
  select rs.id,
    coalesce(pc.learner_count, 0)::bigint,
    case when rs.entry_mode = 'score_only'
      then coalesce(sc.encoded_learner_count, 0)
      else coalesce(ic.encoded_learner_count, 0) end::bigint,
    case when rs.entry_mode = 'score_only'
      then coalesce(sc.response_count, 0)
      else coalesce(ic.response_count, 0) end::bigint
  from public.result_sessions rs
  left join participant_counts pc on pc.result_session_id = rs.id
  left join item_counts ic on ic.result_session_id = rs.id
  left join score_counts sc on sc.result_session_id = rs.id
  where rs.user_id = auth.uid();
$$;

revoke all on function public.list_result_session_summaries() from public;
grant execute on function public.list_result_session_summaries() to authenticated;

comment on table public.class_learners is
'Minimal teacher-local roster identity for Phase 5: display name, optional teacher-local reference, assignment section, and active state only. No LRN or sensitive personal data.';
comment on table public.result_sessions is
'Teacher-owned assessment results. Finalized assessment and item/mapping data are server-snapshotted at creation; later assessment, TOS, or curriculum changes cannot mutate history.';
comment on table public.result_item_outcomes is
'Normalized teacher-owned item outcomes. Objective correctness is deterministic; constructed responses have teacher-entered points and nullable correctness.';
comment on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) is
'One bounded transactional draft/final batch save. It never writes one network request per answer and never accepts a client owner ID or assessment snapshot.';
