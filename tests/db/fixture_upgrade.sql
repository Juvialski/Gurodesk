-- Upgrade-path fixture for scripts/test-db-migrations.sh.
--
-- This is intentionally a database behavior fixture rather than a migration
-- text fixture.  It inserts a real auth user, lets the Phase 1 profile trigger
-- materialize the profile, and then creates a valid finalized TOS and draft
-- assessment through the same trigger-gated shape used by the application.

\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('app.assessment_rpc', '1', true);

-- Supabase local Auth owns this table.  Keep the insert to columns that are
-- stable across the supported local Auth images; the remaining Auth columns
-- have defaults.  The on-auth-user-created trigger creates the profile row.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'migration-harness-teacher@example.test',
  'not-a-real-password',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Migration Harness Teacher"}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
)
on conflict (id) do update set email = excluded.email;

update public.profiles
set email = 'migration-harness-teacher@example.test',
    full_name = 'Migration Harness Teacher',
    school_name = 'Upgrade Fixture School',
    region = 'Region IV-A',
    division = 'Fixture Division',
    position_title = 'Teacher I',
    school_year = '2026-2027',
    onboarding_completed = true
where id = '11111111-1111-4111-8111-111111111111';

insert into public.teacher_assignments (
  id, user_id, school_year, grade_level, learning_area, section_names, is_active
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '2026-2027',
  'Grade 7',
  'Mathematics',
  array['7-Mabini'],
  true
);

do $$
declare
  teacher_id uuid := '11111111-1111-4111-8111-111111111111';
  assignment_id uuid := '22222222-2222-4222-8222-222222222222';
  tos_id uuid := '33333333-3333-4333-8333-333333333333';
  tos_row_id uuid := '44444444-4444-4444-8444-444444444444';
  assessment_id uuid := '55555555-5555-4555-8555-555555555555';
  assessment_item_id uuid := '66666666-6666-4666-8666-666666666666';
  version_id uuid;
  subject_id uuid;
  period_id uuid;
  competency_id uuid;
  competency_code text;
  competency_text text;
  competency_source_page integer;
  curriculum_version_id uuid;
  curriculum_version_code text;
  curriculum_version_name text;
  source_title text;
  source_url text;
  grading_term_id uuid;
  tos_content jsonb;
  tos_row jsonb;
  categories jsonb;
  allocation jsonb;
  source_snapshot jsonb;
  assessment_item jsonb;
  assessment_content jsonb;
  choices jsonb;
begin
  select cv.id, cv.code, cv.name, cs.id, ap.id, c.id, c.competency_code,
         c.competency_text, c.source_page, sd.title, sd.source_url
  into curriculum_version_id, curriculum_version_code, curriculum_version_name,
       subject_id, period_id, competency_id, competency_code,
       competency_text, competency_source_page, source_title, source_url
  from public.curriculum_versions cv
  join public.curriculum_subjects cs on cs.curriculum_version_id = cv.id
    and cs.grade_level = 'Grade 7' and cs.name = 'Mathematics'
  join public.academic_periods ap on ap.subject_id = cs.id and ap.sequence = 1
  join public.curriculum_competencies c on c.subject_id = cs.id
    and c.academic_period_id = ap.id and c.verification_status = 'verified'
  join public.source_documents sd on sd.id = c.source_document_id
    and sd.verification_status in ('verified', 'superseded')
  where cv.code = 'REVISED-K10-MATATAG'
  order by c.sort_order, c.id
  limit 1;

  if competency_id is null then
    raise exception 'Upgrade fixture could not find a verified seeded curriculum competency';
  end if;

  select gp.id
  into grading_term_id
  from public.grading_periods gp
  join public.school_year_calendars syc on syc.id = gp.school_year_calendar_id
  where syc.school_year = '2026-2027'
    and syc.status in ('active', 'superseded')
    and gp.label = 'Term 1';

  if grading_term_id is null then
    raise exception 'Upgrade fixture could not find the verified Term 1 grading period';
  end if;

  categories := jsonb_build_array(
    jsonb_build_object(
      'id', 'remembering',
      'label', 'Remembering',
      'shortLabel', 'R',
      'weight', '1',
      'sortOrder', 1
    )
  );
  allocation := jsonb_build_array(
    jsonb_build_object(
      'categoryId', 'remembering',
      'label', 'Remembering',
      'shortLabel', 'R',
      'itemCount', 1,
      'itemStart', 1,
      'itemEnd', 1,
      'rangeLabel', '1'
    )
  );
  tos_row := jsonb_build_object(
    'id', tos_row_id,
    'sortOrder', 1,
    'competency', jsonb_build_object(
      'id', competency_id,
      'code', competency_code,
      'text', competency_text,
      'sourcePage', competency_source_page,
      'sourceTitle', source_title,
      'sourceUrl', source_url,
      'academicPeriodId', period_id,
      'curriculumPeriodLabel', 'Quarter 1',
      'verificationStatus', 'verified'
    ),
    'instructionalMinutes', '0',
    'manualWeight', '1',
    'itemCountOverride', '',
    'cognitiveWeights', jsonb_build_object('remembering', '1'),
    'notes', '',
    'computedWeightPercent', '100',
    'itemCount', 1,
    'itemStart', 1,
    'itemEnd', 1,
    'itemRangeLabel', '1',
    'cognitiveAllocations', allocation
  );
  tos_content := jsonb_build_object(
    'schemaVersion', 1,
    'title', 'Upgrade Fixture TOS',
    'assessmentTitle', 'Upgrade Fixture Assessment',
    'gradeLevel', 'Grade 7',
    'learningArea', 'Mathematics',
    'sections', jsonb_build_array('7-Mabini'),
    'schoolYear', '2026-2027',
    'gradingTermId', grading_term_id,
    'gradingTermLabel', 'Term 1',
    'curriculumVersionId', curriculum_version_id,
    'curriculumVersionCode', curriculum_version_code,
    'curriculumVersionName', curriculum_version_name,
    'curriculumSubjectId', subject_id,
    'curriculumPeriodIds', jsonb_build_array(period_id),
    'curriculumPeriodLabels', jsonb_build_array('Quarter 1'),
    'sourceTitle', source_title,
    'sourceUrl', source_url,
    'totalItems', 1,
    'weightingMethod', 'equal',
    'cognitiveCategories', categories,
    'rows', jsonb_build_array(tos_row),
    'notes', '',
    'calculation', jsonb_build_object(
      'engine', 'hamilton-largest-remainder-v1',
      'valid', true,
      'totalAllocated', 1,
      'calculatedAt', '2026-08-09T00:00:00.000Z',
      'warnings', jsonb_build_array()
    )
  );

  -- Draft first: the TOS state trigger requires relational rows to be present
  -- before the status transition to final can be verified.
  insert into public.documents (
    id, user_id, assignment_id, document_type, title, school_year,
    academic_period_label, status, structured_content
  ) values (
    tos_id, teacher_id, assignment_id, 'tos', 'Upgrade Fixture TOS', '2026-2027',
    'Term 1', 'draft', tos_content
  );

  insert into public.tos_competencies (
    document_id, row_id, competency_id, competency_code_snapshot,
    competency_text_snapshot, source_page_snapshot,
    curriculum_period_label_snapshot, row_order, instructional_minutes,
    source_weight, computed_weight_percent, item_count, item_start, item_end,
    cognitive_allocations, notes
  ) values (
    tos_id, tos_row_id, competency_id, competency_code, competency_text,
    competency_source_page, 'Quarter 1', 1, 0, 1, 100, 1, 1, 1,
    allocation, ''
  );

  insert into public.document_versions (
    id, document_id, version_number, structured_content, change_note
  ) values (
    '77777777-7777-4777-8777-777777777777', tos_id, 1, tos_content,
    'Upgrade fixture TOS'
  );

  update public.documents
  set status = 'final'
  where id = tos_id;

  source_snapshot := public.assessment_canonical_tos_snapshot(tos_id);
  choices := jsonb_build_array(
    jsonb_build_object('id', 'choice-a', 'text', 'Correct'),
    jsonb_build_object('id', 'choice-b', 'text', 'Distractor')
  );
  assessment_item := jsonb_build_object(
    'id', assessment_item_id,
    'itemNumber', 1,
    'competencySnapshot', jsonb_build_object(
      'id', competency_id,
      'code', competency_code,
      'text', competency_text,
      'sourcePage', competency_source_page,
      'academicPeriodId', period_id,
      'curriculumPeriodId', period_id,
      'curriculumPeriodLabel', 'Quarter 1'
    ),
    'mapping', jsonb_build_object(
      'rowId', tos_row_id,
      'competencyId', competency_id,
      'cognitiveCategoryId', 'remembering',
      'allocationItemStart', 1,
      'allocationItemEnd', 1,
      'allocationIndex', 0
    ),
    'cognitiveCategorySnapshot', jsonb_build_object(
      'id', 'remembering',
      'label', 'Remembering',
      'shortLabel', 'R'
    ),
    'questionType', 'multiple_choice',
    'prompt', 'Which option is correct?',
    'answer', jsonb_build_object(
      'type', 'multiple_choice',
      'choices', choices,
      'choiceId', 'choice-a'
    ),
    'points', 1,
    'rationale', 'Fixture rationale',
    'teacherNotes', '',
    'authorshipState', 'manual'
  );
  assessment_content := jsonb_build_object(
    'schemaVersion', 1,
    'title', 'Upgrade Fixture Assessment',
    'assessmentTitle', 'Upgrade Fixture Assessment',
    'instructions', 'Choose one answer.',
    'assignmentId', assignment_id,
    'gradeLevel', source_snapshot -> 'gradeLevel',
    'learningArea', source_snapshot -> 'learningArea',
    'schoolYear', source_snapshot -> 'schoolYear',
    'gradingTermId', source_snapshot -> 'gradingTermId',
    'gradingTermLabel', source_snapshot -> 'gradingTermLabel',
    'curriculumVersionId', source_snapshot -> 'curriculumVersionId',
    'curriculumVersionCode', source_snapshot -> 'curriculumVersionCode',
    'curriculumVersionName', source_snapshot -> 'curriculumVersionName',
    'curriculumSubjectId', source_snapshot -> 'curriculumSubjectId',
    'curriculumPeriodIds', source_snapshot -> 'curriculumPeriodIds',
    'curriculumPeriodLabels', source_snapshot -> 'curriculumPeriodLabels',
    'totalItems', 1,
    'sourceTosDocumentId', tos_id,
    'sourceTosVersionNumber', 1,
    'items', jsonb_build_array(assessment_item)
  );

  insert into public.documents (
    id, user_id, assignment_id, document_type, title, school_year,
    academic_period_label, status, structured_content
  ) values (
    assessment_id, teacher_id, assignment_id, 'assessment',
    'Upgrade Fixture Assessment', '2026-2027', 'Term 1', 'draft', assessment_content
  );

  insert into public.assessment_documents (
    document_id, user_id, assignment_id, source_tos_document_id,
    source_tos_version_number, source_tos_content_snapshot,
    source_tos_raw_content_snapshot, total_items, instructions
  ) values (
    assessment_id, teacher_id, assignment_id, tos_id, 1, source_snapshot,
    tos_content, 1, 'Choose one answer.'
  );

  insert into public.assessment_items (
    id, assessment_document_id, item_number, canonical_competency_id,
    competency_code_snapshot, competency_text_snapshot,
    competency_source_page_snapshot, competency_academic_period_id_snapshot,
    competency_curriculum_period_id_snapshot, competency_period_label_snapshot,
    tos_row_id, allocation_item_start, allocation_item_end, allocation_index,
    cognitive_category_id, cognitive_category_label_snapshot,
    cognitive_category_short_label_snapshot, question_type, prompt, choices,
    answer, points, rationale, teacher_notes, authorship_state
  ) values (
    assessment_item_id, assessment_id, 1, competency_id, competency_code,
    competency_text, competency_source_page, period_id::text, period_id::text,
    'Quarter 1', tos_row_id, 1, 1, 0, 'remembering', 'Remembering', 'R',
    'multiple_choice', 'Which option is correct?', choices,
    jsonb_build_object('type', 'multiple_choice', 'choices', choices, 'choiceId', 'choice-a'),
    1, 'Fixture rationale', '', 'manual'
  );

  insert into public.document_versions (
    id, document_id, version_number, structured_content, change_note
  ) values (
    '88888888-8888-4888-8888-888888888888', assessment_id, 1,
    assessment_content, 'Upgrade fixture assessment'
  );
end;
$$;

commit;
