-- GuroDesk migration 043: make assessment source/mapping guards mode-aware.
--
-- Migration 037 installed strict TOS-only triggers for assessment metadata and
-- item mappings. Migration 041 later added lesson quizzes, unit quizzes, and
-- performance tasks, where a finalized TOS is intentionally not always the
-- source. The old triggers remained active and therefore rejected valid
-- non-TOS assessments before the multi-mode save RPC could complete.
--
-- This migration keeps the original finalized-TOS protections intact for
-- standard assessments and adds equivalent provenance checks for lesson-based
-- modes. It is additive and safe for databases where migrations 037/041/042
-- have already been recorded.

create or replace function public.guard_assessment_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  document_row public.documents%rowtype;
  assignment_user uuid;
  source_row public.documents%rowtype;
  lesson_row public.documents%rowtype;
  source_lessons jsonb;
  source_lesson jsonb;
  source_lesson_id uuid;
  source_index integer;
  req_mode text := coalesce(nullif(new.mode, ''), 'standard');
  req_source_type text := coalesce(nullif(new.source_type, ''), 'tos');
  duplicate_rpc boolean := coalesce(current_setting('app.assessment_duplicate_rpc', true), '') = '1';
begin
  select * into document_row
  from public.documents
  where id = new.document_id;

  if document_row.id is null
     or document_row.document_type <> 'assessment'
     or document_row.user_id is distinct from new.user_id
     or document_row.assignment_id is distinct from new.assignment_id then
    raise exception 'Assessment metadata must match its assessment document';
  end if;

  select ta.user_id into assignment_user
  from public.teacher_assignments ta
  where ta.id = new.assignment_id;

  if assignment_user is distinct from new.user_id then
    raise exception 'Assessment assignment must belong to the assessment owner';
  end if;

  if req_mode not in ('standard', 'lesson_quiz', 'unit_quiz', 'performance_task') then
    raise exception 'Assessment mode is invalid';
  end if;

  if req_mode = 'standard' then
    if req_source_type <> 'tos' then
      raise exception 'Standard assessments require a TOS source';
    end if;

    select * into source_row
    from public.documents
    where id = new.source_tos_document_id;

    if source_row.id is null
       or source_row.document_type <> 'tos'
       or source_row.user_id is distinct from new.user_id
       or source_row.assignment_id is distinct from new.assignment_id
       or (tg_op = 'INSERT' and not duplicate_rpc and source_row.status <> 'final')
       or (tg_op = 'INSERT' and duplicate_rpc and source_row.status not in ('final', 'archived'))
       or (tg_op = 'UPDATE' and source_row.status not in ('final', 'archived')) then
      raise exception 'Assessment source must be the owner''s finalized TOS snapshot';
    end if;

    if tg_op = 'INSERT' then
      if source_row.structured_content is distinct from new.source_tos_raw_content_snapshot
         or public.assessment_canonical_tos_snapshot(source_row.id) is distinct from new.source_tos_content_snapshot then
        raise exception 'Assessment source must be the owner''s finalized TOS snapshot';
      end if;
    elsif new.user_id is distinct from old.user_id
       or new.assignment_id is distinct from old.assignment_id
       or new.mode is distinct from old.mode
       or new.source_type is distinct from old.source_type
       or new.source_tos_document_id is distinct from old.source_tos_document_id
       or new.source_tos_version_number is distinct from old.source_tos_version_number
       or new.source_tos_content_snapshot is distinct from old.source_tos_content_snapshot
       or new.source_tos_raw_content_snapshot is distinct from old.source_tos_raw_content_snapshot
       or new.source_lesson_document_id is distinct from old.source_lesson_document_id
       or new.total_items is distinct from old.total_items then
      raise exception 'Assessment source, assignment, and immutable snapshots cannot change';
    end if;

    return new;
  end if;

  -- Non-standard modes intentionally do not use a TOS snapshot unless a
  -- performance task explicitly uses a TOS as its provenance source.
  if req_mode = 'lesson_quiz' then
    if req_source_type <> 'lesson_plan' then
      raise exception 'Lesson quizzes require a lesson-plan source';
    end if;
    if new.source_tos_document_id is not null or new.source_tos_version_number is not null then
      raise exception 'Lesson quizzes cannot carry a TOS source identifier';
    end if;

    source_lesson := document_row.structured_content -> 'sourceLesson';
    if source_lesson is null or jsonb_typeof(source_lesson) is distinct from 'object'
       or coalesce(source_lesson ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Lesson quiz requires a valid frozen lesson-plan source';
    end if;

    source_lesson_id := (source_lesson ->> 'id')::uuid;
    if new.source_lesson_document_id is null
       or new.source_lesson_document_id is distinct from source_lesson_id then
      raise exception 'Lesson quiz source metadata does not match its frozen lesson snapshot';
    end if;

    select * into lesson_row
    from public.documents d
    where d.id = source_lesson_id;

    if lesson_row.id is null
       or lesson_row.document_type <> 'lesson_plan'
       or lesson_row.user_id is distinct from new.user_id
       or (lesson_row.assignment_id is not null and lesson_row.assignment_id is distinct from new.assignment_id) then
      raise exception 'Lesson quiz source must be an owner-held lesson plan for the selected teaching assignment';
    end if;

  elsif req_mode = 'unit_quiz' then
    if req_source_type <> 'multi_lesson_plan' then
      raise exception 'Unit quizzes require multiple lesson-plan sources';
    end if;
    if new.source_tos_document_id is not null
       or new.source_tos_version_number is not null
       or new.source_lesson_document_id is not null then
      raise exception 'Unit quizzes cannot carry a single TOS or lesson source identifier';
    end if;

    source_lessons := document_row.structured_content -> 'sourceLessons';
    if source_lessons is null
       or jsonb_typeof(source_lessons) is distinct from 'array'
       or jsonb_array_length(source_lessons) < 2 then
      raise exception 'Unit quiz requires at least two frozen lesson-plan sources';
    end if;

    for source_index in 0..jsonb_array_length(source_lessons) - 1 loop
      if coalesce((source_lessons -> source_index) ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Unit quiz contains an invalid frozen lesson-plan source';
      end if;

      source_lesson_id := ((source_lessons -> source_index) ->> 'id')::uuid;
      select * into lesson_row
      from public.documents d
      where d.id = source_lesson_id;

      if lesson_row.id is null
         or lesson_row.document_type <> 'lesson_plan'
         or lesson_row.user_id is distinct from new.user_id
         or (lesson_row.assignment_id is not null and lesson_row.assignment_id is distinct from new.assignment_id) then
        raise exception 'Unit quiz sources must be owner-held lesson plans for the selected teaching assignment';
      end if;
    end loop;

    if (
      select count(distinct value ->> 'id')
      from jsonb_array_elements(source_lessons)
    ) <> jsonb_array_length(source_lessons) then
      raise exception 'Unit quiz source lesson IDs must be unique';
    end if;

  elsif req_mode = 'performance_task' then
    if req_source_type = 'lesson_plan' then
      source_lesson := document_row.structured_content -> 'sourceLesson';
      if source_lesson is null or jsonb_typeof(source_lesson) is distinct from 'object'
         or coalesce(source_lesson ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Performance task requires a valid frozen lesson-plan source';
      end if;

      source_lesson_id := (source_lesson ->> 'id')::uuid;
      select * into lesson_row
      from public.documents d
      where d.id = source_lesson_id;

      if lesson_row.id is null
         or lesson_row.document_type <> 'lesson_plan'
         or lesson_row.user_id is distinct from new.user_id
         or (lesson_row.assignment_id is not null and lesson_row.assignment_id is distinct from new.assignment_id) then
        raise exception 'Performance-task lesson source must belong to the assessment owner and selected assignment';
      end if;

      if new.source_tos_document_id is not null or new.source_tos_version_number is not null then
        raise exception 'Lesson-based performance tasks cannot carry a TOS source identifier';
      end if;

    elsif req_source_type = 'multi_lesson_plan' then
      source_lessons := document_row.structured_content -> 'sourceLessons';
      if source_lessons is null
         or jsonb_typeof(source_lessons) is distinct from 'array'
         or jsonb_array_length(source_lessons) < 1 then
        raise exception 'Performance task requires frozen lesson-plan sources';
      end if;

      for source_index in 0..jsonb_array_length(source_lessons) - 1 loop
        if coalesce((source_lessons -> source_index) ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          raise exception 'Performance task contains an invalid frozen lesson-plan source';
        end if;
        source_lesson_id := ((source_lessons -> source_index) ->> 'id')::uuid;
        select * into lesson_row
        from public.documents d
        where d.id = source_lesson_id;
        if lesson_row.id is null
           or lesson_row.document_type <> 'lesson_plan'
           or lesson_row.user_id is distinct from new.user_id
           or (lesson_row.assignment_id is not null and lesson_row.assignment_id is distinct from new.assignment_id) then
          raise exception 'Performance-task lesson sources must belong to the assessment owner and selected assignment';
        end if;
      end loop;

      if new.source_tos_document_id is not null or new.source_tos_version_number is not null then
        raise exception 'Lesson-based performance tasks cannot carry a TOS source identifier';
      end if;

    elsif req_source_type = 'tos' then
      select * into source_row
      from public.documents d
      where d.id = new.source_tos_document_id;

      if source_row.id is null
         or source_row.document_type <> 'tos'
         or source_row.user_id is distinct from new.user_id
         or source_row.assignment_id is distinct from new.assignment_id
         or source_row.status not in ('final', 'archived') then
        raise exception 'Performance-task TOS source must be the owner''s finalized TOS';
      end if;

      if document_row.structured_content #>> '{sourceTos,id}' is distinct from source_row.id::text then
        raise exception 'Performance-task TOS metadata does not match its frozen source snapshot';
      end if;
    else
      raise exception 'Performance task source type is invalid';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.assignment_id is distinct from old.assignment_id
    or new.mode is distinct from old.mode
    or new.source_type is distinct from old.source_type
    or new.source_tos_document_id is distinct from old.source_tos_document_id
    or new.source_tos_version_number is distinct from old.source_tos_version_number
    or new.source_lesson_document_id is distinct from old.source_lesson_document_id
  ) then
    raise exception 'Assessment source identity, mode, and assignment cannot change';
  end if;

  return new;
end;
$$;

create or replace function public.guard_assessment_item_mapping()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessment_row public.assessment_documents%rowtype;
  assessment_document public.documents%rowtype;
  source_row public.documents%rowtype;
  source_tos_row public.tos_competencies%rowtype;
  source_snapshot_row jsonb;
  category jsonb;
  category_short_label text;
  is_v2 boolean := false;
  plan_entry jsonb;
  coverage_entry jsonb;
  source_lesson jsonb;
  source_lessons jsonb;
  mode_value text;
begin
  select * into assessment_row
  from public.assessment_documents
  where document_id = new.assessment_document_id;

  if assessment_row.document_id is null then
    raise exception 'Assessment item must belong to an assessment document';
  end if;

  select * into assessment_document
  from public.documents d
  where d.id = assessment_row.document_id;

  if assessment_document.id is null
     or assessment_document.document_type <> 'assessment'
     or assessment_document.user_id is distinct from assessment_row.user_id
     or assessment_document.assignment_id is distinct from assessment_row.assignment_id then
    raise exception 'Assessment item parent metadata is invalid';
  end if;

  mode_value := coalesce(nullif(assessment_row.mode, ''), 'standard');

  if mode_value in ('lesson_quiz', 'unit_quiz') then
    if coalesce(btrim(new.coverage_entry_id), '') = '' or new.source_lesson_id is null then
      raise exception 'Lesson-based assessment items require frozen coverage provenance';
    end if;

    if new.tos_row_id is not null then
      raise exception 'Lesson-based assessment items cannot use a TOS row mapping';
    end if;

    if jsonb_typeof(assessment_document.structured_content -> 'coveragePlan' -> 'entries') is distinct from 'array' then
      raise exception 'Lesson-based assessment has no frozen coverage plan';
    end if;

    select value into coverage_entry
    from jsonb_array_elements(assessment_document.structured_content -> 'coveragePlan' -> 'entries')
    where value ->> 'id' = new.coverage_entry_id
    limit 1;

    if coverage_entry is null
       or coverage_entry ->> 'sourceLessonId' is distinct from new.source_lesson_id::text
       or coverage_entry ->> 'cognitiveCategoryId' is distinct from new.cognitive_category_id
       or coverage_entry ->> 'cognitiveCategoryLabel' is distinct from new.cognitive_category_label_snapshot
       or coverage_entry ->> 'competencyStatement' is distinct from new.competency_text_snapshot
       or coverage_entry ->> 'competencyCode' is distinct from new.competency_code_snapshot
       or not exists (
         select 1
         from jsonb_array_elements_text(coalesce(coverage_entry -> 'allocatedItemNumbers', '[]'::jsonb)) as allocated(value)
         where allocated.value::integer = new.item_number
       ) then
      raise exception 'Assessment item mapping is outside the frozen lesson coverage plan';
    end if;

    if new.canonical_competency_id is not null
       and coverage_entry ->> 'competencyId' is distinct from new.canonical_competency_id::text then
      raise exception 'Assessment item competency does not match the frozen lesson coverage plan';
    end if;

    if new.allocation_item_start is distinct from new.item_number
       or new.allocation_item_end is distinct from new.item_number
       or new.allocation_index is distinct from 0 then
      raise exception 'Lesson-based assessment item allocation metadata is invalid';
    end if;

    select * into source_row
    from public.documents d
    where d.id = new.source_lesson_id;

    if source_row.id is null
       or source_row.document_type <> 'lesson_plan'
       or source_row.user_id is distinct from assessment_row.user_id
       or (source_row.assignment_id is not null and source_row.assignment_id is distinct from assessment_row.assignment_id) then
      raise exception 'Assessment item lesson source is not valid for the assessment owner and assignment';
    end if;

    if mode_value = 'lesson_quiz' then
      source_lesson := assessment_document.structured_content -> 'sourceLesson';
      if source_lesson is null
         or source_lesson ->> 'id' is distinct from new.source_lesson_id::text then
        raise exception 'Assessment item lesson source is outside the frozen lesson snapshot';
      end if;
    else
      source_lessons := assessment_document.structured_content -> 'sourceLessons';
      if jsonb_typeof(source_lessons) is distinct from 'array'
         or not exists (
           select 1
           from jsonb_array_elements(source_lessons) as lesson(value)
           where lesson.value ->> 'id' = new.source_lesson_id::text
         ) then
        raise exception 'Assessment item lesson source is outside the frozen unit-quiz sources';
      end if;
    end if;

    if new.point_start is not null or new.point_end is not null or new.plan_entry_id is not null then
      raise exception 'Lesson-based assessment items cannot acquire TOS V2 point-range metadata';
    end if;

    if tg_op = 'UPDATE' and (
      new.id is distinct from old.id
      or new.assessment_document_id is distinct from old.assessment_document_id
      or new.item_number is distinct from old.item_number
      or new.canonical_competency_id is distinct from old.canonical_competency_id
      or new.competency_code_snapshot is distinct from old.competency_code_snapshot
      or new.competency_text_snapshot is distinct from old.competency_text_snapshot
      or new.competency_source_page_snapshot is distinct from old.competency_source_page_snapshot
      or new.competency_academic_period_id_snapshot is distinct from old.competency_academic_period_id_snapshot
      or new.competency_curriculum_period_id_snapshot is distinct from old.competency_curriculum_period_id_snapshot
      or new.competency_period_label_snapshot is distinct from old.competency_period_label_snapshot
      or new.tos_row_id is distinct from old.tos_row_id
      or new.allocation_item_start is distinct from old.allocation_item_start
      or new.allocation_item_end is distinct from old.allocation_item_end
      or new.allocation_index is distinct from old.allocation_index
      or new.cognitive_category_id is distinct from old.cognitive_category_id
      or new.cognitive_category_label_snapshot is distinct from old.cognitive_category_label_snapshot
      or new.cognitive_category_short_label_snapshot is distinct from old.cognitive_category_short_label_snapshot
      or new.coverage_entry_id is distinct from old.coverage_entry_id
      or new.source_lesson_id is distinct from old.source_lesson_id
      or new.point_start is distinct from old.point_start
      or new.point_end is distinct from old.point_end
      or new.plan_entry_id is distinct from old.plan_entry_id
    ) then
      raise exception 'Assessment item identity and frozen lesson coverage mappings are immutable';
    end if;

    return new;
  end if;

  if mode_value <> 'standard' then
    raise exception 'Only standard, lesson-quiz, and unit-quiz assessments may contain question items';
  end if;

  -- Standard TOS assessment path: preserve the mature migration-037 contract.
  is_v2 := assessment_row.settings ->> 'generationVersion' = 'v2'
    and assessment_row.settings ->> 'numberingMode' = 'point_ranges'
    and coalesce((assessment_row.settings ->> 'schemaVersion')::integer, 0) >= 2;

  select * into source_row
  from public.documents
  where id = assessment_row.source_tos_document_id;

  if source_row.id is null
     or source_row.document_type <> 'tos'
     or source_row.status not in ('final', 'archived')
     or source_row.structured_content is distinct from assessment_row.source_tos_raw_content_snapshot then
    raise exception 'Assessment items require the assessment''s frozen finalized TOS source';
  end if;

  if jsonb_typeof(assessment_row.source_tos_content_snapshot -> 'rows') is distinct from 'array' then
    raise exception 'Assessment source snapshot has no structured row projection';
  end if;

  select value into source_snapshot_row
  from jsonb_array_elements(assessment_row.source_tos_content_snapshot -> 'rows')
  where value ->> 'id' = new.tos_row_id::text
  limit 1;

  if is_v2 then
    select * into source_tos_row
    from public.tos_competencies
    where document_id = assessment_row.source_tos_document_id
      and row_id = new.tos_row_id
      and competency_id = new.canonical_competency_id;
  else
    select * into source_tos_row
    from public.tos_competencies
    where document_id = assessment_row.source_tos_document_id
      and row_id = new.tos_row_id
      and competency_id = new.canonical_competency_id
      and new.item_number between item_start and item_end;
  end if;

  if source_tos_row.document_id is null or source_snapshot_row is null then
    raise exception 'Assessment item competency mapping is outside the frozen finalized TOS';
  end if;

  if source_snapshot_row #>> '{competency,id}' is distinct from new.canonical_competency_id::text
     or source_snapshot_row #>> '{competency,code}' is distinct from new.competency_code_snapshot
     or source_snapshot_row #>> '{competency,text}' is distinct from new.competency_text_snapshot
     or source_snapshot_row #>> '{competency,sourcePage}' is distinct from new.competency_source_page_snapshot::text
     or source_snapshot_row #>> '{competency,academicPeriodId}' is distinct from new.competency_academic_period_id_snapshot
     or source_snapshot_row #>> '{competency,curriculumPeriodId}' is distinct from new.competency_curriculum_period_id_snapshot
     or source_snapshot_row #>> '{competency,curriculumPeriodLabel}' is distinct from new.competency_period_label_snapshot
     or source_snapshot_row #>> '{competency,code}' is distinct from source_tos_row.competency_code_snapshot
     or source_snapshot_row #>> '{competency,text}' is distinct from source_tos_row.competency_text_snapshot
     or source_snapshot_row #>> '{competency,sourcePage}' is distinct from source_tos_row.source_page_snapshot::text
     or source_snapshot_row #>> '{competency,curriculumPeriodLabel}' is distinct from source_tos_row.curriculum_period_label_snapshot
     or source_snapshot_row -> 'cognitiveAllocations' is distinct from source_tos_row.cognitive_allocations then
    raise exception 'Assessment competency snapshots must match the frozen finalized TOS row';
  end if;

  select value into category
  from jsonb_array_elements(source_snapshot_row -> 'cognitiveAllocations')
  where value ->> 'categoryId' = new.cognitive_category_id
    and (is_v2 or new.item_number between (value ->> 'itemStart')::integer and (value ->> 'itemEnd')::integer)
  limit 1;

  select category_value ->> 'shortLabel' into category_short_label
  from jsonb_array_elements(assessment_row.source_tos_content_snapshot -> 'cognitiveCategories') category_value
  where category_value ->> 'id' = new.cognitive_category_id
  limit 1;

  if category is null
     or category ->> 'label' is distinct from new.cognitive_category_label_snapshot
     or category ->> 'shortLabel' is distinct from new.cognitive_category_short_label_snapshot
     or category_short_label is distinct from new.cognitive_category_short_label_snapshot
     or category ->> 'itemStart' is distinct from new.allocation_item_start::text
     or category ->> 'itemEnd' is distinct from new.allocation_item_end::text
     or (not is_v2 and new.allocation_index <> new.item_number - new.allocation_item_start)
     or (is_v2 and (new.allocation_index < 0
         or new.allocation_index >= greatest(1, (category ->> 'itemCount')::integer))) then
    raise exception 'Assessment item cognitive mapping is outside the frozen finalized TOS allocation';
  end if;

  if is_v2 then
    if new.point_start is null
       or new.point_end is null
       or coalesce(btrim(new.plan_entry_id), '') = '' then
      raise exception 'V2 assessment items require immutable point ranges and a master-plan entry ID';
    end if;

    select value into plan_entry
    from jsonb_array_elements(coalesce(assessment_row.settings -> 'masterPlan' -> 'entries', '[]'::jsonb))
    where (value ->> 'itemNumber')::integer = new.item_number
    limit 1;

    if plan_entry is null
       or plan_entry ->> 'id' is distinct from new.plan_entry_id
       or (plan_entry ->> 'pointStart')::integer is distinct from new.point_start
       or (plan_entry ->> 'pointEnd')::integer is distinct from new.point_end
       or plan_entry ->> 'rowId' is distinct from new.tos_row_id::text
       or plan_entry ->> 'competencyId' is distinct from new.canonical_competency_id::text
       or plan_entry ->> 'cognitiveCategoryId' is distinct from new.cognitive_category_id
       or plan_entry ->> 'questionType' is distinct from new.question_type::text then
      raise exception 'V2 assessment item does not match its frozen master-plan entry';
    end if;
  elsif new.point_start is not null
     or new.point_end is not null
     or new.plan_entry_id is not null then
    raise exception 'Legacy assessment items cannot acquire V2 point-range metadata';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.assessment_document_id is distinct from old.assessment_document_id
    or new.item_number is distinct from old.item_number
    or new.canonical_competency_id is distinct from old.canonical_competency_id
    or new.competency_code_snapshot is distinct from old.competency_code_snapshot
    or new.competency_text_snapshot is distinct from old.competency_text_snapshot
    or new.competency_source_page_snapshot is distinct from old.competency_source_page_snapshot
    or new.competency_academic_period_id_snapshot is distinct from old.competency_academic_period_id_snapshot
    or new.competency_curriculum_period_id_snapshot is distinct from old.competency_curriculum_period_id_snapshot
    or new.competency_period_label_snapshot is distinct from old.competency_period_label_snapshot
    or new.tos_row_id is distinct from old.tos_row_id
    or new.allocation_item_start is distinct from old.allocation_item_start
    or new.allocation_item_end is distinct from old.allocation_item_end
    or new.allocation_index is distinct from old.allocation_index
    or new.cognitive_category_id is distinct from old.cognitive_category_id
    or new.cognitive_category_label_snapshot is distinct from old.cognitive_category_label_snapshot
    or new.cognitive_category_short_label_snapshot is distinct from old.cognitive_category_short_label_snapshot
    or new.point_start is distinct from old.point_start
    or new.point_end is distinct from old.point_end
    or new.plan_entry_id is distinct from old.plan_entry_id
  ) then
    raise exception 'Assessment item identity, point range, and curriculum mappings are immutable';
  end if;

  return new;
end;
$$;
