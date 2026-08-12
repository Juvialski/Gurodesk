-- Assessment Generation V2
-- Point-first assessment planning with immutable master-plan linkage.
-- Legacy assessment rows/functions remain supported; the V2 save RPC is additive.

alter table public.assessment_items
  add column if not exists point_start integer,
  add column if not exists point_end integer,
  add column if not exists plan_entry_id text;

alter table public.assessment_items
  drop constraint if exists assessment_items_v2_point_range_valid;
alter table public.assessment_items
  add constraint assessment_items_v2_point_range_valid check (
    (point_start is null and point_end is null and plan_entry_id is null)
    or (
      point_start is not null and point_end is not null and plan_entry_id is not null
      and point_start > 0 and point_end >= point_start
      and char_length(btrim(plan_entry_id)) between 1 and 180
    )
  );

create index if not exists idx_assessment_items_plan_entry
  on public.assessment_items(assessment_document_id, plan_entry_id)
  where plan_entry_id is not null;

create or replace function public.assessment_item_mirror(
  p_item public.assessment_items
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_item.id,
    'itemNumber', p_item.item_number,
    'competencySnapshot', jsonb_build_object(
      'id', p_item.canonical_competency_id,
      'code', p_item.competency_code_snapshot,
      'text', p_item.competency_text_snapshot,
      'sourcePage', p_item.competency_source_page_snapshot,
      'academicPeriodId', p_item.competency_academic_period_id_snapshot,
      'curriculumPeriodId', p_item.competency_curriculum_period_id_snapshot,
      'curriculumPeriodLabel', p_item.competency_period_label_snapshot
    ),
    'cognitiveCategorySnapshot', jsonb_build_object(
      'id', p_item.cognitive_category_id,
      'label', p_item.cognitive_category_label_snapshot,
      'shortLabel', p_item.cognitive_category_short_label_snapshot
    ),
    'mapping', jsonb_build_object(
      'rowId', p_item.tos_row_id,
      'competencyId', p_item.canonical_competency_id,
      'cognitiveCategoryId', p_item.cognitive_category_id,
      'allocationItemStart', p_item.allocation_item_start,
      'allocationItemEnd', p_item.allocation_item_end,
      'allocationIndex', p_item.allocation_index
    ),
    'questionType', p_item.question_type,
    'prompt', p_item.prompt,
    'answer', p_item.answer,
    'pointsPossible', p_item.points_possible,
    'points', p_item.points,
    'rationale', p_item.rationale,
    'teacherNotes', p_item.teacher_notes,
    'authorshipState', p_item.authorship_state,
    'qaState', p_item.qa_state,
    'locked', p_item.locked,
    'history', p_item.version_history
  ) || case when p_item.point_start is not null then jsonb_build_object(
    'pointStart', p_item.point_start,
    'pointEnd', p_item.point_end,
    'planEntryId', p_item.plan_entry_id
  ) else '{}'::jsonb end
$$;

-- Preserve every legacy mapping invariant while allowing V2 logical questions
-- to anchor to a TOS competency/CPD allocation without pretending their logical
-- question number is one of the source TOS item slots.
create or replace function public.guard_assessment_item_mapping()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessment_row public.assessment_documents%rowtype;
  source_row public.documents%rowtype;
  competency_row public.curriculum_competencies%rowtype;
  source_tos_row public.tos_competencies%rowtype;
  category jsonb;
  is_v2 boolean := false;
  plan_entry jsonb;
begin
  select * into assessment_row from public.assessment_documents
  where document_id = new.assessment_document_id;
  if assessment_row.document_id is null then raise exception 'Assessment item must belong to an assessment document'; end if;
  is_v2 := assessment_row.settings ->> 'generationVersion' = 'v2'
    and assessment_row.settings ->> 'numberingMode' = 'point_ranges'
    and coalesce((assessment_row.settings ->> 'schemaVersion')::integer, 0) >= 2;

  select * into source_row from public.documents where id = assessment_row.source_tos_document_id;
  if source_row.id is null or source_row.document_type <> 'tos' or source_row.status not in ('final', 'archived') then
    raise exception 'Assessment items require a finalized TOS source';
  end if;
  select * into competency_row from public.curriculum_competencies where id = new.canonical_competency_id;
  if competency_row.id is null or competency_row.verification_status <> 'verified'
     or new.competency_text_snapshot is distinct from competency_row.competency_text
     or new.competency_code_snapshot is distinct from competency_row.competency_code then
    raise exception 'Assessment competency snapshots must match the verified canonical record';
  end if;

  if is_v2 then
    select * into source_tos_row from public.tos_competencies
    where document_id = assessment_row.source_tos_document_id
      and row_id = new.tos_row_id
      and competency_id = new.canonical_competency_id;
  else
    select * into source_tos_row from public.tos_competencies
    where document_id = assessment_row.source_tos_document_id
      and row_id = new.tos_row_id
      and competency_id = new.canonical_competency_id
      and new.item_number between item_start and item_end;
  end if;
  if source_tos_row.document_id is null then raise exception 'Assessment item competency mapping is outside the finalized TOS'; end if;

  select value into category
  from jsonb_array_elements(source_tos_row.cognitive_allocations)
  where value ->> 'categoryId' = new.cognitive_category_id
    and (is_v2 or new.item_number between (value ->> 'itemStart')::integer and (value ->> 'itemEnd')::integer)
  limit 1;

  if category is null
     or category ->> 'label' is distinct from new.cognitive_category_label_snapshot
     or category ->> 'itemStart' is distinct from new.allocation_item_start::text
     or category ->> 'itemEnd' is distinct from new.allocation_item_end::text
     or (not is_v2 and new.allocation_index <> new.item_number - new.allocation_item_start)
     or (is_v2 and (new.allocation_index < 0 or new.allocation_index >= greatest(1, (category ->> 'itemCount')::integer)))
     or new.competency_source_page_snapshot is distinct from competency_row.source_page
     or new.competency_academic_period_id_snapshot is distinct from competency_row.academic_period_id::text
     or new.competency_curriculum_period_id_snapshot is distinct from competency_row.academic_period_id::text
     or new.competency_period_label_snapshot is distinct from source_tos_row.curriculum_period_label_snapshot then
    raise exception 'Assessment item cognitive mapping is outside the finalized TOS allocation';
  end if;

  if new.cognitive_category_short_label_snapshot is distinct from coalesce(
    (select category_value ->> 'shortLabel'
     from jsonb_array_elements(source_row.structured_content -> 'cognitiveCategories') category_value
     where category_value ->> 'id' = new.cognitive_category_id limit 1), '') then
    raise exception 'Assessment item cognitive category snapshot does not match the finalized TOS';
  end if;

  if is_v2 then
    if new.point_start is null or new.point_end is null or coalesce(btrim(new.plan_entry_id), '') = '' then
      raise exception 'V2 assessment items require immutable point ranges and a master-plan entry ID';
    end if;
    select value into plan_entry
    from jsonb_array_elements(coalesce(assessment_row.settings -> 'masterPlan' -> 'entries', '[]'::jsonb))
    where (value ->> 'itemNumber')::integer = new.item_number limit 1;
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
  elsif new.point_start is not null or new.point_end is not null or new.plan_entry_id is not null then
    raise exception 'Legacy assessment items cannot acquire V2 point-range metadata';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id or new.assessment_document_id is distinct from old.assessment_document_id
    or new.item_number is distinct from old.item_number or new.canonical_competency_id is distinct from old.canonical_competency_id
    or new.competency_code_snapshot is distinct from old.competency_code_snapshot
    or new.competency_text_snapshot is distinct from old.competency_text_snapshot
    or new.competency_source_page_snapshot is distinct from old.competency_source_page_snapshot
    or new.competency_academic_period_id_snapshot is distinct from old.competency_academic_period_id_snapshot
    or new.competency_curriculum_period_id_snapshot is distinct from old.competency_curriculum_period_id_snapshot
    or new.competency_period_label_snapshot is distinct from old.competency_period_label_snapshot
    or new.tos_row_id is distinct from old.tos_row_id or new.allocation_item_start is distinct from old.allocation_item_start
    or new.allocation_item_end is distinct from old.allocation_item_end or new.allocation_index is distinct from old.allocation_index
    or new.cognitive_category_id is distinct from old.cognitive_category_id
    or new.cognitive_category_label_snapshot is distinct from old.cognitive_category_label_snapshot
    or new.cognitive_category_short_label_snapshot is distinct from old.cognitive_category_short_label_snapshot
    or new.point_start is distinct from old.point_start or new.point_end is distinct from old.point_end
    or new.plan_entry_id is distinct from old.plan_entry_id
  ) then raise exception 'Assessment item identity, point range, and curriculum mappings are immutable'; end if;
  return new;
end;
$$;

create or replace function public.save_assessment_document_v2(
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
  p_change_note text default 'Teacher saved Assessment Generation V2 draft'
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
  settings_value jsonb := coalesce(p_structured_content -> 'settings', '{}'::jsonb);
  master_plan jsonb;
  item_value jsonb;
  plan_entry jsonb;
  item_id uuid;
  item_number integer;
  item_count integer;
  expected_number integer := 1;
  point_start integer;
  point_end integer;
  point_cursor integer := 1;
  item_points numeric;
  expected_total_points integer;
  actual_total_points numeric;
  item_competency_id uuid;
  item_tos_row_id uuid;
  item_cognitive_category_id text;
  item_question_type public.assessment_question_type;
  item_authorship public.assessment_authorship_state;
  existing_item public.assessment_items%rowtype;
  incoming_item jsonb;
  mirror jsonb;
  normalized_content jsonb;
  next_version integer;
  bad boolean;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Assessment status must be draft or final'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_typeof(p_structured_content) is distinct from 'object' then raise exception 'Assessment V2 payload is invalid'; end if;
  if octet_length(p_items::text) > 16 * 1024 * 1024 or octet_length(p_structured_content::text) > 16 * 1024 * 1024 then raise exception 'Assessment save payload is too large'; end if;
  if char_length(btrim(coalesce(p_title, ''))) > 240 or char_length(coalesce(p_instructions, '')) > 100000 or char_length(coalesce(p_change_note, '')) > 1000 then raise exception 'Assessment text exceeds the supported save limit'; end if;
  if p_assignment_id is null or not exists (select 1 from public.teacher_assignments where id = p_assignment_id and user_id = owner_id) then raise exception 'A teacher-owned assignment is required'; end if;
  if jsonb_typeof(settings_value) is distinct from 'object'
     or settings_value ->> 'generationVersion' <> 'v2'
     or settings_value ->> 'numberingMode' <> 'point_ranges'
     or coalesce((settings_value ->> 'schemaVersion')::integer, 0) < 2 then
    raise exception 'Assessment V2 requires versioned point-range settings';
  end if;
  master_plan := settings_value -> 'masterPlan';
  if jsonb_typeof(master_plan) is distinct from 'object' or jsonb_typeof(master_plan -> 'entries') is distinct from 'array' then raise exception 'Assessment V2 requires a frozen master plan'; end if;
  item_count := jsonb_array_length(p_items);
  expected_total_points := (master_plan ->> 'totalPoints')::integer;
  if item_count < 1 or item_count > 10000 or item_count <> (master_plan ->> 'logicalItemCount')::integer or jsonb_array_length(master_plan -> 'entries') <> item_count then raise exception 'Assessment V2 logical question count does not match the master plan'; end if;
  if expected_total_points < 1 or expected_total_points > 1000 then raise exception 'Assessment V2 total points are invalid'; end if;
  if (select count(distinct value ->> 'id') from jsonb_array_elements(p_items)) <> item_count then raise exception 'Assessment item UUIDs must be unique'; end if;
  perform set_config('app.assessment_rpc', '1', true);

  if p_document_id is null then
    select * into source_row from public.documents where id = p_source_tos_document_id for share;
    if source_row.id is null or source_row.user_id is distinct from owner_id or source_row.document_type <> 'tos' or source_row.assignment_id is distinct from p_assignment_id
       or (source_row.status <> 'final' and coalesce(current_setting('app.assessment_duplicate_rpc', true), '') <> '1') then raise exception 'A finalized teacher-owned TOS for the same assignment is required'; end if;
    select coalesce(max(version_number), 0) into source_max_version from public.document_versions where document_id = source_row.id;
    if source_max_version <= 0 then raise exception 'The finalized TOS has no immutable version snapshot'; end if;
    source_canonical_content := public.assessment_canonical_tos_snapshot(source_row.id);
    insert into public.documents(user_id,assignment_id,document_type,title,school_year,academic_period_label,status,structured_content)
    values(owner_id,p_assignment_id,'assessment',coalesce(nullif(btrim(p_title),''),'Untitled assessment'),source_canonical_content->>'schoolYear',nullif(source_canonical_content->>'gradingTermLabel',''),'draft',p_structured_content)
    returning * into saved;
    insert into public.assessment_documents(document_id,user_id,assignment_id,source_tos_document_id,source_tos_version_number,source_tos_content_snapshot,source_tos_raw_content_snapshot,total_items,instructions,settings)
    values(saved.id,owner_id,p_assignment_id,source_row.id,source_max_version,source_canonical_content,source_row.structured_content,item_count,coalesce(p_instructions,''),settings_value)
    returning * into assessment_row;
  else
    select * into saved from public.documents where id=p_document_id and user_id=owner_id and document_type='assessment' for update;
    if saved.id is null then raise exception 'Assessment document not found'; end if;
    if saved.status <> 'draft' then raise exception 'Only draft assessment documents can be edited'; end if;
    select * into assessment_row from public.assessment_documents where document_id=saved.id for update;
    if assessment_row.document_id is null then raise exception 'Assessment metadata is missing'; end if;
    if assessment_row.settings ->> 'generationVersion' <> 'v2' or assessment_row.settings ->> 'numberingMode' <> 'point_ranges' then raise exception 'Legacy assessments cannot be converted to V2 in place'; end if;
    if p_assignment_id is distinct from assessment_row.assignment_id or p_source_tos_document_id is distinct from assessment_row.source_tos_document_id or item_count <> assessment_row.total_items then raise exception 'Assessment V2 source and logical question count are immutable'; end if;
    if settings_value -> 'masterPlan' is distinct from assessment_row.settings -> 'masterPlan' then raise exception 'The frozen assessment master plan cannot change after creation'; end if;

    if exists (
      select 1 from public.assessment_items ai
      join lateral (select value as item from jsonb_array_elements(p_items) where value->>'id'=ai.id::text limit 1) incoming on true
      where ai.assessment_document_id=saved.id and (
        incoming.item->>'itemNumber' is distinct from ai.item_number::text
        or incoming.item->>'pointStart' is distinct from ai.point_start::text
        or incoming.item->>'pointEnd' is distinct from ai.point_end::text
        or incoming.item->>'planEntryId' is distinct from ai.plan_entry_id
        or incoming.item->'mapping'->>'rowId' is distinct from ai.tos_row_id::text
        or incoming.item->'mapping'->>'competencyId' is distinct from ai.canonical_competency_id::text
        or incoming.item->'mapping'->>'cognitiveCategoryId' is distinct from ai.cognitive_category_id
      )
    ) then raise exception 'Assessment V2 immutable item mappings do not match the saved blueprint'; end if;

    for existing_item in select * from public.assessment_items where assessment_document_id=saved.id and locked for update loop
      select value into incoming_item from jsonb_array_elements(p_items) where value->>'id'=existing_item.id::text limit 1;
      if incoming_item is null then raise exception 'Locked assessment item is missing from the save payload'; end if;
      if coalesce((incoming_item->>'locked')::boolean,true) and (
        coalesce(incoming_item->>'prompt','') is distinct from existing_item.prompt
        or coalesce(incoming_item->'answer','{}'::jsonb) is distinct from existing_item.answer
        or coalesce(nullif(incoming_item->>'questionType',''),'multiple_choice') is distinct from existing_item.question_type::text
        or coalesce(nullif(incoming_item->>'pointsPossible','')::numeric,1) is distinct from existing_item.points_possible
        or coalesce(incoming_item->>'rationale','') is distinct from existing_item.rationale
        or coalesce(incoming_item->>'teacherNotes','') is distinct from existing_item.teacher_notes
      ) then raise exception 'Locked assessment item cannot be changed until explicitly unlocked'; end if;
    end loop;

    if exists (select 1 from public.assessment_items ai where ai.assessment_document_id=saved.id and not exists(select 1 from jsonb_array_elements(p_items) as x(value) where x.value->>'id'=ai.id::text and x.value->>'itemNumber'=ai.item_number::text)) then raise exception 'Existing assessment item UUIDs are stable and cannot change'; end if;
    update public.documents set title=coalesce(nullif(btrim(p_title),''),title),status='draft',structured_content=p_structured_content where id=saved.id returning * into saved;
    update public.assessment_documents set instructions=coalesce(p_instructions,instructions),settings=settings_value where document_id=saved.id returning * into assessment_row;
    delete from public.assessment_items where assessment_document_id=saved.id;
  end if;

  for item_value in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item_value) is distinct from 'object' then raise exception 'Assessment item must be an object'; end if;
    item_number := (item_value->>'itemNumber')::integer;
    if item_number is null or item_number <> expected_number then raise exception 'Assessment item numbers must be exactly contiguous from 1'; end if;
    expected_number := expected_number + 1;
    point_start := (item_value->>'pointStart')::integer;
    point_end := (item_value->>'pointEnd')::integer;
    item_points := coalesce(nullif(item_value->>'pointsPossible','')::numeric,nullif(item_value->>'points','')::numeric,1);
    if point_start <> point_cursor or point_end <> point_start + item_points::integer - 1 or item_points <> trunc(item_points) or item_points <= 0 then raise exception 'Assessment V2 point ranges must be whole-number, contiguous, and match pointsPossible'; end if;
    point_cursor := point_end + 1;
    select value into plan_entry from jsonb_array_elements(master_plan->'entries') where (value->>'itemNumber')::integer=item_number limit 1;
    if plan_entry is null
       or item_value->>'planEntryId' is distinct from plan_entry->>'id'
       or point_start is distinct from (plan_entry->>'pointStart')::integer
       or point_end is distinct from (plan_entry->>'pointEnd')::integer
       or item_points is distinct from (plan_entry->>'pointsPossible')::numeric
       or item_value->>'questionType' is distinct from plan_entry->>'questionType'
       or item_value->'mapping'->>'rowId' is distinct from plan_entry->>'rowId'
       or item_value->'mapping'->>'competencyId' is distinct from plan_entry->>'competencyId'
       or item_value->'mapping'->>'cognitiveCategoryId' is distinct from plan_entry->>'cognitiveCategoryId' then raise exception 'Assessment V2 item does not match the frozen master plan'; end if;

    item_id := (item_value->>'id')::uuid;
    item_competency_id := (item_value->'competencySnapshot'->>'id')::uuid;
    item_tos_row_id := (item_value->'mapping'->>'rowId')::uuid;
    item_cognitive_category_id := item_value->'cognitiveCategorySnapshot'->>'id';
    item_question_type := (item_value->>'questionType')::public.assessment_question_type;
    item_authorship := coalesce(nullif(item_value->>'authorshipState',''),'empty')::public.assessment_authorship_state;
    if item_id is null or item_competency_id is null or item_tos_row_id is null or coalesce(btrim(item_value->'competencySnapshot'->>'text'),'')='' then raise exception 'Assessment item identity and curriculum snapshots are required'; end if;
    if char_length(coalesce(item_value->>'prompt','')) > 40000 or octet_length(coalesce((item_value->'answer')::text,'')) > 256*1024 or jsonb_array_length(coalesce(item_value->'history','[]'::jsonb)) > 5 then raise exception 'Assessment item content exceeds supported limits'; end if;

    insert into public.assessment_items(
      id,assessment_document_id,item_number,point_start,point_end,plan_entry_id,canonical_competency_id,
      competency_code_snapshot,competency_text_snapshot,competency_source_page_snapshot,competency_academic_period_id_snapshot,
      competency_curriculum_period_id_snapshot,competency_period_label_snapshot,tos_row_id,allocation_item_start,allocation_item_end,allocation_index,
      cognitive_category_id,cognitive_category_label_snapshot,cognitive_category_short_label_snapshot,question_type,prompt,choices,answer,points,points_possible,
      rationale,teacher_notes,authorship_state,qa_state,locked,version_history
    ) values(
      item_id,saved.id,item_number,point_start,point_end,item_value->>'planEntryId',item_competency_id,
      nullif(item_value->'competencySnapshot'->>'code',''),item_value->'competencySnapshot'->>'text',(item_value->'competencySnapshot'->>'sourcePage')::integer,
      item_value->'competencySnapshot'->>'academicPeriodId',item_value->'competencySnapshot'->>'curriculumPeriodId',coalesce(item_value->'competencySnapshot'->>'curriculumPeriodLabel',''),
      item_tos_row_id,(item_value->'mapping'->>'allocationItemStart')::integer,(item_value->'mapping'->>'allocationItemEnd')::integer,(item_value->'mapping'->>'allocationIndex')::integer,
      item_cognitive_category_id,item_value->'cognitiveCategorySnapshot'->>'label',item_value->'cognitiveCategorySnapshot'->>'shortLabel',item_question_type,
      coalesce(item_value->>'prompt',''),coalesce(item_value->'answer'->'choices','[]'::jsonb),coalesce(item_value->'answer','{}'::jsonb),item_points,item_points,
      coalesce(item_value->>'rationale',''),coalesce(item_value->>'teacherNotes',''),item_authorship,
      case when coalesce((item_value->>'locked')::boolean,false) then 'locked' else coalesce(nullif(item_value->>'qaState',''),'empty') end,
      coalesce((item_value->>'locked')::boolean,false),coalesce(item_value->'history','[]'::jsonb)
    );
  end loop;

  if expected_number <> item_count + 1 or point_cursor <> expected_total_points + 1 then raise exception 'Assessment V2 numbering is incomplete'; end if;
  select coalesce(sum(points_possible),0) into actual_total_points from public.assessment_items where assessment_document_id=saved.id;
  if actual_total_points <> expected_total_points then raise exception 'Assessment V2 total points do not match the frozen master plan'; end if;

  if p_status='final' then
    if exists(select 1 from public.assessment_items where assessment_document_id=saved.id and authorship_state in ('empty','ai_suggestion')) then raise exception 'Final assessment requires every item to be teacher-accepted, edited, or manual'; end if;
    select exists(select 1 from public.assessment_items ai where ai.assessment_document_id=saved.id and not public.assessment_item_content_valid(ai.question_type,ai.prompt,ai.choices,ai.answer,ai.authorship_state)) into bad;
    if bad then raise exception 'Final assessment contains invalid question content'; end if;
    select exists(select 1 from public.assessment_items ai where ai.assessment_document_id=saved.id and not public.assessment_item_point_structure_valid(ai.question_type,ai.points_possible,ai.answer)) into bad;
    if bad then raise exception 'Final assessment item point structure does not reconcile with pointsPossible'; end if;
    if exists(select 1 from public.assessment_items ai where ai.assessment_document_id=saved.id and jsonb_typeof(assessment_row.settings->'allowedTypes')='array' and not exists(select 1 from jsonb_array_elements_text(assessment_row.settings->'allowedTypes') allowed(value) where allowed.value=ai.question_type::text)) then raise exception 'Final assessment uses a disabled question type'; end if;
  end if;

  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number),'[]'::jsonb) into mirror from public.assessment_items ai where ai.assessment_document_id=saved.id;
  source_content := assessment_row.source_tos_content_snapshot;
  normalized_content := jsonb_build_object(
    'schemaVersion',2,'title',saved.title,'assessmentTitle',saved.title,'instructions',assessment_row.instructions,'assignmentId',assessment_row.assignment_id,
    'gradeLevel',source_content->'gradeLevel','learningArea',source_content->'learningArea','schoolYear',source_content->'schoolYear','gradingTermId',source_content->'gradingTermId',
    'gradingTermLabel',source_content->'gradingTermLabel','curriculumVersionId',source_content->'curriculumVersionId','curriculumVersionCode',source_content->'curriculumVersionCode',
    'curriculumVersionName',source_content->'curriculumVersionName','curriculumSubjectId',source_content->'curriculumSubjectId','curriculumPeriodIds',source_content->'curriculumPeriodIds',
    'curriculumPeriodLabels',source_content->'curriculumPeriodLabels','totalItems',assessment_row.total_items,'totalPoints',actual_total_points,'settings',assessment_row.settings,
    'sourceTos',jsonb_build_object('id',assessment_row.source_tos_document_id,'versionNumber',assessment_row.source_tos_version_number,'title',source_content->>'title','status','final','assignmentId',assessment_row.assignment_id,'schoolYear',source_content->>'schoolYear','academicPeriodLabel',source_content->>'gradingTermLabel','content',source_content),
    'sourceTosDocumentId',assessment_row.source_tos_document_id,'sourceTosVersionNumber',assessment_row.source_tos_version_number,'items',mirror
  );
  update public.documents set status=p_status,structured_content=normalized_content where id=saved.id returning * into saved;
  select coalesce(max(version_number),0)+1 into next_version from public.document_versions where document_id=saved.id;
  insert into public.document_versions(document_id,version_number,structured_content,change_note) values(saved.id,next_version,saved.structured_content,nullif(p_change_note,''));
  return saved;
end;
$$;

revoke all on function public.save_assessment_document_v2(uuid,uuid,uuid,text,text,text,text,text,jsonb,jsonb,text) from public;
grant execute on function public.save_assessment_document_v2(uuid,uuid,uuid,text,text,text,text,text,jsonb,jsonb,text) to authenticated;

create or replace function public.duplicate_assessment_document_v2(
  p_source_document_id uuid,
  p_title text default null,
  p_instructions text default null
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  source_document public.documents%rowtype;
  source_assessment public.assessment_documents%rowtype;
  copied_items jsonb := '[]'::jsonb;
  item_value jsonb;
  created public.documents%rowtype;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into source_document from public.documents
  where id = p_source_document_id and user_id = owner_id and document_type = 'assessment' for share;
  if source_document.id is null then raise exception 'Assessment document not found'; end if;
  select * into source_assessment from public.assessment_documents where document_id = source_document.id;
  if source_assessment.document_id is null
     or source_assessment.settings ->> 'generationVersion' <> 'v2'
     or source_assessment.settings ->> 'numberingMode' <> 'point_ranges' then
    raise exception 'Assessment is not an Assessment Generation V2 document';
  end if;
  if jsonb_typeof(source_document.structured_content -> 'items') is distinct from 'array' then raise exception 'Assessment item mirror is invalid'; end if;
  for item_value in select value from jsonb_array_elements(source_document.structured_content -> 'items') loop
    copied_items := copied_items || jsonb_build_array(jsonb_set(item_value, '{id}', to_jsonb(gen_random_uuid()::text), true));
  end loop;
  perform set_config('app.assessment_duplicate_rpc', '1', true);
  select * into created from public.save_assessment_document_v2(
    null,
    source_assessment.assignment_id,
    source_assessment.source_tos_document_id,
    coalesce(nullif(btrim(p_title), ''), source_document.title || ' — Copy'),
    source_document.school_year,
    source_document.academic_period_label,
    coalesce(p_instructions, source_assessment.instructions),
    'draft',
    source_document.structured_content,
    copied_items,
    'Duplicated Assessment Generation V2 assessment'
  );
  return created;
end;
$$;

revoke all on function public.duplicate_assessment_document_v2(uuid, text, text) from public;
grant execute on function public.duplicate_assessment_document_v2(uuid, text, text) to authenticated;
