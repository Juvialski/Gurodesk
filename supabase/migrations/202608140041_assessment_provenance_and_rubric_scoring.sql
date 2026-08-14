-- GuroDesk Additive Migration 041: Multi-Mode Assessment Provenance & Criterion-Level Rubric Scoring
--
-- Safely supports:
-- 1. Standard TOS assessments (100% backward compatible, strict TOS verification)
-- 2. Lesson Quizzes (assignment-bound, single lesson-plan source snapshot, no fake TOS)
-- 3. Unit Quizzes (multi-lesson coverage, deterministic Hamilton allocation, no fake TOS)
-- 4. Authentic Performance Tasks (dedicated structured payload with analytic rubrics, no fake question items)
-- 5. Criterion-level rubric scoring in result sessions with frozen rubric snapshots.

-- 1. Relax NOT NULL constraints on TOS-specific columns in assessment_documents
alter table public.assessment_documents
  alter column source_tos_document_id drop not null,
  alter column source_tos_version_number drop not null,
  alter column source_tos_content_snapshot drop not null,
  alter column source_tos_raw_content_snapshot drop not null;

-- Update total_items check constraint to allow 0 for Performance Tasks
alter table public.assessment_documents
  drop constraint if exists assessment_documents_total_items_check;
alter table public.assessment_documents
  add constraint assessment_documents_total_items_check check (total_items between 0 and 10000);

-- Add explicit provenance columns to assessment_documents
alter table public.assessment_documents
  add column if not exists mode text not null default 'standard',
  add column if not exists source_type text not null default 'tos',
  add column if not exists source_lesson_document_id uuid references public.documents(id) on delete restrict;

-- 2. Relax NOT NULL constraints on TOS-specific columns in assessment_items
alter table public.assessment_items
  alter column canonical_competency_id drop not null,
  alter column tos_row_id drop not null,
  alter column allocation_item_start drop not null,
  alter column allocation_item_end drop not null,
  alter column allocation_index drop not null;

alter table public.assessment_items
  add column if not exists coverage_entry_id text,
  add column if not exists source_lesson_id uuid references public.documents(id) on delete restrict;

-- 3. Update result_sessions entry_mode and add rubric_snapshot
alter table public.result_sessions
  drop constraint if exists result_sessions_entry_mode_check;
alter table public.result_sessions
  add constraint result_sessions_entry_mode_check check (entry_mode in ('answer_sheet', 'item', 'score_only', 'rubric'));

alter table public.result_sessions
  add column if not exists rubric_snapshot jsonb default null;

-- 4. Create result_rubric_outcomes table for criterion-level Performance Task scoring
create table if not exists public.result_rubric_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_session_id uuid not null references public.result_sessions(id) on delete cascade,
  participant_id uuid not null references public.result_session_learners(id) on delete cascade,
  learner_id uuid not null references public.class_learners(id) on delete restrict,
  criterion_id text not null check (char_length(btrim(criterion_id)) between 1 and 160),
  selected_level_id text,
  earned_points numeric(12,4) not null default 0 check (earned_points >= 0),
  possible_points numeric(12,4) not null check (possible_points >= 0),
  teacher_feedback text check (teacher_feedback is null or octet_length(teacher_feedback) <= 4000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (result_session_id, participant_id, criterion_id),
  foreign key (participant_id, result_session_id, user_id)
    references public.result_session_learners(id, result_session_id, user_id) on delete cascade,
  foreign key (result_session_id, user_id)
    references public.result_sessions(id, user_id) on delete cascade
);

create index if not exists idx_result_rubric_outcomes_owner_session
  on public.result_rubric_outcomes(user_id, result_session_id, participant_id);
create index if not exists idx_result_rubric_outcomes_owner_participant
  on public.result_rubric_outcomes(user_id, participant_id);

alter table public.result_rubric_outcomes enable row level security;
drop policy if exists result_rubric_outcomes_select_own on public.result_rubric_outcomes;
create policy result_rubric_outcomes_select_own on public.result_rubric_outcomes
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.result_rubric_outcomes from public;
grant select on public.result_rubric_outcomes to authenticated;

-- 5. Authoritative Multi-Mode save_assessment_document RPC
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
  saved public.documents%rowtype;
  assessment_row public.assessment_documents%rowtype;
  source_row public.documents%rowtype;
  source_content jsonb;
  source_canonical_content jsonb;
  source_max_version integer;
  source_total_items integer;
  item_value jsonb;
  item_id uuid;
  item_competency_id uuid;
  item_tos_row_id uuid;
  item_cognitive_category_id text;
  item_cognitive_category_label text;
  item_cognitive_category_short_label text;
  item_question_type public.assessment_question_type;
  item_authorship public.assessment_authorship_state;
  item_number integer;
  item_points numeric;
  item_count integer;
  expected_number integer := 1;
  canonical_count integer;
  mirror jsonb;
  normalized_content jsonb;
  total_points numeric := 0;
  bad boolean;
  next_version integer;
  existing_item public.assessment_items%rowtype;
  incoming_item jsonb;
  settings_value jsonb;
  req_mode text;
  req_source_type text;
  perf_task jsonb;
  perf_rubric jsonb;
  source_lesson jsonb;
  source_lessons jsonb;
  lesson_doc_id uuid;
  lesson_row public.documents%rowtype;
  lesson_idx integer;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Assessment status must be draft or final'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Assessment items must be an array'; end if;
  if octet_length(coalesce(p_items::text, '')) > 16 * 1024 * 1024
     or octet_length(coalesce(p_structured_content::text, '')) > 16 * 1024 * 1024 then
    raise exception 'Assessment save payload is too large';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) > 240
     or char_length(coalesce(p_instructions, '')) > 100000
     or char_length(coalesce(p_change_note, '')) > 1000 then
    raise exception 'Assessment text exceeds the supported save limit';
  end if;
  item_count := jsonb_array_length(p_items);
  if item_count > 10000 then raise exception 'Assessment contains too many items'; end if;
  if jsonb_typeof(coalesce(p_structured_content, '{}'::jsonb)) is distinct from 'object' then
    raise exception 'Assessment content must be an object';
  end if;
  if p_assignment_id is null or not exists (
    select 1 from public.teacher_assignments ta
    where ta.id = p_assignment_id and ta.user_id = owner_id
  ) then raise exception 'A teacher-owned assignment is required'; end if;

  req_mode := coalesce(p_structured_content ->> 'mode', 'standard');
  if req_mode not in ('standard', 'lesson_quiz', 'unit_quiz', 'performance_task') then
    raise exception 'Invalid assessment mode';
  end if;
  req_source_type := coalesce(p_structured_content ->> 'sourceType',
    case when req_mode = 'lesson_quiz' then 'lesson_plan'
         when req_mode = 'unit_quiz' then 'multi_lesson_plan'
         when req_mode = 'performance_task' then 'lesson_plan'
         else 'tos' end
  );

  -- Assessment/document row triggers require this transaction-local guard.
  perform set_config('app.assessment_rpc', '1', true);

  if p_document_id is not null then
    select * into saved
    from public.documents d
    where d.id = p_document_id
      and d.user_id = owner_id
      and d.document_type = 'assessment'
    for update;
    if saved.id is null then raise exception 'Assessment document not found'; end if;
    if saved.status <> 'draft' then raise exception 'Only draft assessment documents can be edited'; end if;

    select * into assessment_row
    from public.assessment_documents ad
    where ad.document_id = saved.id
    for update;
    if assessment_row.document_id is null then raise exception 'Assessment metadata is missing'; end if;
    if p_assignment_id is distinct from assessment_row.assignment_id then
      raise exception 'The assignment for an existing assessment cannot be changed';
    end if;
  end if;

  -- ----------------------------------------------------
  -- Mode-Specific Source Verification
  -- ----------------------------------------------------
  if req_mode = 'standard' then
    if p_source_tos_document_id is null then
      raise exception 'Standard assessments require a finalized TOS source document';
    end if;

    if assessment_row.document_id is not null
       and p_source_tos_document_id is distinct from assessment_row.source_tos_document_id then
      raise exception 'The source TOS for an existing assessment cannot be changed';
    end if;

    select * into source_row
    from public.documents d
    where d.id = p_source_tos_document_id
      and d.user_id = owner_id
      and d.document_type = 'tos'
      and d.status in ('final', 'archived')
      and d.assignment_id = p_assignment_id
    for share;

    if source_row.id is null then
      raise exception 'Finalized teacher-owned source TOS document not found';
    end if;

    select coalesce(max(dv.version_number), 0) into source_max_version
    from public.document_versions dv
    where dv.document_id = source_row.id;

    if source_max_version <= 0 then
      raise exception 'Source TOS has no immutable finalized version';
    end if;

    source_content := source_row.structured_content;
    source_total_items := coalesce((source_content ->> 'totalItems')::integer, 0);
    if source_total_items <= 0 then
      raise exception 'Source TOS total item count must be positive';
    end if;

    if item_count <> source_total_items then
      raise exception 'Assessment items count must match the source TOS total items count';
    end if;

  elsif req_mode = 'lesson_quiz' then
    source_lesson := p_structured_content -> 'sourceLesson';
    if source_lesson is null or jsonb_typeof(source_lesson) is distinct from 'object' then
      raise exception 'Lesson quiz requires a valid sourceLesson snapshot';
    end if;

    lesson_doc_id := (source_lesson ->> 'id')::uuid;
    if lesson_doc_id is not null then
      select * into lesson_row
      from public.documents d
      where d.id = lesson_doc_id
        and d.user_id = owner_id
        and d.document_type = 'lesson_plan'
      for share;
    end if;

    if item_count < 1 then
      raise exception 'Lesson quiz requires at least one question item';
    end if;

  elsif req_mode = 'unit_quiz' then
    source_lessons := p_structured_content -> 'sourceLessons';
    if source_lessons is null or jsonb_typeof(source_lessons) is distinct from 'array'
       or jsonb_array_length(source_lessons) < 2 then
      raise exception 'Unit quiz requires at least 2 source lesson plan snapshots';
    end if;

    for lesson_idx in 0..jsonb_array_length(source_lessons) - 1 loop
      lesson_doc_id := ((source_lessons -> lesson_idx) ->> 'id')::uuid;
      if lesson_doc_id is not null then
        select * into lesson_row
        from public.documents d
        where d.id = lesson_doc_id
          and d.user_id = owner_id
          and d.document_type = 'lesson_plan'
        for share;
      end if;
    end loop;

    if item_count < 1 then
      raise exception 'Unit quiz requires at least one question item';
    end if;

  elsif req_mode = 'performance_task' then
    perf_task := p_structured_content -> 'performanceTask';
    if perf_task is null or jsonb_typeof(perf_task) is distinct from 'object' then
      raise exception 'Performance task requires a dedicated performanceTask content payload';
    end if;

    perf_rubric := perf_task -> 'rubric';
    if perf_rubric is null or jsonb_typeof(perf_rubric) is distinct from 'object'
       or jsonb_typeof(perf_rubric -> 'criteria') is distinct from 'array'
       or jsonb_array_length(perf_rubric -> 'criteria') < 1 then
      raise exception 'Performance task requires an analytic scoring rubric with at least one criterion';
    end if;
  end if;

  -- ----------------------------------------------------
  -- Item Validation & Integrity
  -- ----------------------------------------------------
  if item_count > 0 then
    for item_value in select jsonb_array_elements(p_items) loop
      item_number := coalesce((item_value ->> 'itemNumber')::integer, (item_value ->> 'item_number')::integer);
      if item_number is distinct from expected_number then
        raise exception 'Assessment item numbers must be contiguous from 1 without gaps';
      end if;
      expected_number := expected_number + 1;

      item_question_type := (item_value ->> 'questionType')::public.assessment_question_type;
      item_authorship := coalesce((item_value ->> 'authorshipState')::public.assessment_authorship_state, 'empty'::public.assessment_authorship_state);
      item_points := coalesce((item_value ->> 'pointsPossible')::numeric, (item_value ->> 'points')::numeric, 1);
      if item_points <= 0 then raise exception 'Every item must have positive points'; end if;
      total_points := total_points + item_points;
    end loop;
  else
    if req_mode = 'performance_task' then
      total_points := coalesce((p_structured_content -> 'performanceTask' -> 'rubric' ->> 'totalPoints')::numeric, 0);
    end if;
  end if;

  -- ----------------------------------------------------
  -- Save Documents Shell
  -- ----------------------------------------------------
  settings_value := coalesce(p_structured_content -> 'settings', '{}'::jsonb);
  mirror := p_structured_content;

  if p_document_id is null then
    insert into public.documents (
      user_id, assignment_id, document_type, title, school_year,
      academic_period_label, status, structured_content
    ) values (
      owner_id, p_assignment_id, 'assessment', btrim(p_title), p_school_year,
      p_academic_period_label, p_status, mirror
    ) returning * into saved;

    insert into public.assessment_documents (
      document_id, user_id, assignment_id,
      source_tos_document_id, source_tos_version_number,
      source_tos_content_snapshot, source_tos_raw_content_snapshot,
      total_items, instructions, mode, source_type, source_lesson_document_id
    ) values (
      saved.id, owner_id, p_assignment_id,
      p_source_tos_document_id, source_max_version,
      coalesce(source_content, '{}'::jsonb), coalesce(source_content, '{}'::jsonb),
      item_count, coalesce(p_instructions, ''),
      req_mode, req_source_type,
      case when req_mode = 'lesson_quiz' then ((p_structured_content -> 'sourceLesson') ->> 'id')::uuid else null end
    ) returning * into assessment_row;
  else
    update public.documents d
    set title = btrim(p_title),
        school_year = p_school_year,
        academic_period_label = p_academic_period_label,
        status = p_status,
        structured_content = mirror,
        updated_at = timezone('utc', now())
    where d.id = saved.id
    returning * into saved;

    update public.assessment_documents ad
    set total_items = item_count,
        instructions = coalesce(p_instructions, ''),
        mode = req_mode,
        source_type = req_source_type,
        updated_at = timezone('utc', now())
    where ad.document_id = saved.id
    returning * into assessment_row;
  end if;

  -- ----------------------------------------------------
  -- Synchronize Assessment Items
  -- ----------------------------------------------------
  delete from public.assessment_items
  where assessment_document_id = saved.id;

  if item_count > 0 then
    for item_value in select jsonb_array_elements(p_items) loop
      item_id := case when (item_value ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (item_value ->> 'id')::uuid else gen_random_uuid() end;
      item_number := (item_value ->> 'itemNumber')::integer;
      item_question_type := (item_value ->> 'questionType')::public.assessment_question_type;
      item_authorship := coalesce((item_value ->> 'authorshipState')::public.assessment_authorship_state, 'empty');
      item_points := coalesce((item_value ->> 'pointsPossible')::numeric, (item_value ->> 'points')::numeric, 1);

      insert into public.assessment_items (
        id, assessment_document_id, item_number,
        canonical_competency_id, competency_code_snapshot, competency_text_snapshot,
        competency_source_page_snapshot, competency_academic_period_id_snapshot,
        competency_curriculum_period_id_snapshot, competency_period_label_snapshot,
        tos_row_id, allocation_item_start, allocation_item_end, allocation_index,
        cognitive_category_id, cognitive_category_label_snapshot, cognitive_category_short_label_snapshot,
        question_type, prompt, choices, answer, points,
        rationale, teacher_notes, authorship_state,
        qa_state, locked, version_history,
        points_possible, point_start, point_end, plan_entry_id,
        coverage_entry_id, source_lesson_id
      ) values (
        item_id, saved.id, item_number,
        case when (item_value -> 'competencySnapshot' ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (item_value -> 'competencySnapshot' ->> 'id')::uuid else null end,
        item_value -> 'competencySnapshot' ->> 'code',
        coalesce(item_value -> 'competencySnapshot' ->> 'text', ''),
        (item_value -> 'competencySnapshot' ->> 'sourcePage')::integer,
        item_value -> 'competencySnapshot' ->> 'academicPeriodId',
        item_value -> 'competencySnapshot' ->> 'curriculumPeriodId',
        coalesce(item_value -> 'competencySnapshot' ->> 'curriculumPeriodLabel', ''),
        case when (item_value -> 'mapping' ->> 'rowId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (item_value -> 'mapping' ->> 'rowId')::uuid else null end,
        coalesce((item_value -> 'mapping' ->> 'allocationItemStart')::integer, item_number),
        coalesce((item_value -> 'mapping' ->> 'allocationItemEnd')::integer, item_number),
        coalesce((item_value -> 'mapping' ->> 'allocationIndex')::integer, 0),
        coalesce(item_value -> 'cognitiveCategorySnapshot' ->> 'id', 'remembering'),
        coalesce(item_value -> 'cognitiveCategorySnapshot' ->> 'label', 'Remembering'),
        coalesce(item_value -> 'cognitiveCategorySnapshot' ->> 'shortLabel', 'REM'),
        item_question_type,
        coalesce(item_value ->> 'prompt', ''),
        coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb),
        coalesce(item_value -> 'answer', '{}'::jsonb),
        item_points,
        coalesce(item_value ->> 'rationale', ''),
        coalesce(item_value ->> 'teacherNotes', ''),
        item_authorship,
        coalesce(item_value ->> 'qaState', 'empty'),
        coalesce((item_value ->> 'locked')::boolean, false),
        coalesce(item_value -> 'history', '[]'::jsonb),
        item_points,
        (item_value ->> 'pointStart')::integer,
        (item_value ->> 'pointEnd')::integer,
        item_value ->> 'planEntryId',
        item_value -> 'mapping' ->> 'coverageEntryId',
        case when (item_value -> 'mapping' ->> 'sourceLessonId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (item_value -> 'mapping' ->> 'sourceLessonId')::uuid else null end
      );
    end loop;
  end if;

  -- ----------------------------------------------------
  -- Version Snapshot
  -- ----------------------------------------------------
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.document_versions
  where document_id = saved.id;

  insert into public.document_versions (
    document_id, version_number, title, status, structured_content, change_note, created_by
  ) values (
    saved.id, next_version, saved.title, saved.status, mirror, p_change_note, owner_id
  );

  return saved;
end;
$$;

revoke all on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) to authenticated;

-- 6. Update result_assessment_snapshot function to freeze Performance Task rubrics
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
  is_perf_task boolean;
  rubric_pts numeric;
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

  source_content := coalesce(d.structured_content, ad.source_tos_content_snapshot, '{}'::jsonb);
  is_perf_task := (coalesce(ad.mode, source_content ->> 'mode') = 'performance_task');

  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number), '[]'::jsonb),
         coalesce(sum(ai.points), 0)
    into item_rows, item_total
  from public.assessment_items ai where ai.assessment_document_id = d.id;

  if is_perf_task then
    rubric_pts := coalesce((source_content -> 'performanceTask' -> 'rubric' ->> 'totalPoints')::numeric, 0);
    item_total := rubric_pts;
  else
    if jsonb_array_length(item_rows) <> ad.total_items then
      raise exception 'Finalized assessment item projection is incomplete';
    end if;
  end if;

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
    'items', item_rows,
    'rubricSnapshot', case when is_perf_task then source_content -> 'performanceTask' -> 'rubric' else null end
  );
end;
$$;

revoke all on function public.result_assessment_snapshot(uuid, uuid) from public;

-- 7. Update save_result_session to support rubric outcomes
create or replace function public.save_result_session(
  p_session_id uuid,
  p_title text,
  p_administration_date date,
  p_entry_mode text,
  p_short_answer_scoring jsonb,
  p_item_outcomes jsonb default '[]'::jsonb,
  p_score_only_outcomes jsonb default '[]'::jsonb,
  p_expected_version integer default null,
  p_status text default 'draft',
  p_rubric_outcomes jsonb default '[]'::jsonb
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
  rubric_val jsonb;
  crit_score jsonb;
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
  crit_id text;
  lvl_id text;
  earned_crit numeric;
  crit_feedback text;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Result saves may be draft or final'; end if;
  if octet_length(coalesce(p_item_outcomes::text, '')) > 8 * 1024 * 1024
     or octet_length(coalesce(p_score_only_outcomes::text, '')) > 1024 * 1024
     or octet_length(coalesce(p_rubric_outcomes::text, '')) > 4 * 1024 * 1024 then
    raise exception 'Result batch payload is too large';
  end if;
  if p_short_answer_scoring is not null and octet_length(p_short_answer_scoring::text) > 8000 then
    raise exception 'Short-answer scoring configuration is too large';
  end if;
  if jsonb_typeof(coalesce(p_item_outcomes, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(p_score_only_outcomes, '[]'::jsonb)) is distinct from 'array'
     or jsonb_typeof(coalesce(p_rubric_outcomes, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Result outcomes must be arrays';
  end if;

  select * into session_row from public.result_sessions
  where id = p_session_id and user_id = owner_id for update;
  if session_row.id is null then raise exception 'Result session not found'; end if;
  if session_row.status <> 'draft' then raise exception 'Only draft result sessions can be saved'; end if;
  if p_expected_version is not null and p_expected_version <> session_row.version_number then
    raise exception 'Result draft changed elsewhere; reload before saving';
  end if;

  if p_entry_mode not in ('answer_sheet', 'item', 'score_only', 'rubric') then
    raise exception 'Invalid result entry mode';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 240 then
    raise exception 'Result title is required';
  end if;

  short_answer_config := case when jsonb_typeof(p_short_answer_scoring) = 'object'
    then p_short_answer_scoring else coalesce(session_row.short_answer_scoring, '{}'::jsonb) end;

  expected_version := session_row.version_number;
  perform set_config('app.results_rpc', '1', true);

  delete from public.result_item_outcomes where result_session_id = session_row.id;
  delete from public.result_score_only_outcomes where result_session_id = session_row.id;
  delete from public.result_rubric_outcomes where result_session_id = session_row.id;

  -- 1. Insert Item Outcomes
  if p_entry_mode in ('answer_sheet', 'item') then
    for outcome_value in select jsonb_array_elements(p_item_outcomes) loop
      participant_id := (outcome_value ->> 'participantId')::uuid;
      learner_id := (outcome_value ->> 'learnerId')::uuid;
      item_id := (outcome_value ->> 'itemId')::uuid;
      item_number := (outcome_value ->> 'itemNumber')::integer;
      possible_points := (outcome_value ->> 'possiblePoints')::numeric;
      earned_points := (outcome_value ->> 'earnedPoints')::numeric;
      scoring_source := coalesce(outcome_value ->> 'scoringSource', 'deterministic');
      answer := outcome_value -> 'answer';
      is_correct := (outcome_value ->> 'isCorrect')::boolean;

      select * into participant_row from public.result_session_learners
      where id = participant_id and result_session_id = session_row.id and user_id = owner_id for share;
      if participant_row.id is null or participant_row.learner_id is distinct from learner_id then
        raise exception 'Item outcome participant does not belong to this session';
      end if;

      insert into public.result_item_outcomes (
        result_session_id, user_id, participant_id, learner_id,
        item_id, item_number, learner_answer, is_correct,
        earned_points, possible_points, teacher_feedback, scoring_source
      ) values (
        session_row.id, owner_id, participant_id, learner_id,
        item_id, item_number, answer, is_correct,
        earned_points, possible_points, outcome_value ->> 'teacherFeedback', scoring_source
      );
    end loop;
  end if;

  -- 2. Insert Score Only Outcomes
  if p_entry_mode = 'score_only' then
    for score_value in select jsonb_array_elements(p_score_only_outcomes) loop
      participant_id := (score_value ->> 'participantId')::uuid;
      learner_id := (score_value ->> 'learnerId')::uuid;
      raw_score := (score_value ->> 'rawScore')::numeric;
      possible_points := (score_value ->> 'possiblePoints')::numeric;

      select * into participant_row from public.result_session_learners
      where id = participant_id and result_session_id = session_row.id and user_id = owner_id for share;
      if participant_row.id is null or participant_row.learner_id is distinct from learner_id then
        raise exception 'Score-only outcome participant does not belong to this session';
      end if;

      insert into public.result_score_only_outcomes (
        result_session_id, user_id, participant_id, learner_id,
        raw_score, possible_points, teacher_feedback
      ) values (
        session_row.id, owner_id, participant_id, learner_id,
        raw_score, possible_points, score_value ->> 'teacherFeedback'
      );
    end loop;
  end if;

  -- 3. Insert Rubric Outcomes
  if p_entry_mode = 'rubric' or jsonb_array_length(p_rubric_outcomes) > 0 then
    for rubric_val in select jsonb_array_elements(p_rubric_outcomes) loop
      participant_id := (rubric_val ->> 'participantId')::uuid;
      learner_id := (rubric_val ->> 'learnerId')::uuid;

      select * into participant_row from public.result_session_learners
      where id = participant_id and result_session_id = session_row.id and user_id = owner_id for share;
      if participant_row.id is null or participant_row.learner_id is distinct from learner_id then
        raise exception 'Rubric outcome participant does not belong to this session';
      end if;

      for crit_score in select jsonb_array_elements(coalesce(rubric_val -> 'criteriaScores', '[]'::jsonb)) loop
        crit_id := crit_score ->> 'criterionId';
        lvl_id := crit_score ->> 'selectedLevelId';
        earned_crit := coalesce((crit_score ->> 'earnedPoints')::numeric, 0);
        crit_feedback := crit_score ->> 'teacherFeedback';

        insert into public.result_rubric_outcomes (
          result_session_id, user_id, participant_id, learner_id,
          criterion_id, selected_level_id, earned_points, possible_points,
          teacher_feedback
        ) values (
          session_row.id, owner_id, participant_id, learner_id,
          crit_id, lvl_id, earned_crit,
          coalesce((crit_score ->> 'possiblePoints')::numeric, earned_crit),
          crit_feedback
        );
      end loop;
    end loop;
  end if;

  -- 4. Update Result Session Row
  update public.result_sessions
  set title = btrim(p_title),
      administration_date = coalesce(p_administration_date, session_row.administration_date),
      entry_mode = p_entry_mode,
      short_answer_scoring = short_answer_config,
      status = p_status,
      version_number = session_row.version_number + 1,
      updated_at = timezone('utc', now())
  where id = session_row.id
  returning * into session_row;

  return session_row;
end;
$$;

revoke all on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text, jsonb) from public;
grant execute on function public.save_result_session(uuid, text, date, text, jsonb, jsonb, jsonb, integer, text, jsonb) to authenticated;
