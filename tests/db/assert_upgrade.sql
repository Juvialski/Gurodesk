-- Behavioral assertions for the 001-014 -> 015-current upgrade path.
\set ON_ERROR_STOP on

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('app.assessment_rpc', '1', false);

do $$
declare
  profile_row public.profiles%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  tos_row public.documents%rowtype;
  assessment_row public.documents%rowtype;
  assessment_item_row public.assessment_items%rowtype;
  tos_count integer;
  tos_version_count integer;
  assessment_version_count integer;
  enum_value text;
  enum_values text[] := array[
    'identification', 'fill_in_the_blank', 'numerical_answer',
    'problem_solving', 'matching', 'multiple_select', 'essay'
  ];
begin
  select * into profile_row from public.profiles
  where id = '11111111-1111-4111-8111-111111111111';
  if profile_row.id is null or profile_row.full_name <> 'Migration Harness Teacher'
     or profile_row.school_year <> '2026-2027' then
    raise exception 'Upgrade assertion: teacher profile was not preserved';
  end if;

  select * into assignment_row from public.teacher_assignments
  where id = '22222222-2222-4222-8222-222222222222';
  if assignment_row.id is null or assignment_row.user_id <> profile_row.id
     or assignment_row.learning_area <> 'Mathematics'
     or assignment_row.section_names <> array['7-Mabini'] then
    raise exception 'Upgrade assertion: assignment identity/data was not preserved';
  end if;

  select * into tos_row from public.documents
  where id = '33333333-3333-4333-8333-333333333333';
  if tos_row.id is null or tos_row.user_id <> profile_row.id
     or tos_row.assignment_id <> assignment_row.id
     or tos_row.document_type <> 'tos' or tos_row.status <> 'final'
     or tos_row.structured_content ->> 'title' <> 'Upgrade Fixture TOS' then
    raise exception 'Upgrade assertion: finalized TOS identity/data was not preserved';
  end if;
  select count(*) into tos_count from public.tos_competencies
  where document_id = tos_row.id and row_id = '44444444-4444-4444-8444-444444444444';
  if tos_count <> 1 then
    raise exception 'Upgrade assertion: finalized TOS relational row ID was not preserved';
  end if;
  select count(*) into tos_version_count from public.document_versions
  where document_id = tos_row.id and version_number = 1;
  if tos_version_count <> 1 then
    raise exception 'Upgrade assertion: finalized TOS version snapshot was not preserved';
  end if;

  select * into assessment_row from public.documents
  where id = '55555555-5555-4555-8555-555555555555';
  if assessment_row.id is null or assessment_row.user_id <> profile_row.id
     or assessment_row.assignment_id <> assignment_row.id
     or assessment_row.document_type <> 'assessment'
     or assessment_row.structured_content ->> 'title' <> 'Upgrade Fixture Assessment' then
    raise exception 'Upgrade assertion: assessment identity/data was not preserved';
  end if;

  select * into assessment_item_row from public.assessment_items
  where id = '66666666-6666-4666-8666-666666666666';
  if assessment_item_row.id is null or assessment_item_row.assessment_document_id <> assessment_row.id
     or assessment_item_row.item_number <> 1
     or assessment_item_row.points <> 1 then
    raise exception 'Upgrade assertion: assessment item identity/data was not preserved';
  end if;
  select count(*) into assessment_version_count from public.document_versions
  where document_id = assessment_row.id and version_number = 1;
  if assessment_version_count <> 1 then
    raise exception 'Upgrade assertion: assessment version snapshot was not preserved';
  end if;

  if assessment_item_row.points_possible <> 1
     or assessment_item_row.qa_state <> 'empty'
     or assessment_item_row.locked is not false
     or assessment_item_row.version_history <> '[]'::jsonb then
    raise exception 'Upgrade assertion: migration 018 points/QA backfill is incorrect';
  end if;

  if not exists (select 1 from public.assessment_documents where document_id = assessment_row.id and settings = '{}'::jsonb) then
    raise exception 'Upgrade assertion: assessment settings backfill is incorrect';
  end if;

  foreach enum_value in array enum_values loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'assessment_question_type'
        and e.enumlabel = enum_value
    ) then
      raise exception 'Upgrade assertion: question type enum value % is missing', enum_value;
    end if;
  end loop;

  if to_regclass('public.result_sessions') is null
     or to_regclass('public.remediation_plans') is null then
    raise exception 'Upgrade assertion: result/remediation tables were not installed';
  end if;
end;
$$;

-- Migration 030 deliberately preserves the legacy Grade 7 competency UUID
-- while correcting its canonical wording and source page. Capture the frozen
-- assessment mapping before exercising any later saves, then prove the live
-- curriculum has legitimately diverged from that historical authority.
create temporary table upgrade_frozen_assessment_mapping as
select
  ai.id,
  jsonb_build_object(
    'assessmentDocumentId', ai.assessment_document_id,
    'itemNumber', ai.item_number,
    'canonicalCompetencyId', ai.canonical_competency_id,
    'competencyCode', ai.competency_code_snapshot,
    'competencyText', ai.competency_text_snapshot,
    'competencySourcePage', ai.competency_source_page_snapshot,
    'competencyAcademicPeriodId', ai.competency_academic_period_id_snapshot,
    'competencyCurriculumPeriodId', ai.competency_curriculum_period_id_snapshot,
    'competencyPeriodLabel', ai.competency_period_label_snapshot,
    'tosRowId', ai.tos_row_id,
    'allocationItemStart', ai.allocation_item_start,
    'allocationItemEnd', ai.allocation_item_end,
    'allocationIndex', ai.allocation_index,
    'cognitiveCategoryId', ai.cognitive_category_id,
    'cognitiveCategoryLabel', ai.cognitive_category_label_snapshot,
    'cognitiveCategoryShortLabel', ai.cognitive_category_short_label_snapshot,
    'pointStart', ai.point_start,
    'pointEnd', ai.point_end,
    'planEntryId', ai.plan_entry_id
  ) as item_mapping,
  ad.source_tos_document_id,
  ad.source_tos_version_number,
  ad.source_tos_content_snapshot,
  ad.source_tos_raw_content_snapshot,
  ad.total_items
from public.assessment_items ai
join public.assessment_documents ad
  on ad.document_id = ai.assessment_document_id
where ai.id = '66666666-6666-4666-8666-666666666666';

do $$
declare
  frozen record;
  current_competency public.curriculum_competencies%rowtype;
  frozen_tos_row public.tos_competencies%rowtype;
  frozen_snapshot_row jsonb;
begin
  select * into frozen from upgrade_frozen_assessment_mapping;
  if frozen.id is null then
    raise exception 'Upgrade assertion: frozen assessment mapping capture failed';
  end if;

  select * into current_competency
  from public.curriculum_competencies
  where id = (frozen.item_mapping ->> 'canonicalCompetencyId')::uuid;

  if current_competency.id is null
     or current_competency.verification_status <> 'verified'
     or current_competency.competency_text is not distinct from frozen.item_mapping ->> 'competencyText'
     or current_competency.source_page is not distinct from (frozen.item_mapping ->> 'competencySourcePage')::integer then
    raise exception 'Upgrade assertion: migration 030 did not preserve the competency ID while correcting its canonical metadata';
  end if;

  select * into frozen_tos_row
  from public.tos_competencies
  where document_id = frozen.source_tos_document_id
    and row_id = (frozen.item_mapping ->> 'tosRowId')::uuid;

  select value into frozen_snapshot_row
  from jsonb_array_elements(frozen.source_tos_content_snapshot -> 'rows')
  where value ->> 'id' = frozen.item_mapping ->> 'tosRowId'
  limit 1;

  if frozen_tos_row.document_id is null
     or frozen_snapshot_row is null
     or frozen_tos_row.competency_id::text is distinct from frozen.item_mapping ->> 'canonicalCompetencyId'
     or frozen_tos_row.competency_code_snapshot is distinct from frozen.item_mapping ->> 'competencyCode'
     or frozen_tos_row.competency_text_snapshot is distinct from frozen.item_mapping ->> 'competencyText'
     or frozen_tos_row.source_page_snapshot::text is distinct from frozen.item_mapping ->> 'competencySourcePage'
     or frozen_tos_row.curriculum_period_label_snapshot is distinct from frozen.item_mapping ->> 'competencyPeriodLabel'
     or frozen_snapshot_row #>> '{competency,id}' is distinct from frozen.item_mapping ->> 'canonicalCompetencyId'
     or frozen_snapshot_row #>> '{competency,code}' is distinct from frozen.item_mapping ->> 'competencyCode'
     or frozen_snapshot_row #>> '{competency,text}' is distinct from frozen.item_mapping ->> 'competencyText'
     or frozen_snapshot_row #>> '{competency,sourcePage}' is distinct from frozen.item_mapping ->> 'competencySourcePage'
     or frozen_snapshot_row #>> '{competency,academicPeriodId}' is distinct from frozen.item_mapping ->> 'competencyAcademicPeriodId'
     or frozen_snapshot_row #>> '{competency,curriculumPeriodId}' is distinct from frozen.item_mapping ->> 'competencyCurriculumPeriodId'
     or frozen_snapshot_row #>> '{competency,curriculumPeriodLabel}' is distinct from frozen.item_mapping ->> 'competencyPeriodLabel'
     or frozen_snapshot_row -> 'cognitiveAllocations' is distinct from frozen_tos_row.cognitive_allocations then
    raise exception 'Upgrade assertion: frozen TOS and assessment mapping authorities do not agree';
  end if;
end;
$$;

create function pg_temp.upgrade_item_mapping(p_item_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'assessmentDocumentId', ai.assessment_document_id,
    'itemNumber', ai.item_number,
    'canonicalCompetencyId', ai.canonical_competency_id,
    'competencyCode', ai.competency_code_snapshot,
    'competencyText', ai.competency_text_snapshot,
    'competencySourcePage', ai.competency_source_page_snapshot,
    'competencyAcademicPeriodId', ai.competency_academic_period_id_snapshot,
    'competencyCurriculumPeriodId', ai.competency_curriculum_period_id_snapshot,
    'competencyPeriodLabel', ai.competency_period_label_snapshot,
    'tosRowId', ai.tos_row_id,
    'allocationItemStart', ai.allocation_item_start,
    'allocationItemEnd', ai.allocation_item_end,
    'allocationIndex', ai.allocation_index,
    'cognitiveCategoryId', ai.cognitive_category_id,
    'cognitiveCategoryLabel', ai.cognitive_category_label_snapshot,
    'cognitiveCategoryShortLabel', ai.cognitive_category_short_label_snapshot,
    'pointStart', ai.point_start,
    'pointEnd', ai.point_end,
    'planEntryId', ai.plan_entry_id
  )
  from public.assessment_items ai
  where ai.id = p_item_id
$$;

-- The scoring synchronization trigger is behavior-tested, not inspected.  It
-- keeps legacy `points` and new `points_possible` equal and derives locked QA
-- state.  A deliberately old timestamp makes updated_at trigger behavior
-- observable even inside the statement transaction.
update public.assessment_items
set updated_at = '2000-01-01T00:00:00Z', points_possible = 3
where id = '66666666-6666-4666-8666-666666666666';

do $$
declare
  item_row public.assessment_items%rowtype;
begin
  select * into item_row from public.assessment_items
  where id = '66666666-6666-4666-8666-666666666666';
  if item_row.points <> 3 or item_row.points_possible <> 3
     or item_row.updated_at <= '2000-01-01T00:00:00Z' then
    raise exception 'Upgrade assertion: scoring synchronization/updated_at trigger failed';
  end if;
  if exists (
    select 1
    from upgrade_frozen_assessment_mapping frozen
    where pg_temp.upgrade_item_mapping(frozen.id) is distinct from frozen.item_mapping
  ) then
    raise exception 'Upgrade assertion: non-mapping points update rewrote the frozen curriculum mapping';
  end if;
end;
$$;

update public.assessment_items
set locked = true
where id = '66666666-6666-4666-8666-666666666666';

do $$
begin
  if (select qa_state from public.assessment_items
      where id = '66666666-6666-4666-8666-666666666666') <> 'locked' then
    raise exception 'Upgrade assertion: locked item did not derive locked QA state';
  end if;
end;
$$;

-- Migration 020 fixes the existing-draft save path.  This call exercises the
-- locked-item comparison and stable-ID replacement that previously failed at
-- runtime because SQL aliases shadowed PL/pgSQL variables.
select public.save_assessment_document(
  '55555555-5555-4555-8555-555555555555'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  '33333333-3333-4333-8333-333333333333'::uuid,
  'Upgrade Fixture Assessment',
  '2026-2027',
  'Term 1',
  'Choose one answer.',
  'draft',
  (select structured_content from public.documents where id = '55555555-5555-4555-8555-555555555555'),
  (select jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number)
   from public.assessment_items ai
   where ai.assessment_document_id = '55555555-5555-4555-8555-555555555555'::uuid),
  'Migration 020 upgrade harness save'
);

do $$
declare
  item_row public.assessment_items%rowtype;
  version_count integer;
begin
  select * into item_row from public.assessment_items
  where id = '66666666-6666-4666-8666-666666666666';
  if item_row.id is null or item_row.points <> 3 or item_row.points_possible <> 3
     or item_row.locked is not true or item_row.qa_state <> 'locked' then
    raise exception 'Upgrade assertion: migration 020 save did not preserve item ID/data/points';
  end if;
  select count(*) into version_count from public.document_versions
  where document_id = '55555555-5555-4555-8555-555555555555'::uuid;
  if version_count <> 2 then
    raise exception 'Upgrade assertion: migration 020 save did not append exactly one document version';
  end if;
  if exists (
    select 1
    from upgrade_frozen_assessment_mapping frozen
    where pg_temp.upgrade_item_mapping(frozen.id) is distinct from frozen.item_mapping
  ) then
    raise exception 'Upgrade assertion: historical draft save rewrote the frozen item mapping';
  end if;
  if exists (
    select 1
    from public.assessment_documents ad
    join upgrade_frozen_assessment_mapping frozen
      on ad.document_id = (frozen.item_mapping ->> 'assessmentDocumentId')::uuid
    where ad.source_tos_document_id is distinct from frozen.source_tos_document_id
       or ad.source_tos_version_number is distinct from frozen.source_tos_version_number
       or ad.source_tos_content_snapshot is distinct from frozen.source_tos_content_snapshot
       or ad.source_tos_raw_content_snapshot is distinct from frozen.source_tos_raw_content_snapshot
       or ad.total_items is distinct from frozen.total_items
  ) then
    raise exception 'Upgrade assertion: historical draft save rewrote its frozen TOS source snapshot';
  end if;
end;
$$;

-- Frozen mapping identity and provenance remain immutable even though the live
-- curriculum row now has corrected wording/page metadata.
do $$
declare
  rejected boolean;
  other_competency_id uuid;
begin
  rejected := false;
  begin
    update public.assessment_items
    set competency_text_snapshot = competency_text_snapshot || ' tampered'
    where id = '66666666-6666-4666-8666-666666666666';
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Upgrade assertion: competency-text snapshot tampering was not rejected';
  end if;

  rejected := false;
  begin
    update public.assessment_items
    set competency_source_page_snapshot = competency_source_page_snapshot + 1
    where id = '66666666-6666-4666-8666-666666666666';
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Upgrade assertion: competency-page snapshot tampering was not rejected';
  end if;

  rejected := false;
  begin
    update public.assessment_items
    set tos_row_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    where id = '66666666-6666-4666-8666-666666666666';
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Upgrade assertion: finalized-TOS row ID tampering was not rejected';
  end if;

  select id into other_competency_id
  from public.curriculum_competencies
  where id <> (
    select canonical_competency_id
    from public.assessment_items
    where id = '66666666-6666-4666-8666-666666666666'
  )
  order by id
  limit 1;

  if other_competency_id is null then
    raise exception 'Upgrade assertion: a second competency is required for ID-tamper coverage';
  end if;

  rejected := false;
  begin
    update public.assessment_items
    set canonical_competency_id = other_competency_id
    where id = '66666666-6666-4666-8666-666666666666';
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Upgrade assertion: canonical competency ID tampering was not rejected';
  end if;

  if exists (
    select 1
    from upgrade_frozen_assessment_mapping frozen
    where pg_temp.upgrade_item_mapping(frozen.id) is distinct from frozen.item_mapping
  ) then
    raise exception 'Upgrade assertion: a rejected tamper changed the frozen assessment mapping';
  end if;
end;
$$;

-- The V2 path must also be able to create and resave a draft from the same
-- historical finalized TOS after migration 030 corrected the live curriculum.
-- Its point-range/master-plan constraints remain fully enforced.
do $$
declare
  historical_item public.assessment_items%rowtype;
  master_entry jsonb;
  settings_value jsonb;
  v2_item jsonb;
  v2_items jsonb;
  v2_content jsonb;
  v2_document public.documents%rowtype;
  saved_v2_item public.assessment_items%rowtype;
  current_competency public.curriculum_competencies%rowtype;
  version_count integer;
  rejected boolean := false;
begin
  select * into historical_item
  from public.assessment_items
  where id = '66666666-6666-4666-8666-666666666666';

  master_entry := jsonb_build_object(
    'id', 'upgrade-v2-entry-1',
    'itemNumber', 1,
    'pointStart', 1,
    'pointEnd', 2,
    'pointsPossible', 2,
    'rowId', historical_item.tos_row_id,
    'competencyId', historical_item.canonical_competency_id,
    'cognitiveCategoryId', historical_item.cognitive_category_id,
    'questionType', historical_item.question_type
  );
  settings_value := jsonb_build_object(
    'schemaVersion', 2,
    'generationVersion', 'v2',
    'numberingMode', 'point_ranges',
    'masterPlan', jsonb_build_object(
      'logicalItemCount', 1,
      'totalPoints', 2,
      'entries', jsonb_build_array(master_entry)
    )
  );
  v2_item := jsonb_build_object(
    'id', '99999999-9999-4999-8999-999999999999',
    'itemNumber', 1,
    'pointStart', 1,
    'pointEnd', 2,
    'planEntryId', 'upgrade-v2-entry-1',
    'competencySnapshot', jsonb_build_object(
      'id', historical_item.canonical_competency_id,
      'code', historical_item.competency_code_snapshot,
      'text', historical_item.competency_text_snapshot,
      'sourcePage', historical_item.competency_source_page_snapshot,
      'academicPeriodId', historical_item.competency_academic_period_id_snapshot,
      'curriculumPeriodId', historical_item.competency_curriculum_period_id_snapshot,
      'curriculumPeriodLabel', historical_item.competency_period_label_snapshot
    ),
    'mapping', jsonb_build_object(
      'rowId', historical_item.tos_row_id,
      'competencyId', historical_item.canonical_competency_id,
      'cognitiveCategoryId', historical_item.cognitive_category_id,
      'allocationItemStart', historical_item.allocation_item_start,
      'allocationItemEnd', historical_item.allocation_item_end,
      'allocationIndex', historical_item.allocation_index
    ),
    'cognitiveCategorySnapshot', jsonb_build_object(
      'id', historical_item.cognitive_category_id,
      'label', historical_item.cognitive_category_label_snapshot,
      'shortLabel', historical_item.cognitive_category_short_label_snapshot
    ),
    'questionType', historical_item.question_type,
    'prompt', 'Historical V2 fixture question',
    'answer', historical_item.answer,
    'pointsPossible', 2,
    'rationale', 'Historical V2 fixture rationale',
    'teacherNotes', '',
    'authorshipState', 'manual',
    'locked', false,
    'history', jsonb_build_array()
  );

  select * into v2_document
  from public.save_assessment_document_v2(
    null,
    '22222222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid,
    'Upgrade Fixture V2 Assessment',
    '2026-2027',
    'Term 1',
    'Choose one answer.',
    'draft',
    jsonb_build_object('settings', settings_value),
    jsonb_build_array(v2_item),
    'Migration 037 V2 historical snapshot creation'
  );

  if v2_document.id is null then
    raise exception 'Upgrade assertion: V2 historical assessment creation failed';
  end if;

  select structured_content into v2_content
  from public.documents
  where id = v2_document.id;
  select jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number) into v2_items
  from public.assessment_items ai
  where ai.assessment_document_id = v2_document.id;
  v2_items := jsonb_set(
    v2_items,
    '{0,prompt}',
    to_jsonb('Historical V2 fixture question — resaved'::text),
    false
  );

  select * into v2_document
  from public.save_assessment_document_v2(
    v2_document.id,
    '22222222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid,
    'Upgrade Fixture V2 Assessment',
    '2026-2027',
    'Term 1',
    'Choose one answer.',
    'draft',
    v2_content,
    v2_items,
    'Migration 037 V2 historical snapshot resave'
  );

  select * into saved_v2_item
  from public.assessment_items
  where id = '99999999-9999-4999-8999-999999999999';
  select * into current_competency
  from public.curriculum_competencies
  where id = saved_v2_item.canonical_competency_id;
  select count(*) into version_count
  from public.document_versions
  where document_id = v2_document.id;

  if saved_v2_item.id is null
     or saved_v2_item.prompt <> 'Historical V2 fixture question — resaved'
     or saved_v2_item.point_start <> 1
     or saved_v2_item.point_end <> 2
     or saved_v2_item.plan_entry_id <> 'upgrade-v2-entry-1'
     or saved_v2_item.competency_text_snapshot is distinct from historical_item.competency_text_snapshot
     or saved_v2_item.competency_source_page_snapshot is distinct from historical_item.competency_source_page_snapshot
     or current_competency.competency_text is not distinct from saved_v2_item.competency_text_snapshot
     or current_competency.source_page is not distinct from saved_v2_item.competency_source_page_snapshot
     or version_count <> 2 then
    raise exception 'Upgrade assertion: V2 historical draft resave did not preserve its frozen mapping/master plan';
  end if;

  begin
    update public.assessment_items
    set competency_text_snapshot = competency_text_snapshot || ' tampered'
    where id = saved_v2_item.id;
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Upgrade assertion: V2 frozen mapping tampering was not rejected';
  end if;
end;
$$;

-- A finalized assessment must reject item mutation through the item trigger.
update public.documents
set status = 'final'
where id = '55555555-5555-4555-8555-555555555555';

do $$
begin
  begin
    update public.assessment_items
    set prompt = 'tampered after finalization'
    where id = '66666666-6666-4666-8666-666666666666';
    raise exception 'Upgrade assertion: finalized assessment item mutation was not rejected';
  exception when others then
    if position('immutable' in lower(sqlerrm)) = 0 then
      raise;
    end if;
  end;
end;
$$;

-- Migration 019's scoring/reference functions are behavior-tested with an
-- immutable item-shaped value.  These calls protect compatibility for the
-- legacy multiple-choice shape as well as invalid choice references.
do $$
declare
  item_value jsonb := jsonb_build_object(
    'id', '66666666-6666-4666-8666-666666666666',
    'questionType', 'multiple_choice',
    'pointsPossible', 3,
    'answer', jsonb_build_object(
      'type', 'multiple_choice',
      'choices', jsonb_build_array(
        jsonb_build_object('id', 'choice-a', 'text', 'Correct'),
        jsonb_build_object('id', 'choice-b', 'text', 'Distractor')
      ),
      'choiceId', 'choice-a'
    )
  );
  valid_answer jsonb := '{"type":"multiple_choice","choiceId":"choice-a"}'::jsonb;
  invalid_answer jsonb := '{"type":"multiple_choice","choiceId":"not-in-snapshot"}'::jsonb;
begin
  if public.result_answer_shape_valid('multiple_choice', valid_answer) is not true
     or public.result_learner_answer_references_valid(item_value, valid_answer) is not true
     or public.result_learner_answer_references_valid(item_value, invalid_answer) is not false
     or public.result_item_is_correct(item_value, valid_answer, '{}'::jsonb) is not true
     or public.result_item_earned_points(item_value, valid_answer, '{}'::jsonb) <> 3 then
    raise exception 'Upgrade assertion: migration 019 result scoring/reference behavior failed';
  end if;
end;
$$;


-- Phase 6 universal curriculum schema assertions.
do $$
begin
  if to_regclass('public.custom_curriculum_imports') is null then
    raise exception 'Upgrade assertion: custom_curriculum_imports is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'curriculum_versions' and column_name = 'origin_kind'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'curriculum_versions' and column_name = 'owner_user_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'curriculum_competencies' and column_name = 'provenance_kind'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teacher_assignments' and column_name = 'curriculum_source_kind'
  ) then
    raise exception 'Upgrade assertion: universal curriculum ownership/provenance columns are incomplete';
  end if;
  if to_regprocedure('public.publish_custom_curriculum(uuid,jsonb)') is null
     or to_regprocedure('public.archive_custom_curriculum(uuid)') is null then
    raise exception 'Upgrade assertion: custom curriculum RPCs are missing';
  end if;
  if to_regprocedure('public.guard_assignment_curriculum_competency_link()') is null then
    raise exception 'Upgrade assertion: downstream assignment curriculum competency guard is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'lesson_plan_assignment_curriculum_guard' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'tos_assignment_curriculum_guard' and not tgisinternal) then
    raise exception 'Upgrade assertion: lesson/TOS assignment curriculum guard triggers are missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'custom-curricula' and public is false) then
    raise exception 'Upgrade assertion: private custom-curricula Storage bucket is missing';
  end if;
end;
$$;


-- Visual reliability migration must preserve the upgrade path and install the
-- narrow optimistic checkpoint used by generated TikZ persistence.
do $$
begin
  if to_regprocedure('public.save_assessment_item_visual_checkpoint(uuid,uuid,text,text,jsonb,jsonb,jsonb)') is null then
    raise exception 'Upgrade assertion: item-level visual checkpoint RPC is missing';
  end if;

  if to_regprocedure('public.save_assessment_document_v2(uuid,uuid,uuid,text,text,text,text,text,jsonb,jsonb,text)') is null then
    raise exception 'Upgrade assertion: Assessment Generation V2 save RPC is missing';
  end if;
  if to_regprocedure('public.duplicate_assessment_document_v2(uuid,text,text)') is null then
    raise exception 'Upgrade assertion: Assessment Generation V2 duplicate RPC is missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='assessment_items' and column_name='point_start')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='assessment_items' and column_name='point_end')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='assessment_items' and column_name='plan_entry_id') then
    raise exception 'Upgrade assertion: Assessment Generation V2 item-range columns are missing';
  end if;
end;
$$;

-- Multi-mode assessment source guards must allow an explicitly assigned
-- legacy lesson plan (assignment_id is NULL) without weakening standard TOS
-- protections. This reproduces the production lesson-quiz creation path.
insert into public.documents (
  id, user_id, assignment_id, document_type, title, school_year,
  academic_period_label, status, structured_content
) values (
  '77777777-7777-4777-8777-777777777777'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  null,
  'lesson_plan',
  'Upgrade Legacy Lesson Plan',
  '2026-2027',
  'Term 1',
  'final',
  jsonb_build_object(
    'lessonTitle', 'Upgrade Legacy Lesson Plan',
    'gradeLevel', 'Grade 7',
    'learningArea', 'Mathematics'
  )
);

select public.save_assessment_document(
  null,
  '22222222-2222-4222-8222-222222222222'::uuid,
  null,
  'Upgrade Lesson Quiz',
  '2026-2027',
  'Term 1',
  'Answer each question.',
  'draft',
  jsonb_build_object(
    'mode', 'lesson_quiz',
    'sourceType', 'lesson_plan',
    'title', 'Upgrade Lesson Quiz',
    'sourceLesson', jsonb_build_object(
      'id', '77777777-7777-4777-8777-777777777777',
      'title', 'Upgrade Legacy Lesson Plan',
      'lessonTitle', 'Upgrade Legacy Lesson Plan',
      'gradeLevel', 'Grade 7',
      'learningArea', 'Mathematics',
      'schoolYear', '2026-2027',
      'gradingTermLabel', 'Term 1',
      'learningObjectives', jsonb_build_array('Classify polygons.'),
      'competencies', jsonb_build_array(
        jsonb_build_object(
          'id', 'legacy-comp-1',
          'code', null,
          'text', 'Classify polygons.',
          'sourcePage', null,
          'academicPeriodId', null,
          'curriculumPeriodId', null,
          'curriculumPeriodLabel', 'Term 1'
        )
      )
    ),
    'coveragePlan', jsonb_build_object(
      'totalItems', 1,
      'entries', jsonb_build_array(
        jsonb_build_object(
          'id', 'cov-legacy-comp-1-remembering',
          'sourceLessonId', '77777777-7777-4777-8777-777777777777',
          'competencyId', 'legacy-comp-1',
          'competencyCode', null,
          'competencyStatement', 'Classify polygons.',
          'cognitiveCategoryId', 'remembering',
          'cognitiveCategoryLabel', 'Remembering',
          'targetItemCount', 1,
          'targetPoints', 1,
          'allocatedItemNumbers', jsonb_build_array(1)
        )
      )
    ),
    'settings', '{}'::jsonb,
    'items', '[]'::jsonb
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', '88888888-8888-4888-8888-888888888888',
      'itemNumber', 1,
      'competencySnapshot', jsonb_build_object(
        'id', 'legacy-comp-1',
        'code', null,
        'text', 'Classify polygons.',
        'sourcePage', null,
        'academicPeriodId', null,
        'curriculumPeriodId', null,
        'curriculumPeriodLabel', 'Term 1'
      ),
      'cognitiveCategorySnapshot', jsonb_build_object(
        'id', 'remembering',
        'label', 'Remembering',
        'shortLabel', 'REM'
      ),
      'mapping', jsonb_build_object(
        'kind', 'lesson_coverage',
        'coverageEntryId', 'cov-legacy-comp-1-remembering',
        'sourceLessonId', '77777777-7777-4777-8777-777777777777',
        'competencyId', 'legacy-comp-1',
        'cognitiveCategoryId', 'remembering',
        'allocationItemStart', 1,
        'allocationItemEnd', 1,
        'allocationIndex', 0,
        'rowId', 'cov-legacy-comp-1-remembering'
      ),
      'prompt', '',
      'questionType', 'multiple_choice',
      'answer', jsonb_build_object(
        'type', 'multiple_choice',
        'choices', jsonb_build_array(
          jsonb_build_object('id', 'choice-a', 'text', 'Triangle'),
          jsonb_build_object('id', 'choice-b', 'text', 'Circle')
        ),
        'choiceId', 'choice-a'
      ),
      'pointsPossible', 1,
      'points', 1,
      'authorshipState', 'empty',
      'qaState', 'empty',
      'locked', false,
      'history', '[]'::jsonb
    )
  ),
  'Mode-aware lesson quiz regression assertion'
);

do $$
declare
  quiz_row public.documents%rowtype;
  metadata_row public.assessment_documents%rowtype;
  quiz_item public.assessment_items%rowtype;
begin
  select * into quiz_row
  from public.documents
  where user_id = '11111111-1111-4111-8111-111111111111'::uuid
    and document_type = 'assessment'
    and title = 'Upgrade Lesson Quiz'
  order by created_at desc
  limit 1;

  if quiz_row.id is null
     or quiz_row.assignment_id is distinct from '22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'Upgrade assertion: lesson quiz with explicit assignment was not saved';
  end if;

  select * into metadata_row
  from public.assessment_documents
  where document_id = quiz_row.id;

  if metadata_row.document_id is null
     or metadata_row.mode <> 'lesson_quiz'
     or metadata_row.source_type <> 'lesson_plan'
     or metadata_row.source_tos_document_id is not null
     or metadata_row.source_lesson_document_id is distinct from '77777777-7777-4777-8777-777777777777'::uuid then
    raise exception 'Upgrade assertion: lesson quiz provenance metadata is incorrect';
  end if;

  select * into quiz_item
  from public.assessment_items
  where assessment_document_id = quiz_row.id and item_number = 1;

  if quiz_item.id is null
     or quiz_item.tos_row_id is not null
     or quiz_item.coverage_entry_id is distinct from 'cov-legacy-comp-1-remembering'
     or quiz_item.source_lesson_id is distinct from '77777777-7777-4777-8777-777777777777'::uuid then
    raise exception 'Upgrade assertion: lesson quiz item coverage provenance is incorrect';
  end if;
end;
$$;

select 'upgrade application and behavior assertions: ok' as result;
