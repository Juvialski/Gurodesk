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

select 'fresh migration application: ok' as result;
