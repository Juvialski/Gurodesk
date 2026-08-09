-- Corrective migration 022: Explicit mapping verification and ordered result score bounds checking.

create or replace function public.save_assessment_document(
  p_document_id uuid,
  p_assignment_id uuid,
  p_source_tos_document_id uuid,
  p_title text,
  p_school_year text,
  p_academic_period_label text default null,
  p_instructions text default '',
  p_status text default 'draft',
  p_structured_content jsonb default '{}'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_change_note text default 'Teacher saved assessment draft'
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  tos_row public.documents%rowtype;
  assessment_row public.assessment_documents%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  saved public.documents%rowtype;
  next_version integer := 1;
  item_value jsonb;
  item_number integer;
  item_prompt text;
  item_question_type text;
  item_answer jsonb;
  item_points_possible numeric;
  item_points numeric;
  item_authorship_state text;
  item_qa_state text;
  item_locked boolean;
  item_history jsonb;
  item_competency_id uuid;
  item_cognitive_category_id text;
  item_tos_row_id uuid;
  item_allocation_item_start integer;
  item_allocation_item_end integer;
  item_allocation_index integer;
  item_rationale text;
  item_teacher_notes text;
  seen_items integer[] := array[]::integer[];
  existing_locked boolean;
  existing_prompt text;
  existing_answer jsonb;
  existing_question_type text;
  existing_points numeric;
  bad boolean;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Assessment status must be draft or final'; end if;
  if octet_length(coalesce(p_structured_content::text, '')) > 2 * 1024 * 1024 or octet_length(coalesce(p_items::text, '')) > 4 * 1024 * 1024 then raise exception 'Assessment payload is too large'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) is distinct from 'array' then raise exception 'Assessment items must be an array'; end if;

  select * into assignment_row from public.teacher_assignments where id = p_assignment_id and user_id = owner_id;
  if assignment_row.id is null then raise exception 'A teacher-owned assignment is required'; end if;

  select * into tos_row from public.documents where id = p_source_tos_document_id and user_id = owner_id and document_type = 'tos' and status = 'final';
  if tos_row.id is null then raise exception 'A finalized teacher-owned TOS document is required'; end if;

  if p_document_id is not null then
    select * into saved from public.documents d where d.id = p_document_id and d.user_id = owner_id and d.document_type = 'assessment' for update;
    if saved.id is null then raise exception 'Assessment document not found'; end if;
    if saved.status <> 'draft' then raise exception 'Only draft assessment documents can be edited'; end if;
    select * into assessment_row from public.assessment_documents ad where ad.document_id = saved.id for update;
    if assessment_row.assignment_id <> p_assignment_id or assessment_row.source_tos_document_id <> p_source_tos_document_id then raise exception 'Assessment assignment and source TOS cannot change'; end if;
    select coalesce(max(version_number), 0) + 1 into next_version from public.document_versions where document_id = saved.id;
  else
    insert into public.documents (user_id, assignment_id, document_type, title, school_year, academic_period_label, status, structured_content)
    values (owner_id, p_assignment_id, 'assessment', btrim(p_title), btrim(p_school_year), nullif(btrim(coalesce(p_academic_period_label, '')), ''), p_status, p_structured_content)
    returning * into saved;

    insert into public.assessment_documents (document_id, assignment_id, source_tos_document_id, instructions, metadata)
    values (saved.id, p_assignment_id, p_source_tos_document_id, coalesce(p_instructions, ''), jsonb_build_object('gradingTermId', saved.academic_period_label))
    returning * into assessment_row;
  end if;

  if jsonb_array_length(p_items) <> (tos_row.structured_content ->> 'totalItems')::integer then raise exception 'Assessment item count must equal the finalized TOS total'; end if;

  for item_value in select value from jsonb_array_elements(p_items) loop
    item_number := (item_value ->> 'itemNumber')::integer;
    item_prompt := coalesce(item_value ->> 'prompt', '');
    item_question_type := item_value ->> 'questionType';
    item_answer := item_value -> 'answer';
    item_points_possible := coalesce(nullif(item_value ->> 'pointsPossible', '')::numeric, nullif(item_value ->> 'points', '')::numeric, 1);
    item_points := item_points_possible;
    item_authorship_state := coalesce(item_value ->> 'authorshipState', 'manual');
    item_qa_state := coalesce(item_value ->> 'qaState', 'empty');
    item_locked := coalesce((item_value ->> 'locked')::boolean, false);
    item_history := coalesce(item_value -> 'history', '[]'::jsonb);
    item_competency_id := (item_value -> 'competencySnapshot' ->> 'id')::uuid;
    item_cognitive_category_id := item_value -> 'cognitiveCategorySnapshot' ->> 'id';
    item_tos_row_id := (item_value -> 'mapping' ->> 'rowId')::uuid;
    item_allocation_item_start := (item_value -> 'mapping' ->> 'allocationItemStart')::integer;
    item_allocation_item_end := (item_value -> 'mapping' ->> 'allocationItemEnd')::integer;
    item_allocation_index := (item_value -> 'mapping' ->> 'allocationIndex')::integer;
    item_rationale := coalesce(item_value ->> 'rationale', '');
    item_teacher_notes := coalesce(item_value ->> 'teacherNotes', '');

    if item_number is null or item_number < 1 or item_number > (tos_row.structured_content ->> 'totalItems')::integer then raise exception 'Assessment item numbers must be contiguous integers starting at 1'; end if;
    if item_number = any(seen_items) then raise exception 'Assessment item numbers must be unique'; end if;
    seen_items := array_append(seen_items, item_number);

    if (item_value -> 'mapping' ->> 'competencyId')::uuid is distinct from item_competency_id
       or (item_value -> 'mapping' ->> 'cognitiveCategoryId') is distinct from item_cognitive_category_id
       or (item_value -> 'mapping' ->> 'rowId')::uuid is distinct from item_tos_row_id then
      raise exception 'Assessment item mappings do not match the finalized TOS blueprint';
    end if;

    if item_competency_id is null or item_cognitive_category_id is null or item_tos_row_id is null or item_allocation_item_start is null or item_allocation_item_end is null or item_allocation_index is null then raise exception 'Assessment items require complete TOS mapping snapshots'; end if;
    if item_points_possible is null or item_points_possible <= 0 then raise exception 'Assessment items require a finite positive point value'; end if;
    if public.assessment_answer_shape_valid(item_question_type, item_answer) is not true then raise exception 'Assessment item answer payload has an invalid shape for its question type'; end if;

    if p_document_id is not null then
      select locked, prompt, answer, question_type, points_possible into existing_locked, existing_prompt, existing_answer, existing_question_type, existing_points
      from public.assessment_items where assessment_document_id = saved.id and item_number = item_number;
      if existing_locked is true and (item_prompt <> existing_prompt or item_answer is distinct from existing_answer or item_question_type <> existing_question_type or item_points_possible <> existing_points) then
        raise exception 'A locked assessment item cannot be changed without explicitly unlocking it first';
      end if;
    end if;

    insert into public.assessment_items (
      assessment_document_id, item_number, prompt, question_type, answer, points_possible, points,
      authorship_state, qa_state, locked, history, canonical_competency_id, cognitive_category_id,
      cognitive_category_label_snapshot, cognitive_category_short_label_snapshot, tos_row_id,
      allocation_item_start, allocation_item_end, allocation_index, rationale, teacher_notes
    ) values (
      saved.id, item_number, item_prompt, item_question_type, item_answer, item_points_possible, item_points,
      item_authorship_state, item_qa_state, item_locked, item_history, item_competency_id, item_cognitive_category_id,
      item_value -> 'cognitiveCategorySnapshot' ->> 'label', item_value -> 'cognitiveCategorySnapshot' ->> 'shortLabel',
      item_tos_row_id, item_allocation_item_start, item_allocation_item_end, item_allocation_index, item_rationale, item_teacher_notes
    )
    on conflict (assessment_document_id, item_number) do update set
      prompt = excluded.prompt, question_type = excluded.question_type, answer = excluded.answer,
      points_possible = excluded.points_possible, points = excluded.points, authorship_state = excluded.authorship_state,
      qa_state = excluded.qa_state, locked = excluded.locked, history = excluded.history,
      rationale = excluded.rationale, teacher_notes = excluded.teacher_notes;
  end loop;

  select exists (
    select 1 from public.assessment_items ai
    where ai.assessment_document_id = saved.id
      and not exists (
        select 1 from public.tos_competencies tc
        where tc.document_id = assessment_row.source_tos_document_id
          and tc.row_id = ai.tos_row_id
          and tc.competency_id = ai.canonical_competency_id
          and ai.item_number between tc.item_start and tc.item_end
          and exists (
            select 1 from jsonb_array_elements(tc.cognitive_allocations) allocation
            where allocation ->> 'categoryId' = ai.cognitive_category_id
              and ai.item_number between (allocation ->> 'itemStart')::integer and (allocation ->> 'itemEnd')::integer
              and allocation ->> 'label' = ai.cognitive_category_label_snapshot
          )
      )
  ) into bad;
  if bad then raise exception 'Assessment item mappings do not match the finalized TOS blueprint'; end if;

  update public.documents d set title = btrim(p_title), school_year = btrim(p_school_year), academic_period_label = nullif(btrim(coalesce(p_academic_period_label, '')), ''), status = p_status, structured_content = p_structured_content where d.id = saved.id returning * into saved;
  update public.assessment_documents ad set instructions = coalesce(p_instructions, ''), metadata = jsonb_build_object('gradingTermId', saved.academic_period_label) where ad.document_id = saved.id returning * into assessment_row;

  insert into public.document_versions (document_id, version_number, structured_content, change_note)
  values (saved.id, next_version, p_structured_content, p_change_note);

  if p_status = 'final' then
    select exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and public.assessment_item_mirror(ai) is distinct from ((coalesce(p_structured_content, '{}'::jsonb) -> 'items' -> (ai.item_number - 1)))
    ) into bad;
    if bad then raise exception 'Assessment JSON and relational item projections do not match'; end if;
  end if;

  return saved;
end;
$$;

revoke all on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) to authenticated;


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

    if participant_id is null or learner_id is null or item_id is null or item_number is null then raise exception 'Result outcome identity is required'; end if;

    if possible_points is null or possible_points < 0 then
      raise exception 'Possible points must be a finite nonnegative number';
    end if;
    if earned_points is null or earned_points < 0 then
      raise exception 'Earned points must be a finite nonnegative number';
    end if;
    if earned_points > possible_points then
      raise exception 'Earned points cannot exceed possible points';
    end if;

    if answer is not null and octet_length(answer::text) > 4000 then raise exception 'Learner answer is too long'; end if;
    if outcome_value ->> 'teacherFeedback' is not null and octet_length(outcome_value ->> 'teacherFeedback') > 2000 then raise exception 'Teacher feedback is too long'; end if;

    select * into participant_row from public.result_session_learners p where p.id = participant_id and p.result_session_id = session_row.id and p.user_id = owner_id;
    if participant_row.id is null or participant_row.learner_id is distinct from learner_id then raise exception 'Result participant is invalid'; end if;

    select value into item_value from jsonb_array_elements(session_row.assessment_snapshot -> 'items') where value ->> 'id' = item_id::text and (value ->> 'itemNumber')::integer = item_number;
    if item_value is null then raise exception 'Result item is invalid'; end if;

    if possible_points <> coalesce(nullif(item_value ->> 'pointsPossible', '')::numeric, nullif(item_value ->> 'points', '')::numeric, 1) then
      raise exception 'Result points do not match the immutable assessment snapshot';
    end if;

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
    participant_id := (score_value ->> 'participantId')::uuid;
    learner_id := (score_value ->> 'learnerId')::uuid;
    if score_value ->> 'teacherFeedback' is not null and octet_length(score_value ->> 'teacherFeedback') > 2000 then raise exception 'Teacher feedback is too long'; end if;
    raw_score := case when score_value ->> 'rawScore' is null then null else (score_value ->> 'rawScore')::numeric end;
    possible_points := (score_value ->> 'possiblePoints')::numeric;

    if participant_id is null or learner_id is null then raise exception 'Score-only participant identity is required'; end if;
    if possible_points is null or possible_points < 0 then
      raise exception 'Possible points must be a finite nonnegative number';
    end if;
    if raw_score is not null then
      if raw_score < 0 then
        raise exception 'Earned points must be a finite nonnegative number';
      end if;
      if raw_score > possible_points then
        raise exception 'Earned points cannot exceed possible points';
      end if;
    end if;
    if possible_points is distinct from (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric then
      raise exception 'Score-only points do not match the immutable assessment snapshot';
    end if;

    select * into participant_row from public.result_session_learners p where p.id = participant_id and p.result_session_id = session_row.id and p.user_id = owner_id;
    if participant_row.id is null or participant_row.learner_id is distinct from learner_id then raise exception 'Score participant is invalid'; end if;

    insert into public.result_score_only_outcomes (user_id, result_session_id, participant_id, learner_id, raw_score, possible_points, teacher_feedback)
    values (owner_id, session_row.id, participant_id, learner_id, raw_score, possible_points, nullif(score_value ->> 'teacherFeedback', ''));
  end loop;

  update public.result_session_learners p set raw_score = case when p_entry_mode = 'score_only' then (select so.raw_score from public.result_score_only_outcomes so where so.result_session_id = session_row.id and so.participant_id = p.id) else coalesce((select sum(io.earned_points) from public.result_item_outcomes io where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end, possible_points = (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric, percentage = case when (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric > 0 and (case when p_entry_mode = 'score_only' then (select so.raw_score from public.result_score_only_outcomes so where so.result_session_id = session_row.id and so.participant_id = p.id) else coalesce((select sum(io.earned_points) from public.result_item_outcomes io where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end) is not null then round(100 * (case when p_entry_mode = 'score_only' then (select so.raw_score from public.result_score_only_outcomes so where so.result_session_id = session_row.id and so.participant_id = p.id) else coalesce((select sum(io.earned_points) from public.result_item_outcomes io where io.result_session_id = session_row.id and io.participant_id = p.id), 0) end) / (session_row.assessment_snapshot ->> 'totalPossiblePoints')::numeric, 4) else null end where p.result_session_id = session_row.id;
  update public.result_sessions set title = btrim(p_title), administration_date = coalesce(p_administration_date, administration_date), entry_mode = p_entry_mode, short_answer_scoring = case when jsonb_typeof(p_short_answer_scoring) = 'object' then p_short_answer_scoring else short_answer_scoring end, status = p_status, version_number = expected_version + 1 where id = session_row.id returning * into session_row;
  return session_row;
end;
$$;

revoke all on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) from public;
grant execute on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text) to authenticated;
