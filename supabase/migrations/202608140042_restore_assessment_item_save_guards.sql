-- GuroDesk migration 042: restore guarded assessment draft saves.
--
-- Migration 041 introduced lesson quizzes, unit quizzes, performance tasks,
-- and rubric scoring, but its replacement save_assessment_document() omitted
-- mature protections for standard-assessment source/mapping immutability,
-- persisted item identity, and locked-item edits.
--
-- Production did not successfully record the previous 042 attempt. Replace
-- that failed migration with this deterministic CREATE OR REPLACE definition.
-- This intentionally preserves migration 041's multi-mode behavior and only
-- restores the missing save invariants.

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

    -- Preserve the mature standard-assessment source contract while allowing
    -- the newer non-TOS modes to use their mode-specific source snapshots.
    if req_mode = 'standard'
       and (
         p_assignment_id is distinct from assessment_row.assignment_id
         or p_source_tos_document_id is distinct from assessment_row.source_tos_document_id
       ) then
      raise exception 'Assessment assignment and source cannot change';
    elsif p_assignment_id is distinct from assessment_row.assignment_id then
      raise exception 'The assignment for an existing assessment cannot be changed';
    end if;

    -- Existing item-based assessments must keep explicit unique UUIDs.
    if item_count > 0 and (
      select count(distinct elem.value ->> 'id')
      from jsonb_array_elements(p_items) as elem(value)
    ) <> item_count then
      raise exception 'Assessment item UUIDs must be unique within a saved assessment';
    end if;

    -- Standard assessments are immutable projections of a finalized TOS.
    -- Question content may change while unlocked, but persisted TOS mapping and
    -- matching snapshots may not be rewritten by the client.
    if req_mode = 'standard' and exists (
      select 1
      from public.assessment_items existing_ai
      join lateral (
        select elem.value as item
        from jsonb_array_elements(p_items) as elem(value)
        where elem.value ->> 'id' = existing_ai.id::text
        limit 1
      ) incoming on true
      where existing_ai.assessment_document_id = saved.id
        and (
          incoming.item ->> 'itemNumber' is distinct from existing_ai.item_number::text
          or incoming.item -> 'mapping' ->> 'rowId' is distinct from existing_ai.tos_row_id::text
          or incoming.item -> 'mapping' ->> 'competencyId' is distinct from existing_ai.canonical_competency_id::text
          or incoming.item -> 'mapping' ->> 'cognitiveCategoryId' is distinct from existing_ai.cognitive_category_id
          or incoming.item -> 'mapping' ->> 'allocationItemStart' is distinct from existing_ai.allocation_item_start::text
          or incoming.item -> 'mapping' ->> 'allocationItemEnd' is distinct from existing_ai.allocation_item_end::text
          or incoming.item -> 'mapping' ->> 'allocationIndex' is distinct from existing_ai.allocation_index::text
          or incoming.item -> 'competencySnapshot' ->> 'id' is distinct from existing_ai.canonical_competency_id::text
          or incoming.item -> 'cognitiveCategorySnapshot' ->> 'id' is distinct from existing_ai.cognitive_category_id
          or incoming.item -> 'cognitiveCategorySnapshot' ->> 'label' is distinct from existing_ai.cognitive_category_label_snapshot
          or incoming.item -> 'cognitiveCategorySnapshot' ->> 'shortLabel' is distinct from existing_ai.cognitive_category_short_label_snapshot
        )
    ) then
      raise exception 'Assessment item mappings do not match the finalized TOS blueprint';
    end if;

    -- Locked items remain immutable unless the exact persisted item is
    -- explicitly unlocked in the incoming payload. This applies to all modes.
    for existing_item in
      select ai.*
      from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and ai.locked
      for update
    loop
      incoming_item := null;

      select elem.value
      into incoming_item
      from jsonb_array_elements(p_items) as elem(value)
      where elem.value ->> 'id' = existing_item.id::text
      limit 1;

      if incoming_item is null then
        raise exception 'Locked assessment item is missing from the save payload';
      end if;

      if coalesce((incoming_item ->> 'locked')::boolean, true)
         and (
           coalesce(incoming_item ->> 'prompt', '') is distinct from existing_item.prompt
           or coalesce(incoming_item -> 'answer', '{}'::jsonb) is distinct from existing_item.answer
           or coalesce(nullif(incoming_item ->> 'questionType', ''), 'multiple_choice')
                is distinct from existing_item.question_type::text
           or coalesce(
                nullif(incoming_item ->> 'pointsPossible', '')::numeric,
                nullif(incoming_item ->> 'points', '')::numeric,
                1
              ) is distinct from existing_item.points_possible
           or coalesce(incoming_item ->> 'rationale', '') is distinct from existing_item.rationale
           or coalesce(incoming_item ->> 'teacherNotes', '') is distinct from existing_item.teacher_notes
         ) then
        raise exception 'Locked assessment item cannot be changed until explicitly unlocked';
      end if;
    end loop;

    -- Retained item positions keep their persisted UUIDs. Lesson/unit quizzes
    -- may grow or shrink at the end, but may not silently swap the identity of
    -- an item that survives at the same position.
    if exists (
      select 1
      from public.assessment_items existing_ai
      where existing_ai.assessment_document_id = saved.id
        and exists (
          select 1
          from jsonb_array_elements(p_items) as incoming_number(value)
          where incoming_number.value ->> 'itemNumber' = existing_ai.item_number::text
        )
        and not exists (
          select 1
          from jsonb_array_elements(p_items) as incoming_value(value)
          where incoming_value.value ->> 'itemNumber' = existing_ai.item_number::text
            and incoming_value.value ->> 'id' = existing_ai.id::text
        )
    ) then
      raise exception 'Existing assessment item UUIDs are stable and cannot change on draft save';
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
      raise exception 'Assessment assignment and source cannot change';
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
