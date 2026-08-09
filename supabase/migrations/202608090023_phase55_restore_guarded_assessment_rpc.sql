-- Phase 5.5 corrective migration 023.
--
-- Migration 022 tightened mapping/result guards but accidentally replaced the
-- mature Phase 4.4/5.4 assessment save RPC with a simplified implementation.
-- This migration restores the guarded migration-020 implementation and adds
-- explicit server-side immutable blueprint validation without weakening RLS,
-- stable item IDs, locking, TOS snapshots, scoring, or finalization checks.

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
    if p_assignment_id is distinct from assessment_row.assignment_id
       or p_source_tos_document_id is distinct from assessment_row.source_tos_document_id then
      raise exception 'Assessment assignment and source cannot change';
    end if;
    if item_count <> assessment_row.total_items then
      raise exception 'Assessment items must preserve the source TOS total';
    end if;
    if (select count(distinct elem.value ->> 'id') from jsonb_array_elements(p_items) as elem(value)) <> item_count then
      raise exception 'Assessment item UUIDs must be unique within a saved assessment';
    end if;

    -- Existing assessments already have an authoritative persisted blueprint.
    -- Reject any client attempt to alter immutable mapping fields, even when
    -- the client also tampers with its snapshot fields consistently.
    if exists (
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

    for existing_item in
      select ai.*
      from public.assessment_items ai
      where ai.assessment_document_id = saved.id and ai.locked
      for update
    loop
      select elem.value into incoming_item
      from jsonb_array_elements(p_items) as elem(value)
      where elem.value ->> 'id' = existing_item.id::text
      limit 1;
      if incoming_item is null then
        raise exception 'Locked assessment item is missing from the save payload';
      end if;
      if coalesce((incoming_item ->> 'locked')::boolean, true)
         and (coalesce(incoming_item ->> 'prompt', '') is distinct from existing_item.prompt
           or coalesce(incoming_item -> 'answer', '{}'::jsonb) is distinct from existing_item.answer
           or coalesce(nullif(incoming_item ->> 'questionType', ''), 'multiple_choice') is distinct from existing_item.question_type::text
           or coalesce(nullif(incoming_item ->> 'pointsPossible', '')::numeric,
                       nullif(incoming_item ->> 'points', '')::numeric, 1) is distinct from existing_item.points_possible
           or coalesce(incoming_item ->> 'rationale', '') is distinct from existing_item.rationale
           or coalesce(incoming_item ->> 'teacherNotes', '') is distinct from existing_item.teacher_notes) then
        raise exception 'Locked assessment item cannot be changed until explicitly unlocked';
      end if;
    end loop;

    if exists (
      select 1
      from public.assessment_items existing_ai
      where existing_ai.assessment_document_id = saved.id
        and not exists (
          select 1
          from jsonb_array_elements(p_items) as incoming_value(value)
          where incoming_value.value ->> 'itemNumber' = existing_ai.item_number::text
            and incoming_value.value ->> 'id' = existing_ai.id::text
        )
    ) then
      raise exception 'Existing assessment item UUIDs are stable and cannot change on draft save';
    end if;

    source_total_items := assessment_row.total_items;
    source_max_version := assessment_row.source_tos_version_number;

    update public.documents d set
      title = coalesce(nullif(btrim(p_title), ''), d.title),
      school_year = assessment_row.source_tos_content_snapshot ->> 'schoolYear',
      academic_period_label = nullif(assessment_row.source_tos_content_snapshot ->> 'gradingTermLabel', ''),
      status = 'draft',
      structured_content = coalesce(p_structured_content, '{}'::jsonb)
    where d.id = saved.id
    returning * into saved;

    update public.assessment_documents ad set
      instructions = coalesce(p_instructions, ad.instructions),
      settings = case
        when jsonb_typeof(p_structured_content -> 'settings') = 'object'
          then p_structured_content -> 'settings'
        else ad.settings
      end
    where ad.document_id = saved.id
    returning * into assessment_row;

    delete from public.assessment_items ai
    where ai.assessment_document_id = saved.id;
  else
    select * into source_row
    from public.documents d
    where d.id = p_source_tos_document_id
    for share;
    if source_row.id is null
       or source_row.user_id is distinct from owner_id
       or source_row.document_type <> 'tos'
       or (source_row.status <> 'final'
           and coalesce(current_setting('app.assessment_duplicate_rpc', true), '') <> '1')
       or source_row.assignment_id is distinct from p_assignment_id then
      raise exception 'A finalized teacher-owned TOS for the same assignment is required';
    end if;

    select coalesce(max(dv.version_number), 0) into source_max_version
    from public.document_versions dv
    where dv.document_id = source_row.id;
    if source_max_version <= 0 then
      raise exception 'The finalized TOS has no immutable version snapshot';
    end if;

    source_total_items := (source_row.structured_content ->> 'totalItems')::integer;
    if source_total_items is null or source_total_items < 1 or source_total_items > 10000 then
      raise exception 'The finalized TOS has no supported total item count';
    end if;
    if item_count <> source_total_items then
      raise exception 'Assessment items must exactly match the finalized TOS total';
    end if;

    source_canonical_content := public.assessment_canonical_tos_snapshot(source_row.id);

    insert into public.documents (
      user_id, assignment_id, document_type, title, school_year,
      academic_period_label, status, structured_content
    ) values (
      owner_id,
      p_assignment_id,
      'assessment',
      coalesce(nullif(btrim(p_title), ''), 'Untitled assessment'),
      source_canonical_content ->> 'schoolYear',
      nullif(source_canonical_content ->> 'gradingTermLabel', ''),
      'draft',
      coalesce(p_structured_content, '{}'::jsonb)
    ) returning * into saved;

    insert into public.assessment_documents (
      document_id, user_id, assignment_id, source_tos_document_id,
      source_tos_version_number, source_tos_content_snapshot,
      source_tos_raw_content_snapshot, total_items, instructions, settings
    ) values (
      saved.id,
      owner_id,
      p_assignment_id,
      source_row.id,
      source_max_version,
      source_canonical_content,
      source_row.structured_content,
      source_total_items,
      coalesce(p_instructions, ''),
      case when jsonb_typeof(p_structured_content -> 'settings') = 'object'
        then p_structured_content -> 'settings'
        else '{}'::jsonb
      end
    ) returning * into assessment_row;
  end if;

  for item_value in select elem.value from jsonb_array_elements(p_items) as elem(value) loop
    if jsonb_typeof(item_value) is distinct from 'object' then
      raise exception 'Assessment item must be an object';
    end if;

    item_number := (item_value ->> 'itemNumber')::integer;
    if item_number is null or item_number <> expected_number then
      raise exception 'Assessment item numbers must be exactly contiguous from 1';
    end if;
    expected_number := expected_number + 1;

    item_id := (item_value ->> 'id')::uuid;
    if item_id is null then raise exception 'Assessment item IDs must be stable UUIDs'; end if;

    item_competency_id := (item_value -> 'competencySnapshot' ->> 'id')::uuid;
    item_tos_row_id := (item_value -> 'mapping' ->> 'rowId')::uuid;
    item_cognitive_category_id := item_value -> 'cognitiveCategorySnapshot' ->> 'id';
    item_cognitive_category_label := item_value -> 'cognitiveCategorySnapshot' ->> 'label';
    item_cognitive_category_short_label := item_value -> 'cognitiveCategorySnapshot' ->> 'shortLabel';

    if item_competency_id is null
       or item_tos_row_id is null
       or coalesce(btrim(item_value -> 'competencySnapshot' ->> 'text'), '') = ''
       or coalesce(btrim(item_cognitive_category_id), '') = ''
       or coalesce(btrim(item_cognitive_category_label), '') = ''
       or coalesce(btrim(item_cognitive_category_short_label), '') = '' then
      raise exception 'Assessment item curriculum and cognitive snapshots are required';
    end if;

    -- Client mapping JSON must agree with its snapshots before either is
    -- compared with the authoritative finalized TOS rows below.
    if item_value -> 'mapping' ->> 'competencyId' is distinct from item_competency_id::text
       or item_value -> 'mapping' ->> 'cognitiveCategoryId' is distinct from item_cognitive_category_id
       or item_value -> 'mapping' ->> 'rowId' is distinct from item_tos_row_id::text then
      raise exception 'Assessment item mappings do not match the finalized TOS blueprint';
    end if;

    if (item_value ->> 'questionType') not in (
      'multiple_choice', 'true_false', 'short_answer', 'constructed_response',
      'identification', 'fill_in_the_blank', 'numerical_answer',
      'problem_solving', 'matching', 'multiple_select', 'essay'
    ) then
      raise exception 'Unsupported assessment question type';
    end if;
    item_question_type := (item_value ->> 'questionType')::public.assessment_question_type;

    if (item_value ->> 'authorshipState') not in (
      'empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual'
    ) then
      raise exception 'Unsupported assessment authorship state';
    end if;
    item_authorship := (item_value ->> 'authorshipState')::public.assessment_authorship_state;

    if jsonb_typeof(coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb)) is distinct from 'array'
       or jsonb_typeof(coalesce(item_value -> 'answer', '{}'::jsonb)) is distinct from 'object' then
      raise exception 'Assessment choices and answer must be JSON structures';
    end if;

    item_points := coalesce(
      nullif(item_value ->> 'pointsPossible', '')::numeric,
      nullif(item_value ->> 'points', '')::numeric,
      1
    );
    if item_points is null or item_points < 0 or item_points::text = 'NaN' then
      raise exception 'Assessment item points must be a finite nonnegative number';
    end if;

    if item_authorship = 'empty' and coalesce(btrim(item_value ->> 'prompt'), '') <> '' then
      raise exception 'Empty assessment items cannot contain a prompt';
    end if;

    if char_length(coalesce(item_value ->> 'prompt', '')) > 40000
       or octet_length(coalesce((item_value -> 'answer')::text, '')) > 256 * 1024
       or char_length(coalesce(item_value ->> 'rationale', '')) > 20000
       or char_length(coalesce(item_value ->> 'teacherNotes', '')) > 20000
       or octet_length(coalesce((item_value -> 'history')::text, '[]')) > 1024 * 1024 then
      raise exception 'Assessment item content exceeds the supported save limit';
    end if;

    if jsonb_typeof(item_value -> 'history') is not null
       and jsonb_typeof(item_value -> 'history') <> 'array' then
      raise exception 'Assessment item history must be an array';
    end if;
    if jsonb_array_length(coalesce(item_value -> 'history', '[]'::jsonb)) > 5 then
      raise exception 'Assessment item history is limited to five versions';
    end if;
    if item_value ->> 'qaState' is not null
       and item_value ->> 'qaState' not in (
         'empty', 'generated', 'verified', 'needs_review', 'teacher_edited',
         'answer_needs_recheck', 'locked', 'repair_needed'
       ) then
      raise exception 'Unsupported assessment QA state';
    end if;

    insert into public.assessment_items (
      id, assessment_document_id, item_number, canonical_competency_id,
      competency_code_snapshot, competency_text_snapshot,
      competency_source_page_snapshot, competency_academic_period_id_snapshot,
      competency_curriculum_period_id_snapshot, competency_period_label_snapshot,
      tos_row_id, allocation_item_start, allocation_item_end, allocation_index,
      cognitive_category_id, cognitive_category_label_snapshot,
      cognitive_category_short_label_snapshot, question_type, prompt, choices,
      answer, points, points_possible, rationale, teacher_notes, authorship_state,
      qa_state, locked, version_history
    ) values (
      item_id,
      saved.id,
      item_number,
      item_competency_id,
      nullif(item_value -> 'competencySnapshot' ->> 'code', ''),
      item_value -> 'competencySnapshot' ->> 'text',
      (item_value -> 'competencySnapshot' ->> 'sourcePage')::integer,
      item_value -> 'competencySnapshot' ->> 'academicPeriodId',
      item_value -> 'competencySnapshot' ->> 'curriculumPeriodId',
      coalesce(item_value -> 'competencySnapshot' ->> 'curriculumPeriodLabel', ''),
      item_tos_row_id,
      (item_value -> 'mapping' ->> 'allocationItemStart')::integer,
      (item_value -> 'mapping' ->> 'allocationItemEnd')::integer,
      (item_value -> 'mapping' ->> 'allocationIndex')::integer,
      item_cognitive_category_id,
      item_cognitive_category_label,
      item_cognitive_category_short_label,
      item_question_type,
      coalesce(item_value ->> 'prompt', ''),
      coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb),
      coalesce(item_value -> 'answer', '{}'::jsonb),
      item_points,
      item_points,
      coalesce(item_value ->> 'rationale', ''),
      coalesce(item_value ->> 'teacherNotes', ''),
      item_authorship,
      case
        when coalesce((item_value ->> 'locked')::boolean, false) then 'locked'
        else coalesce(nullif(item_value ->> 'qaState', ''), 'empty')
      end,
      coalesce((item_value ->> 'locked')::boolean, false),
      coalesce(item_value -> 'history', '[]'::jsonb)
    );
  end loop;

  if expected_number <> source_total_items + 1 then
    raise exception 'Assessment item numbering is incomplete';
  end if;

  -- Authoritative finalized-TOS verification. The relational TOS row and
  -- cognitive allocation must match every immutable assessment mapping field.
  select exists (
    select 1
    from public.assessment_items ai
    where ai.assessment_document_id = saved.id
      and not exists (
        select 1
        from public.tos_competencies tc
        where tc.document_id = assessment_row.source_tos_document_id
          and tc.row_id = ai.tos_row_id
          and tc.competency_id = ai.canonical_competency_id
          and ai.item_number between tc.item_start and tc.item_end
          and exists (
            select 1
            from jsonb_array_elements(tc.cognitive_allocations) as allocation(value)
            where allocation.value ->> 'categoryId' = ai.cognitive_category_id
              and allocation.value ->> 'label' = ai.cognitive_category_label_snapshot
              and allocation.value ->> 'shortLabel' = ai.cognitive_category_short_label_snapshot
              and ai.item_number between
                    (allocation.value ->> 'itemStart')::integer
                    and (allocation.value ->> 'itemEnd')::integer
              and ai.allocation_item_start = (allocation.value ->> 'itemStart')::integer
              and ai.allocation_item_end = (allocation.value ->> 'itemEnd')::integer
              and ai.allocation_index = ai.item_number - ai.allocation_item_start
          )
      )
  ) into bad;
  if bad then
    raise exception 'Assessment item mappings do not match the finalized TOS blueprint';
  end if;

  select count(*) into canonical_count
  from public.assessment_items ai
  where ai.assessment_document_id = saved.id;
  if canonical_count <> source_total_items then
    raise exception 'Assessment item total is not exact';
  end if;

  if p_status = 'final' then
    if saved.status <> 'draft' then
      raise exception 'Only draft assessments can be finalized';
    end if;
    if exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and ai.authorship_state in ('empty', 'ai_suggestion')
    ) then
      raise exception 'Final assessment requires every item to be teacher-accepted, edited, or manual';
    end if;
    if exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id and ai.points_possible <= 0
    ) then
      raise exception 'Final assessment requires positive points for every item';
    end if;

    select exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and not public.assessment_item_content_valid(
          ai.question_type, ai.prompt, ai.choices, ai.answer, ai.authorship_state
        )
    ) into bad;
    if bad then raise exception 'Final assessment contains invalid question content'; end if;

    select exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and not public.assessment_item_point_structure_valid(
          ai.question_type, ai.points_possible, ai.answer
        )
    ) into bad;
    if bad then
      raise exception 'Final assessment item point structure does not reconcile with pointsPossible';
    end if;

    if exists (
      select 1
      from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and jsonb_typeof(assessment_row.settings -> 'allowedTypes') = 'array'
        and not exists (
          select 1
          from jsonb_array_elements_text(assessment_row.settings -> 'allowedTypes') as allowed(value)
          where allowed.value = ai.question_type::text
        )
    ) then
      raise exception 'Final assessment uses a disabled question type';
    end if;

    select exists (
      select 1
      from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and public.assessment_item_mirror(ai) is distinct from
            (coalesce(p_structured_content, '{}'::jsonb) -> 'items' -> (ai.item_number - 1))
    ) into bad;
    if bad then
      raise exception 'Assessment JSON and relational item projections do not match';
    end if;
  end if;

  select coalesce(sum(ai.points_possible), 0) into total_points
  from public.assessment_items ai
  where ai.assessment_document_id = saved.id;

  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number), '[]'::jsonb)
    into mirror
  from public.assessment_items ai
  where ai.assessment_document_id = saved.id;

  source_content := assessment_row.source_tos_content_snapshot;
  settings_value := coalesce(assessment_row.settings, '{}'::jsonb);
  normalized_content := jsonb_build_object(
    'schemaVersion', 2,
    'title', saved.title,
    'assessmentTitle', saved.title,
    'instructions', assessment_row.instructions,
    'assignmentId', assessment_row.assignment_id,
    'gradeLevel', source_content -> 'gradeLevel',
    'learningArea', source_content -> 'learningArea',
    'schoolYear', source_content -> 'schoolYear',
    'gradingTermId', source_content -> 'gradingTermId',
    'gradingTermLabel', source_content -> 'gradingTermLabel',
    'curriculumVersionId', source_content -> 'curriculumVersionId',
    'curriculumVersionCode', source_content -> 'curriculumVersionCode',
    'curriculumVersionName', source_content -> 'curriculumVersionName',
    'curriculumSubjectId', source_content -> 'curriculumSubjectId',
    'curriculumPeriodIds', source_content -> 'curriculumPeriodIds',
    'curriculumPeriodLabels', source_content -> 'curriculumPeriodLabels',
    'totalItems', assessment_row.total_items,
    'totalPoints', total_points,
    'settings', settings_value,
    'sourceTos', jsonb_build_object(
      'id', assessment_row.source_tos_document_id,
      'versionNumber', assessment_row.source_tos_version_number,
      'title', source_content ->> 'title',
      'status', 'final',
      'assignmentId', assessment_row.assignment_id,
      'schoolYear', source_content ->> 'schoolYear',
      'academicPeriodLabel', source_content ->> 'gradingTermLabel',
      'content', source_content
    ),
    'sourceTosDocumentId', assessment_row.source_tos_document_id,
    'sourceTosVersionNumber', assessment_row.source_tos_version_number,
    'items', mirror
  );

  update public.documents d set
    status = p_status,
    structured_content = normalized_content
  where d.id = saved.id
  returning * into saved;

  select coalesce(max(dv.version_number), 0) + 1 into next_version
  from public.document_versions dv
  where dv.document_id = saved.id;

  insert into public.document_versions (
    document_id, version_number, structured_content, change_note
  ) values (
    saved.id,
    next_version,
    saved.structured_content,
    nullif(p_change_note, '')
  );

  return saved;
end;
$$;

revoke all on function public.save_assessment_document(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text
) from public;

grant execute on function public.save_assessment_document(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text
) to authenticated;
