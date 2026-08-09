-- GuroDesk Phase 5.4 result compatibility and deterministic multi-point scoring.
--
-- This migration is intentionally additive/corrective.  It depends on the
-- Phase 4.4 enum/scoring migrations (202608090017 and 202608090018), which
-- must be applied before this file.  Phase 5.0/5.3 tables, RLS policies, and
-- historical rows are retained; legacy snapshots without pointsPossible use
-- their points mirror and finally a safe one-point default in the application.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assessment_question_type' and typnamespace = 'public'::regnamespace) then
    raise exception 'Phase 5.4 results compatibility requires Phase 4.1 assessment_question_type';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typnamespace = 'public'::regnamespace and t.typname = 'assessment_question_type' and e.enumlabel = 'essay') then
    raise exception 'Apply 202608090017_phase44_question_type_enum.sql before Phase 5.4 results compatibility';
  end if;
end;
$$;

-- Validate references against the immutable item answer payload.  Shape
-- validation alone cannot prevent a client from submitting a well-formed
-- answer that points at an option/blank/prompt which is not in the snapshot.
-- This function is immutable and has no grants; it is called by the guarded
-- result RPC/trigger only.
create or replace function public.result_learner_answer_references_valid(
  p_item jsonb,
  p_answer jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  question_type text := p_item ->> 'questionType';
  key text;
  value jsonb;
  reusable boolean;
begin
  if p_answer is null then return true; end if;
  if question_type = 'multiple_choice' then
    return exists (
      select 1
      from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'choices', '[]'::jsonb)) choice
      where choice ->> 'id' = p_answer ->> 'choiceId'
    );
  elsif question_type = 'fill_in_the_blank' then
    if jsonb_typeof(p_answer -> 'blanks') is distinct from 'object'
       or jsonb_typeof(p_item -> 'answer' -> 'blanks') is distinct from 'array' then
      return false;
    end if;
    for key in select object_key from jsonb_object_keys(p_answer -> 'blanks') as keys(object_key) loop
      if not exists (
        select 1
        from jsonb_array_elements(p_item -> 'answer' -> 'blanks') blank_value
        where blank_value ->> 'id' = key
      ) then
        return false;
      end if;
    end loop;
    return true;
  elsif question_type = 'matching' then
    if jsonb_typeof(p_answer -> 'matches') is distinct from 'object'
       or jsonb_typeof(p_item -> 'answer' -> 'prompts') is distinct from 'array'
       or jsonb_typeof(p_item -> 'answer' -> 'choices') is distinct from 'array' then
      return false;
    end if;
    reusable := coalesce((p_item -> 'answer' ->> 'reusableChoices')::boolean, false);
    for key, value in select match_key, match_value from jsonb_each(p_answer -> 'matches') as matches(match_key, match_value) loop
      if not exists (
        select 1 from jsonb_array_elements(p_item -> 'answer' -> 'prompts') prompt_value
        where prompt_value ->> 'id' = key
      ) or not exists (
        select 1 from jsonb_array_elements(p_item -> 'answer' -> 'choices') choice_value
        where choice_value ->> 'id' = value #>> '{}'
      ) then
        return false;
      end if;
      if not reusable and exists (
        select 1
        from jsonb_each(p_answer -> 'matches') as prior(prior_key, prior_value)
        where prior.prior_key <> key and prior.prior_value #>> '{}' = value #>> '{}'
      ) then
        return false;
      end if;
    end loop;
    return true;
  elsif question_type = 'multiple_select' then
    if jsonb_typeof(p_answer -> 'choiceIds') is distinct from 'array'
       or jsonb_typeof(p_item -> 'answer' -> 'choices') is distinct from 'array' then
      return false;
    end if;
    for value in select choice_value from jsonb_array_elements(p_answer -> 'choiceIds') as choices(choice_value) loop
      if not exists (
        select 1 from jsonb_array_elements(p_item -> 'answer' -> 'choices') choice_value
        where choice_value ->> 'id' = value #>> '{}'
      ) then
        return false;
      end if;
    end loop;
    return true;
  elsif question_type = 'problem_solving' then
    if p_answer ? 'subpartAnswers' then
      if jsonb_typeof(p_answer -> 'subpartAnswers') is distinct from 'object'
         or jsonb_typeof(p_item -> 'answer' -> 'subparts') is distinct from 'array' then
        return false;
      end if;
      for key, value in
        select part_key, part_value
        from jsonb_each(p_answer -> 'subpartAnswers') as parts(part_key, part_value)
      loop
        if jsonb_typeof(value) not in ('string', 'number')
           or not exists (
             select 1
             from jsonb_array_elements(p_item -> 'answer' -> 'subparts') part
             where part ->> 'id' = key
           ) then
          return false;
        end if;
      end loop;
    end if;
    return true;
  end if;
  return true;
exception when others then
  return false;
end;
$$;

-- The browser stores only a bounded, typed learner response.  No learner
-- identity, score, metadata, or arbitrary expression is accepted here.
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
  value jsonb;
begin
  if p_answer is null then return true; end if;
  if jsonb_typeof(p_answer) is distinct from 'object' then return false; end if;
  answer_type := p_answer ->> 'type';
  select count(*)::integer into key_count from jsonb_object_keys(p_answer);
  if p_question_type = 'multiple_choice' then
    return key_count = 2 and answer_type = 'multiple_choice'
      and jsonb_typeof(p_answer -> 'choiceId') = 'string'
      and char_length(btrim(p_answer ->> 'choiceId')) between 1 and 240;
  elsif p_question_type = 'true_false' then
    return key_count = 2 and answer_type = 'true_false' and jsonb_typeof(p_answer -> 'value') = 'boolean';
  elsif p_question_type in ('short_answer', 'identification') then
    return key_count = 2 and answer_type = p_question_type
      and jsonb_typeof(p_answer -> 'text') = 'string'
      and octet_length(p_answer ->> 'text') <= 3800;
  elsif p_question_type = 'fill_in_the_blank' then
    if key_count <> 2 or answer_type <> p_question_type or jsonb_typeof(p_answer -> 'blanks') is distinct from 'object' then return false; end if;
    for value in select blank_value from jsonb_each(p_answer -> 'blanks') as blanks(blank_key, blank_value) loop
      if jsonb_typeof(value) <> 'string' or octet_length(value #>> '{}') > 1200 then return false; end if;
    end loop;
    return true;
  elsif p_question_type = 'numerical_answer' then
    return key_count between 2 and 3 and answer_type = p_question_type
      and jsonb_typeof(p_answer -> 'value') = 'number'
      and (not (p_answer ? 'unit') or jsonb_typeof(p_answer -> 'unit') = 'string')
      and (not (p_answer ? 'unit') or octet_length(p_answer ->> 'unit') <= 240)
      and not exists (
        select 1 from jsonb_object_keys(p_answer) as keys(object_key)
        where object_key not in ('type', 'value', 'unit')
      );
  elsif p_question_type = 'problem_solving' then
    if key_count not between 1 and 4 or answer_type <> p_question_type
       or exists (
         select 1 from jsonb_object_keys(p_answer) as keys(object_key)
         where object_key not in ('type', 'finalAnswer', 'solution', 'subpartAnswers')
       )
       or (p_answer ? 'finalAnswer' and jsonb_typeof(p_answer -> 'finalAnswer') not in ('string', 'number'))
       or (p_answer ? 'finalAnswer' and jsonb_typeof(p_answer -> 'finalAnswer') = 'string' and octet_length(p_answer ->> 'finalAnswer') > 1200)
       or (p_answer ? 'solution' and jsonb_typeof(p_answer -> 'solution') <> 'string')
       or (p_answer ? 'solution' and octet_length(p_answer ->> 'solution') > 3800)
       or (p_answer ? 'subpartAnswers' and jsonb_typeof(p_answer -> 'subpartAnswers') <> 'object') then
      return false;
    end if;
    if p_answer ? 'subpartAnswers' and exists (
      select 1 from jsonb_each(p_answer -> 'subpartAnswers') part
      where jsonb_typeof(part.value) not in ('string', 'number')
         or (jsonb_typeof(part.value) = 'string' and octet_length(part.value #>> '{}') > 1200)
    ) then return false; end if;
    return true;
  elsif p_question_type = 'matching' then
    if key_count <> 2 or answer_type <> p_question_type or jsonb_typeof(p_answer -> 'matches') is distinct from 'object' then return false; end if;
    for value in select match_value from jsonb_each(p_answer -> 'matches') as matches(match_key, match_value) loop
      if jsonb_typeof(value) <> 'string' or char_length(btrim(value #>> '{}')) < 1 then return false; end if;
    end loop;
    return true;
  elsif p_question_type = 'multiple_select' then
    if key_count <> 2 or answer_type <> p_question_type or jsonb_typeof(p_answer -> 'choiceIds') is distinct from 'array' or jsonb_array_length(p_answer -> 'choiceIds') < 1 then return false; end if;
    for value in select choice_value from jsonb_array_elements(p_answer -> 'choiceIds') as choices(choice_value) loop
      if jsonb_typeof(value) <> 'string' or char_length(btrim(value #>> '{}')) < 1 then return false; end if;
    end loop;
    return (select count(*) from jsonb_array_elements_text(p_answer -> 'choiceIds')) = (select count(distinct value) from jsonb_array_elements_text(p_answer -> 'choiceIds'));
  elsif p_question_type = 'constructed_response' then
    return answer_type = p_question_type and key_count between 1 and 2
      and not exists (
        select 1 from jsonb_object_keys(p_answer) as keys(object_key)
        where object_key not in ('type', 'text')
      )
      and (not (p_answer ? 'text') or jsonb_typeof(p_answer -> 'text') = 'string')
      and (not (p_answer ? 'text') or octet_length(p_answer ->> 'text') <= 3800);
  elsif p_question_type = 'essay' then
    return answer_type = p_question_type and key_count between 1 and 2
      and not exists (
        select 1 from jsonb_object_keys(p_answer) as keys(object_key)
        where object_key not in ('type', 'text')
      )
      and (not (p_answer ? 'text') or jsonb_typeof(p_answer -> 'text') = 'string')
      and (not (p_answer ? 'text') or octet_length(p_answer ->> 'text') <= 3800);
  end if;
  return false;
end;
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
  expected_number numeric;
  learner_number numeric;
  tolerance numeric;
  expected_unit text;
  learner_unit text;
  expected_ids jsonb;
  learner_ids jsonb;
  mapping_value jsonb;
  blank_value jsonb;
  learner_value text;
  expected_choice text;
begin
  if p_answer is null then return null; end if;
  if question_type = 'multiple_choice' then
    return p_answer ->> 'type' = question_type and p_answer ->> 'choiceId' = p_item -> 'answer' ->> 'choiceId';
  elsif question_type = 'true_false' then
    return p_answer ->> 'type' = question_type and p_answer ->> 'value' = p_item -> 'answer' ->> 'value';
  elsif question_type in ('short_answer', 'identification') then
    if question_type = 'short_answer' and public.result_short_answer_mode(coalesce(p_short_answer_config, '{}'::jsonb), nullif(p_item ->> 'id', '')::uuid) <> 'normalized_exact' then return null; end if;
    answer_text := p_answer ->> 'text';
    case_sensitive := coalesce((p_item -> 'answer' ->> 'caseSensitive')::boolean, false);
    accepted := p_item -> 'answer' -> 'acceptedAnswers';
    for accepted_value in select value #>> '{}' from jsonb_array_elements(coalesce(accepted, '[]'::jsonb)) loop
      if public.result_normalize_short_answer(answer_text, case_sensitive) = public.result_normalize_short_answer(accepted_value, case_sensitive) then return true; end if;
    end loop;
    return false;
  elsif question_type = 'numerical_answer' then
    expected_number := (p_item -> 'answer' ->> 'value')::numeric;
    learner_number := (p_answer ->> 'value')::numeric;
    tolerance := greatest(0, coalesce((p_item -> 'answer' ->> 'tolerance')::numeric, 0));
    expected_unit := lower(regexp_replace(btrim(coalesce(p_item -> 'answer' ->> 'unit', '')), '[[:space:]]+', ' ', 'g'));
    learner_unit := lower(regexp_replace(btrim(coalesce(p_answer ->> 'unit', '')), '[[:space:]]+', ' ', 'g'));
    if coalesce((p_item -> 'answer' ->> 'requireUnit')::boolean, false) and (expected_unit = '' or learner_unit <> expected_unit) then return false; end if;
    if not coalesce((p_item -> 'answer' ->> 'requireUnit')::boolean, false) and expected_unit <> '' and learner_unit <> '' and learner_unit <> expected_unit then return false; end if;
    return abs(learner_number - expected_number) <= tolerance;
  elsif question_type = 'multiple_select' then
    expected_ids := p_item -> 'answer' -> 'choiceIds'; learner_ids := p_answer -> 'choiceIds';
    return jsonb_array_length(coalesce(expected_ids, '[]'::jsonb)) > 0
      and jsonb_array_length(coalesce(expected_ids, '[]'::jsonb)) = jsonb_array_length(coalesce(learner_ids, '[]'::jsonb))
      and not exists (select 1 from jsonb_array_elements_text(coalesce(expected_ids, '[]'::jsonb)) value where not exists (select 1 from jsonb_array_elements_text(coalesce(learner_ids, '[]'::jsonb)) selected where selected = value));
  elsif question_type = 'fill_in_the_blank' then
    for blank_value in select value from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'blanks', '[]'::jsonb)) loop
      learner_value := p_answer -> 'blanks' ->> (blank_value ->> 'id');
      case_sensitive := coalesce((blank_value ->> 'caseSensitive')::boolean, false);
      if learner_value is null or not exists (select 1 from jsonb_array_elements_text(coalesce(blank_value -> 'acceptedAnswers', '[]'::jsonb)) accepted_value where public.result_normalize_short_answer(learner_value, case_sensitive) = public.result_normalize_short_answer(accepted_value, case_sensitive)) then return false; end if;
    end loop;
    return jsonb_array_length(coalesce(p_item -> 'answer' -> 'blanks', '[]'::jsonb)) > 0;
  elsif question_type = 'matching' then
    for mapping_value in select value from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'mappings', '[]'::jsonb)) loop
      expected_choice := mapping_value ->> 'choiceId';
      if p_answer -> 'matches' ->> (mapping_value ->> 'promptId') is distinct from expected_choice then return false; end if;
    end loop;
    return jsonb_array_length(coalesce(p_item -> 'answer' -> 'mappings', '[]'::jsonb)) > 0;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

-- Compute objective earned points without evaluating generated code.  Fill and
-- matching award only their independently correct parts; all other objective
-- types use simple all-or-nothing scoring.
create or replace function public.result_item_earned_points(
  p_item jsonb,
  p_answer jsonb,
  p_short_answer_config jsonb
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  question_type text := p_item ->> 'questionType';
  item_points numeric := coalesce(nullif(p_item ->> 'pointsPossible', '')::numeric, nullif(p_item ->> 'points', '')::numeric, 1);
  result numeric := 0;
  blank_value jsonb;
  mapping_value jsonb;
  explicit_total numeric := 0;
  explicit_count integer := 0;
  blank_points numeric;
  mapping_points numeric;
  learner_value text;
  case_sensitive boolean;
  correct boolean;
begin
  if p_answer is null then return 0; end if;
  if question_type = 'fill_in_the_blank' then
    select count(*) filter (where value ? 'pointsPossible'), coalesce(sum(coalesce((value ->> 'pointsPossible')::numeric, 0)), 0)
      into explicit_count, explicit_total from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'blanks', '[]'::jsonb));
    for blank_value in select value from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'blanks', '[]'::jsonb)) loop
      case_sensitive := coalesce((blank_value ->> 'caseSensitive')::boolean, false);
      learner_value := p_answer -> 'blanks' ->> (blank_value ->> 'id');
      correct := learner_value is not null and exists (select 1 from jsonb_array_elements_text(coalesce(blank_value -> 'acceptedAnswers', '[]'::jsonb)) accepted_value where public.result_normalize_short_answer(learner_value, case_sensitive) = public.result_normalize_short_answer(accepted_value, case_sensitive));
      blank_points := case when explicit_count > 0 then coalesce((blank_value ->> 'pointsPossible')::numeric, 0) else item_points / greatest(1, jsonb_array_length(coalesce(p_item -> 'answer' -> 'blanks', '[]'::jsonb))) end;
      if correct then result := result + blank_points; end if;
    end loop;
    return least(item_points, greatest(0, result));
  elsif question_type = 'matching' then
    select count(*) filter (where value ? 'pointsPossible'), coalesce(sum(coalesce((value ->> 'pointsPossible')::numeric, 0)), 0)
      into explicit_count, explicit_total from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'mappings', '[]'::jsonb));
    for mapping_value in select value from jsonb_array_elements(coalesce(p_item -> 'answer' -> 'mappings', '[]'::jsonb)) loop
      mapping_points := case when explicit_count > 0 then coalesce((mapping_value ->> 'pointsPossible')::numeric, 0)
        else coalesce(nullif(p_item -> 'answer' ->> 'pointsPerMatch', '')::numeric, nullif(p_item -> 'answer' ->> 'groupPointsPossible', '')::numeric / greatest(1, jsonb_array_length(coalesce(p_item -> 'answer' -> 'mappings', '[]'::jsonb))), item_points / greatest(1, jsonb_array_length(coalesce(p_item -> 'answer' -> 'mappings', '[]'::jsonb)))) end;
      if p_answer -> 'matches' ->> (mapping_value ->> 'promptId') = mapping_value ->> 'choiceId' then result := result + mapping_points; end if;
    end loop;
    return least(item_points, greatest(0, result));
  elsif question_type in ('multiple_choice', 'true_false', 'short_answer', 'identification', 'numerical_answer', 'multiple_select') then
    correct := public.result_item_is_correct(p_item, p_answer, coalesce(p_short_answer_config, '{}'::jsonb));
    return case when correct then item_points else 0 end;
  end if;
  return 0;
exception when others then
  return 0;
end;
$$;

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
  short_answer_mode text;
  calculated_correct boolean;
  calculated_points numeric;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then raise exception 'Authenticated owner is required'; end if;
  select * into session_row from public.result_sessions where id = new.result_session_id;
  select * into participant_row from public.result_session_learners where id = new.participant_id;
  if session_row.id is null
     or session_row.user_id is distinct from new.user_id
     or participant_row.id is null
     or participant_row.result_session_id is distinct from new.result_session_id
     or participant_row.user_id is distinct from new.user_id
     or participant_row.learner_id is distinct from new.learner_id then
    raise exception 'Result outcome must belong to its session, participant, and owner';
  end if;
  select value into item_value from jsonb_array_elements(session_row.assessment_snapshot -> 'items') where value ->> 'id' = new.item_id::text and (value ->> 'itemNumber')::integer = new.item_number;
  if item_value is null then raise exception 'Result outcome item is not in the immutable assessment snapshot'; end if;
  expected_points := coalesce(nullif(item_value ->> 'pointsPossible', '')::numeric, nullif(item_value ->> 'points', '')::numeric, 1);
  question_type := item_value ->> 'questionType';
  short_answer_mode := case when question_type = 'short_answer'
    then public.result_short_answer_mode(coalesce(session_row.short_answer_scoring, '{}'::jsonb), nullif(item_value ->> 'id', '')::uuid)
    else null end;
  if new.possible_points is distinct from expected_points or new.earned_points < 0 or new.earned_points > new.possible_points then raise exception 'Result outcome points do not match the assessment snapshot'; end if;
  if public.result_answer_shape_valid(question_type, new.learner_answer) is not true then raise exception 'Learner answer has an invalid minimized shape for this question type'; end if;
  if public.result_learner_answer_references_valid(item_value, new.learner_answer) is not true then raise exception 'Learner answer references a value outside the immutable assessment item'; end if;
  if new.learner_answer is null then
    if new.is_correct is not null or new.earned_points <> 0 then raise exception 'Omitted answers cannot receive deterministic points'; end if;
    if question_type in ('constructed_response', 'problem_solving', 'essay')
       or (question_type = 'short_answer' and short_answer_mode = 'manual') then
      if new.scoring_source <> 'teacher' then raise exception 'Subjective omissions require teacher scoring'; end if;
    elsif new.scoring_source <> 'deterministic' then
      raise exception 'Objective omissions require deterministic scoring';
    end if;
  elsif question_type in ('constructed_response', 'problem_solving', 'essay')
     or (question_type = 'short_answer' and short_answer_mode = 'manual') then
    if new.scoring_source <> 'teacher' or new.is_correct is not null then raise exception 'Subjective responses require teacher scoring and no correctness flag'; end if;
  elsif new.scoring_source <> 'deterministic' then
    raise exception 'Objective outcomes must use deterministic scoring';
  else
    calculated_correct := public.result_item_is_correct(item_value, new.learner_answer, coalesce(session_row.short_answer_scoring, '{}'::jsonb));
    calculated_points := public.result_item_earned_points(item_value, new.learner_answer, coalesce(session_row.short_answer_scoring, '{}'::jsonb));
    if calculated_correct is null or new.is_correct is distinct from calculated_correct
       or new.earned_points is distinct from calculated_points then
      raise exception 'Deterministic outcome does not match the immutable structured answer';
    end if;
  end if;
  if session_row.status <> 'draft' or coalesce(current_setting('app.results_rpc', true), '') <> '1' then raise exception 'Result outcomes are writable only in a draft through the results RPC'; end if;
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.result_session_id is distinct from old.result_session_id or new.participant_id is distinct from old.participant_id or new.learner_id is distinct from old.learner_id or new.item_id is distinct from old.item_id or new.item_number is distinct from old.item_number or new.created_at is distinct from old.created_at) then raise exception 'Result outcome identity is immutable'; end if;
  return new;
end;
$$;

drop trigger if exists result_outcome_owner_guard on public.result_item_outcomes;
create trigger result_outcome_owner_guard before insert or update on public.result_item_outcomes for each row execute function public.guard_result_outcome_owner();

-- Replace only the result RPC.  It keeps the original owner/assignment/session
-- checks and complete-batch replacement semantics, while adding the new typed
-- learner answers and partial objective scoring.
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
  calculated_points numeric;
  short_answer_config jsonb;
  short_answer_mode text;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Result saves may be draft or final'; end if;
  if octet_length(coalesce(p_item_outcomes::text, '')) > 8 * 1024 * 1024 or octet_length(coalesce(p_score_only_outcomes::text, '')) > 1024 * 1024 then raise exception 'Result batch payload is too large'; end if;
  if p_short_answer_scoring is not null and octet_length(p_short_answer_scoring::text) > 8000 then raise exception 'Short-answer scoring configuration is too large'; end if;
  if jsonb_typeof(coalesce(p_item_outcomes, '[]'::jsonb)) is distinct from 'array' or jsonb_typeof(coalesce(p_score_only_outcomes, '[]'::jsonb)) is distinct from 'array' then raise exception 'Result outcomes must be arrays'; end if;
  if jsonb_array_length(coalesce(p_item_outcomes, '[]'::jsonb)) > 10000 or jsonb_array_length(coalesce(p_score_only_outcomes, '[]'::jsonb)) > 1000 then raise exception 'Result batch is too large'; end if;
  select * into session_row from public.result_sessions where id = p_session_id and user_id = owner_id for update;
  if session_row.id is null then raise exception 'Result session not found'; end if;
  if session_row.status <> 'draft' then raise exception 'Only draft result sessions can be saved'; end if;
  if p_expected_version is not null and p_expected_version <> session_row.version_number then raise exception 'Result draft changed elsewhere; reload before saving'; end if;
  short_answer_config := case when jsonb_typeof(p_short_answer_scoring) = 'object'
    then p_short_answer_scoring else coalesce(session_row.short_answer_scoring, '{}'::jsonb) end;
  if p_entry_mode not in ('answer_sheet', 'item', 'score_only') then raise exception 'Invalid result entry mode'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 240 then raise exception 'Result title is required'; end if;
  if p_entry_mode = 'score_only' and jsonb_array_length(coalesce(p_item_outcomes, '[]'::jsonb)) > 0 then raise exception 'Score-only sessions cannot contain item outcomes'; end if;
  if p_entry_mode <> 'score_only' and jsonb_array_length(coalesce(p_score_only_outcomes, '[]'::jsonb)) > 0 then raise exception 'Item-entry sessions cannot contain score-only outcomes'; end if;
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
    if participant_id is null or learner_id is null or item_id is null or item_number is null or possible_points is null then raise exception 'Result outcome identity and possible points are required'; end if;
    if answer is not null and octet_length(answer::text) > 4000 then raise exception 'Learner answer is too long'; end if;
    if outcome_value ->> 'teacherFeedback' is not null and octet_length(outcome_value ->> 'teacherFeedback') > 2000 then raise exception 'Teacher feedback is too long'; end if;
    select * into participant_row from public.result_session_learners p where p.id = participant_id and p.result_session_id = session_row.id and p.user_id = owner_id;
    if participant_row.id is null or participant_row.learner_id is distinct from learner_id then raise exception 'Result participant is invalid'; end if;
    select value into item_value from jsonb_array_elements(session_row.assessment_snapshot -> 'items') where value ->> 'id' = item_id::text and (value ->> 'itemNumber')::integer = item_number;
    if item_value is null then raise exception 'Result item is invalid'; end if;
    if possible_points <> coalesce(nullif(item_value ->> 'pointsPossible', '')::numeric, nullif(item_value ->> 'points', '')::numeric, 1) or earned_points < 0 or earned_points > possible_points then raise exception 'Result points do not match the immutable assessment snapshot'; end if;
    question_type := item_value ->> 'questionType';
    short_answer_mode := case when question_type = 'short_answer'
      then public.result_short_answer_mode(short_answer_config, item_id) else null end;
    if public.result_answer_shape_valid(question_type, answer) is not true then raise exception 'Learner answer has an invalid minimized shape for this question type'; end if;
    if public.result_learner_answer_references_valid(item_value, answer) is not true then raise exception 'Learner answer references a value outside the immutable assessment item'; end if;
    is_correct := case when outcome_value ->> 'isCorrect' is null then null else (outcome_value ->> 'isCorrect')::boolean end;
    if answer is null then
      is_correct := null; earned_points := 0; scoring_source := case when question_type in ('constructed_response', 'problem_solving', 'essay') or (question_type = 'short_answer' and short_answer_mode = 'manual') then 'teacher' else 'deterministic' end;
    elsif question_type in ('constructed_response', 'problem_solving', 'essay') or (question_type = 'short_answer' and short_answer_mode = 'manual') then
      if scoring_source <> 'teacher' or is_correct is not null then raise exception 'Subjective responses require teacher scoring'; end if;
    elsif scoring_source = 'deterministic' then
      is_correct := public.result_item_is_correct(item_value, answer, short_answer_config);
      if is_correct is null then raise exception 'Deterministic objective correctness is required'; end if;
      calculated_points := public.result_item_earned_points(item_value, answer, short_answer_config);
      if abs(earned_points - calculated_points) > 0.000001 then raise exception 'Deterministic points do not match the structured answer'; end if;
    else
      raise exception 'Only teacher scoring may override a subjective response';
    end if;
    insert into public.result_item_outcomes (user_id, result_session_id, participant_id, learner_id, item_id, item_number, learner_answer, is_correct, earned_points, possible_points, teacher_feedback, scoring_source)
    values (owner_id, session_row.id, participant_id, learner_id, item_id, item_number, answer, is_correct, earned_points, possible_points, nullif(outcome_value ->> 'teacherFeedback', ''), scoring_source);
  end loop;
  for score_value in select value from jsonb_array_elements(coalesce(p_score_only_outcomes, '[]'::jsonb)) loop
    participant_id := (score_value ->> 'participantId')::uuid; learner_id := (score_value ->> 'learnerId')::uuid;
    if score_value ->> 'teacherFeedback' is not null and octet_length(score_value ->> 'teacherFeedback') > 2000 then raise exception 'Teacher feedback is too long'; end if;
    raw_score := case when score_value ->> 'rawScore' is null then null else (score_value ->> 'rawScore')::numeric end;
    possible_points := (score_value ->> 'possiblePoints')::numeric;
    if participant_id is null or learner_id is null or possible_points is null then raise exception 'Score-only participant and possible points are required'; end if;
    if possible_points is distinct from (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric or possible_points < 0 or raw_score is not null and (raw_score < 0 or raw_score > possible_points) then raise exception 'Score-only points do not match the immutable assessment snapshot'; end if;
    select * into participant_row from public.result_session_learners p where p.id = participant_id and p.result_session_id = session_row.id and p.user_id = owner_id;
    if participant_row.id is null or participant_row.learner_id is distinct from learner_id then raise exception 'Score participant is invalid'; end if;
    insert into public.result_score_only_outcomes (user_id, result_session_id, participant_id, learner_id, raw_score, possible_points, teacher_feedback) values (owner_id, session_row.id, participant_id, learner_id, raw_score, possible_points, nullif(score_value ->> 'teacherFeedback', ''));
  end loop;
  update public.result_session_learners p set raw_score = case when p_entry_mode = 'score_only' then (select so.raw_score from public.result_score_only_outcomes so where so.result_session_id = session_row.id and so.participant_id = p.id) else coalesce((select sum(io.earned_points) from public.result_item_outcomes io where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end, possible_points = (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric, percentage = case when (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric > 0 and (case when p_entry_mode = 'score_only' then (select so.raw_score from public.result_score_only_outcomes so where so.result_session_id = session_row.id and so.participant_id = p.id) else coalesce((select sum(io.earned_points) from public.result_item_outcomes io where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end) is not null then round(100 * (case when p_entry_mode = 'score_only' then (select so.raw_score from public.result_score_only_outcomes so where so.result_session_id = session_row.id and so.participant_id = p.id) else coalesce((select sum(io.earned_points) from public.result_item_outcomes io where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end) / (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric, 4) else null end where p.result_session_id = session_row.id;
  update public.result_sessions set title = btrim(p_title), administration_date = coalesce(p_administration_date, administration_date), entry_mode = p_entry_mode, short_answer_scoring = case when jsonb_typeof(p_short_answer_scoring) = 'object' then p_short_answer_scoring else short_answer_scoring end, status = p_status, version_number = expected_version + 1 where id = session_row.id returning * into session_row;
  return session_row;
end;
$$;

revoke all on function public.result_learner_answer_references_valid(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.result_answer_shape_valid(text, jsonb) from public, anon, authenticated;
revoke all on function public.result_item_is_correct(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.result_item_earned_points(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) from public;
grant execute on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) to authenticated;

comment on function public.result_item_earned_points(jsonb, jsonb, jsonb) is
'Deterministic objective scoring for Phase 5.4: point-bounded fill/matching partial credit, numeric tolerance/unit checks, and all-or-nothing multi-select. Subjective responses remain teacher-scored.';
