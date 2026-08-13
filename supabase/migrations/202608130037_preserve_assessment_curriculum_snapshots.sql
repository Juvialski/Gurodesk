-- Preserve the curriculum meaning captured by finalized TOS and assessment
-- snapshots when a verified curriculum record is corrected later. Finalized
-- TOS rows are immutable and were checked against the live curriculum at their
-- own finalization boundary; assessment saves must not reinterpret them using
-- today's mutable canonical wording or provenance.

create or replace function public.assessment_canonical_tos_snapshot(p_source_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_content jsonb;
  source_row public.documents%rowtype;
  row_value jsonb;
  row_position integer;
  tos_row public.tos_competencies%rowtype;
  relational_row_count integer;
  academic_period_id text;
  curriculum_period_id text;
  canonical_rows jsonb := '[]'::jsonb;
begin
  select * into source_row
  from public.documents
  where id = p_source_document_id
    and document_type = 'tos'
    and status in ('final', 'archived');

  if source_row.id is null then
    raise exception 'Finalized TOS source not found';
  end if;

  source_content := source_row.structured_content;
  if jsonb_typeof(source_content) is distinct from 'object'
     or jsonb_typeof(source_content -> 'rows') is distinct from 'array' then
    raise exception 'Finalized TOS source has no structured row projection';
  end if;

  select count(*) into relational_row_count
  from public.tos_competencies
  where document_id = source_row.id;

  if relational_row_count <> jsonb_array_length(source_content -> 'rows') then
    raise exception 'Finalized TOS relational row projection is incomplete';
  end if;

  for row_value, row_position in
    select value, ordinality::integer
    from jsonb_array_elements(source_content -> 'rows') with ordinality
  loop
    if (row_value ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Finalized TOS row IDs must be stable UUIDs';
    end if;

    select * into tos_row
    from public.tos_competencies
    where document_id = source_row.id
      and row_id = (row_value ->> 'id')::uuid;

    if tos_row.document_id is null
       or tos_row.row_order is distinct from row_position
       or row_value #>> '{competency,text}' is distinct from tos_row.competency_text_snapshot
       or row_value #>> '{competency,code}' is distinct from tos_row.competency_code_snapshot
       or row_value #>> '{competency,sourcePage}' is distinct from tos_row.source_page_snapshot::text
       or row_value #>> '{competency,curriculumPeriodLabel}' is distinct from tos_row.curriculum_period_label_snapshot
       or row_value -> 'cognitiveAllocations' is distinct from tos_row.cognitive_allocations
       or row_value ->> 'itemCount' is distinct from tos_row.item_count::text
       or row_value ->> 'itemStart' is distinct from tos_row.item_start::text
       or row_value ->> 'itemEnd' is distinct from tos_row.item_end::text then
      raise exception 'Finalized TOS structured and relational snapshots do not match';
    end if;

    -- Phase 4 TOS rows historically persisted academicPeriodId, while the
    -- assessment contract exposes both equivalent period-ID field names.
    -- Derive either alias only from the frozen row, never from today's live
    -- curriculum record.
    academic_period_id := coalesce(
      row_value #>> '{competency,academicPeriodId}',
      row_value #>> '{competency,curriculumPeriodId}'
    );
    curriculum_period_id := coalesce(
      row_value #>> '{competency,curriculumPeriodId}',
      row_value #>> '{competency,academicPeriodId}'
    );

    canonical_rows := canonical_rows || jsonb_build_array(
      row_value || jsonb_build_object(
        'competency', jsonb_build_object(
          'id', tos_row.competency_id,
          'code', tos_row.competency_code_snapshot,
          'text', tos_row.competency_text_snapshot,
          'sourcePage', tos_row.source_page_snapshot,
          'sourceTitle', row_value #>> '{competency,sourceTitle}',
          'sourceUrl', row_value #>> '{competency,sourceUrl}',
          'academicPeriodId', academic_period_id,
          'curriculumPeriodId', curriculum_period_id,
          'curriculumPeriodLabel', tos_row.curriculum_period_label_snapshot,
          'verificationStatus', 'verified'
        )
      )
    );
  end loop;

  return jsonb_set(source_content, '{rows}', canonical_rows, true);
end;
$$;

revoke all on function public.assessment_canonical_tos_snapshot(uuid) from public;

create or replace function public.guard_assessment_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  document_row public.documents%rowtype;
  assignment_user uuid;
  source_row public.documents%rowtype;
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
     or new.source_tos_document_id is distinct from old.source_tos_document_id
     or new.source_tos_version_number is distinct from old.source_tos_version_number
     or new.source_tos_content_snapshot is distinct from old.source_tos_content_snapshot
     or new.source_tos_raw_content_snapshot is distinct from old.source_tos_raw_content_snapshot
     or new.total_items is distinct from old.total_items then
    raise exception 'Assessment source, assignment, and immutable snapshots cannot change';
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
  source_row public.documents%rowtype;
  source_tos_row public.tos_competencies%rowtype;
  source_snapshot_row jsonb;
  category jsonb;
  category_short_label text;
  is_v2 boolean := false;
  plan_entry jsonb;
begin
  select * into assessment_row
  from public.assessment_documents
  where document_id = new.assessment_document_id;

  if assessment_row.document_id is null then
    raise exception 'Assessment item must belong to an assessment document';
  end if;

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
