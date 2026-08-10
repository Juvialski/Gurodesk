-- Behavioral smoke assertions after a fresh application of all migrations.
\set ON_ERROR_STOP on

do $$
declare
  required_table text;
  required_tables text[] := array[
    'profiles', 'teacher_assignments', 'documents', 'document_versions',
    'tos_competencies', 'assessment_documents', 'assessment_items',
    'assessment_ai_audit_events', 'class_learners', 'result_sessions',
    'result_session_learners', 'result_item_outcomes',
    'result_score_only_outcomes', 'remediation_plans',
    'remediation_plan_targets', 'remediation_plan_participants'
  ];
begin
  foreach required_table in array required_tables loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Fresh migration smoke test: missing table public.%', required_table;
    end if;
  end loop;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'assessment_question_type'
  ) then
    raise exception 'Fresh migration smoke test: assessment question enum is missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_assessment_document'
  ) then
    raise exception 'Fresh migration smoke test: assessment save RPC is missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'result_item_earned_points'
  ) then
    raise exception 'Fresh migration smoke test: result scoring function is missing';
  end if;
end;
$$;

-- The fresh run must have no upgrade fixture residue.  This catches a reset
-- that silently reused a prior local database instead of applying a new one.
do $$
begin
  if exists (
    select 1 from public.documents
    where id in (
      '33333333-3333-4333-8333-333333333333'::uuid,
      '55555555-5555-4555-8555-555555555555'::uuid
    )
  ) then
    raise exception 'Fresh migration smoke test: upgrade fixture residue found';
  end if;
end;
$$;


-- Phase 6 universal curriculum schema assertions.
do $$
begin
  if to_regclass('public.custom_curriculum_imports') is null then
    raise exception 'Fresh assertion: custom_curriculum_imports is missing';
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
    raise exception 'Fresh assertion: universal curriculum ownership/provenance columns are incomplete';
  end if;
  if to_regprocedure('public.publish_custom_curriculum(uuid,jsonb)') is null
     or to_regprocedure('public.archive_custom_curriculum(uuid)') is null then
    raise exception 'Fresh assertion: custom curriculum RPCs are missing';
  end if;
  if to_regprocedure('public.guard_assignment_curriculum_competency_link()') is null then
    raise exception 'Fresh assertion: downstream assignment curriculum competency guard is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'lesson_plan_assignment_curriculum_guard' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'tos_assignment_curriculum_guard' and not tgisinternal) then
    raise exception 'Fresh assertion: lesson/TOS assignment curriculum guard triggers are missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'custom-curricula' and public is false) then
    raise exception 'Fresh assertion: private custom-curricula Storage bucket is missing';
  end if;
end;
$$;

select 'fresh migration application: ok' as result;
