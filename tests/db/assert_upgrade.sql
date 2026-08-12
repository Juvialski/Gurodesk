-- Behavioral assertions for the 001-014 -> 015-027 upgrade path.
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

select 'upgrade application and behavior assertions: ok' as result;
