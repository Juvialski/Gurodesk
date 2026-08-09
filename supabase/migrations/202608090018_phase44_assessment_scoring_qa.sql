-- GuroDesk Phase 4.4: typed assessment payloads, derived scoring, and
-- bounded per-item QA history.  This migration is additive: Phase 4.1
-- columns/functions remain available for legacy one-point assessments.

alter table public.assessment_documents
  add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.assessment_documents
  drop constraint if exists assessment_documents_settings_object;
alter table public.assessment_documents
  add constraint assessment_documents_settings_object
  check (jsonb_typeof(settings) = 'object');

alter table public.assessment_items
  add column if not exists points_possible numeric(10,2);
alter table public.assessment_items
  add column if not exists qa_state text not null default 'empty';
alter table public.assessment_items
  add column if not exists locked boolean not null default false;
alter table public.assessment_items
  add column if not exists version_history jsonb not null default '[]'::jsonb;

update public.assessment_items
set points_possible = coalesce(points, 1)
where points_possible is null;

alter table public.assessment_items
  alter column points_possible set default 1,
  alter column points_possible set not null;
alter table public.assessment_items
  drop constraint if exists assessment_items_points_possible_nonnegative;
alter table public.assessment_items
  add constraint assessment_items_points_possible_nonnegative
  check (points_possible >= 0 and points_possible <> 'NaN'::numeric);
alter table public.assessment_items
  drop constraint if exists assessment_items_qa_state_valid;
alter table public.assessment_items
  add constraint assessment_items_qa_state_valid
  check (qa_state in ('empty', 'generated', 'verified', 'needs_review', 'teacher_edited', 'answer_needs_recheck', 'locked', 'repair_needed'));
alter table public.assessment_items
  drop constraint if exists assessment_items_version_history_array;
alter table public.assessment_items
  add constraint assessment_items_version_history_array
  check (jsonb_typeof(version_history) = 'array' and jsonb_array_length(version_history) <= 5);

create index if not exists idx_assessment_items_document_qa
  on public.assessment_items(assessment_document_id, qa_state, locked);

create or replace function public.sync_assessment_item_scoring_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Phase 4.1 callers only send `points`; newer callers send both fields.
  -- Treat the legacy value as authoritative when it is the only non-default
  -- value, and keep both columns equal for old read paths.
  if new.points_possible is null then
    new.points_possible := coalesce(new.points, 1);
  elsif coalesce(new.points, 1) <> 1 and new.points_possible = 1 then
    new.points_possible := new.points;
  end if;
  new.points := new.points_possible;
  if new.version_history is null or jsonb_typeof(new.version_history) is distinct from 'array' then
    new.version_history := '[]'::jsonb;
  elsif jsonb_array_length(new.version_history) > 5 then
    new.version_history := (
      select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
      from jsonb_array_elements(new.version_history) with ordinality
      where ordinality > jsonb_array_length(new.version_history) - 5
    );
  end if;
  if new.locked then new.qa_state := 'locked'; end if;
  return new;
end;
$$;

drop trigger if exists assessment_item_scoring_sync on public.assessment_items;
create trigger assessment_item_scoring_sync
before insert or update on public.assessment_items
for each row execute function public.sync_assessment_item_scoring_fields();

-- Strict structural validation is intentionally deterministic.  It does not
-- attempt to decide whether a subjective response is pedagogically correct.
create or replace function public.assessment_item_content_valid(
  p_question_type public.assessment_question_type,
  p_prompt text,
  p_choices jsonb,
  p_answer jsonb,
  p_authorship public.assessment_authorship_state
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  choice_value jsonb;
  prompt_value jsonb;
  mapping_value jsonb;
  blank_value jsonb;
  idx integer;
  key text;
  seen text[] := array[]::text[];
  seen_texts text[] := array[]::text[];
  accepted jsonb;
  answer_key text;
  prompt_ids text[] := array[]::text[];
  choice_ids text[] := array[]::text[];
  mapped_prompts text[] := array[]::text[];
  mapped_choices text[] := array[]::text[];
begin
  if p_authorship = 'empty' then
    return coalesce(btrim(p_prompt), '') = ''
      and jsonb_array_length(coalesce(p_choices, '[]'::jsonb)) = 0
      and jsonb_typeof(coalesce(p_answer, '{}'::jsonb)) = 'object';
  end if;
  if coalesce(btrim(p_prompt), '') = ''
     or jsonb_typeof(coalesce(p_answer, '{}'::jsonb)) <> 'object'
     or p_answer ->> 'type' <> p_question_type::text then return false; end if;

  if p_question_type = 'multiple_choice' then
    if jsonb_typeof(coalesce(p_answer -> 'choices', p_choices)) is distinct from 'array'
       or jsonb_array_length(coalesce(p_answer -> 'choices', p_choices)) not between 2 and 6 then return false; end if;
    for choice_value in select value from jsonb_array_elements(coalesce(p_answer -> 'choices', p_choices)) loop
      key := btrim(choice_value ->> 'id');
      if jsonb_typeof(choice_value) is distinct from 'object' or key is null or key = '' or btrim(choice_value ->> 'text') is null or btrim(choice_value ->> 'text') = '' or lower(key) = any(seen) or lower(btrim(choice_value ->> 'text')) = any(seen_texts) then return false; end if;
      seen := array_append(seen, lower(key)); seen_texts := array_append(seen_texts, lower(btrim(choice_value ->> 'text')));
    end loop;
    return coalesce(btrim(p_answer ->> 'choiceId') <> '' and exists (select 1 from jsonb_array_elements(coalesce(p_answer -> 'choices', p_choices)) c where c ->> 'id' = p_answer ->> 'choiceId'), false);
  elsif p_question_type = 'true_false' then
    return jsonb_typeof(p_answer -> 'value') is not distinct from 'boolean';
  elsif p_question_type in ('short_answer', 'identification') then
    accepted := p_answer -> 'acceptedAnswers';
    if jsonb_typeof(accepted) is distinct from 'array' or jsonb_array_length(accepted) < 1 then return false; end if;
    if p_answer ? 'caseSensitive' and jsonb_typeof(p_answer -> 'caseSensitive') is distinct from 'boolean' then return false; end if;
    for idx in 0..jsonb_array_length(accepted) - 1 loop
      if jsonb_typeof(accepted -> idx) is distinct from 'string' or btrim(accepted ->> idx) is null or btrim(accepted ->> idx) = '' then return false; end if;
      answer_key := case when coalesce((p_answer ->> 'caseSensitive')::boolean, false) then btrim(accepted ->> idx) else lower(btrim(accepted ->> idx)) end;
      if answer_key = any(seen) then return false; end if;
      seen := array_append(seen, answer_key);
    end loop;
    return true;
  elsif p_question_type = 'fill_in_the_blank' then
    if jsonb_typeof(p_answer -> 'blanks') is distinct from 'array' or jsonb_array_length(p_answer -> 'blanks') < 1 then return false; end if;
    for blank_value in select value from jsonb_array_elements(p_answer -> 'blanks') loop
      key := btrim(blank_value ->> 'id'); accepted := blank_value -> 'acceptedAnswers';
      if key is null or key = '' or key = any(seen) or jsonb_typeof(accepted) is distinct from 'array' or jsonb_array_length(accepted) < 1 then return false; end if;
      if blank_value ? 'caseSensitive' and jsonb_typeof(blank_value -> 'caseSensitive') is distinct from 'boolean' then return false; end if;
      seen := array_append(seen, key);
      if exists (select 1 from jsonb_array_elements(accepted) a where jsonb_typeof(a) is distinct from 'string' or btrim(a #>> '{}') is null or btrim(a #>> '{}') = '') then return false; end if;
    end loop;
    return true;
  elsif p_question_type = 'numerical_answer' then
    return jsonb_typeof(p_answer -> 'value') is not distinct from 'number'
      and (not (p_answer ? 'tolerance') or jsonb_typeof(p_answer -> 'tolerance') = 'number')
      and coalesce((p_answer ->> 'tolerance')::numeric, 0) >= 0
      and (not (p_answer ? 'unit') or jsonb_typeof(p_answer -> 'unit') = 'string')
      and (not (p_answer ? 'requireUnit') or jsonb_typeof(p_answer -> 'requireUnit') = 'boolean')
      and (not coalesce((p_answer ->> 'requireUnit')::boolean, false) or char_length(btrim(coalesce(p_answer ->> 'unit', ''))) > 0);
  elsif p_question_type = 'problem_solving' then
    if not coalesce(jsonb_typeof(p_answer -> 'finalAnswer') in ('string', 'number'), false)
       or (jsonb_typeof(p_answer -> 'finalAnswer') = 'string' and char_length(btrim(p_answer ->> 'finalAnswer')) = 0)
       or jsonb_typeof(p_answer -> 'solutionOutline') is distinct from 'string'
       or char_length(btrim(coalesce(p_answer ->> 'solutionOutline', ''))) = 0
       or (p_answer ? 'subparts' and jsonb_typeof(p_answer -> 'subparts') <> 'array') then return false; end if;
    seen := array[]::text[];
    for prompt_value in select value from jsonb_array_elements(coalesce(p_answer -> 'subparts', '[]'::jsonb)) loop
      key := btrim(prompt_value ->> 'id');
      if jsonb_typeof(prompt_value) is distinct from 'object' or key is null or key = '' or key = any(seen)
         or char_length(btrim(coalesce(prompt_value ->> 'prompt', ''))) = 0 then return false; end if;
      seen := array_append(seen, key);
    end loop;
    return true;
  elsif p_question_type = 'matching' then
    if jsonb_typeof(p_answer -> 'prompts') is distinct from 'array' or jsonb_array_length(p_answer -> 'prompts') < 1
       or jsonb_typeof(p_answer -> 'choices') is distinct from 'array' or jsonb_array_length(p_answer -> 'choices') < jsonb_array_length(p_answer -> 'prompts')
       or jsonb_typeof(p_answer -> 'mappings') is distinct from 'array' or jsonb_array_length(p_answer -> 'mappings') <> jsonb_array_length(p_answer -> 'prompts') then return false; end if;
    for prompt_value in select value from jsonb_array_elements(p_answer -> 'prompts') loop
      key := btrim(prompt_value ->> 'id'); if jsonb_typeof(prompt_value) is distinct from 'object' or key is null or key = '' or key = any(prompt_ids) or btrim(prompt_value ->> 'text') is null or btrim(prompt_value ->> 'text') = '' then return false; end if; prompt_ids := array_append(prompt_ids, key);
    end loop;
    for choice_value in select value from jsonb_array_elements(p_answer -> 'choices') loop
      key := btrim(choice_value ->> 'id'); if jsonb_typeof(choice_value) is distinct from 'object' or key is null or key = '' or key = any(choice_ids) or btrim(choice_value ->> 'text') is null or btrim(choice_value ->> 'text') = '' or lower(btrim(choice_value ->> 'text')) = any(seen_texts) then return false; end if; choice_ids := array_append(choice_ids, key); seen_texts := array_append(seen_texts, lower(btrim(choice_value ->> 'text')));
    end loop;
    if p_answer ? 'reusableChoices' and jsonb_typeof(p_answer -> 'reusableChoices') is distinct from 'boolean' then return false; end if;
    for mapping_value in select value from jsonb_array_elements(p_answer -> 'mappings') loop
      key := btrim(mapping_value ->> 'promptId'); if jsonb_typeof(mapping_value) is distinct from 'object' or key is null or not (key = any(prompt_ids)) or key = any(mapped_prompts) or btrim(mapping_value ->> 'choiceId') is null or not (btrim(mapping_value ->> 'choiceId') = any(choice_ids)) then return false; end if;
      if not coalesce((p_answer ->> 'reusableChoices')::boolean, false) and btrim(mapping_value ->> 'choiceId') = any(mapped_choices) then return false; end if;
      mapped_prompts := array_append(mapped_prompts, key); mapped_choices := array_append(mapped_choices, btrim(mapping_value ->> 'choiceId'));
    end loop;
    return true;
  elsif p_question_type = 'multiple_select' then
    if jsonb_typeof(p_answer -> 'choices') is distinct from 'array' or jsonb_array_length(p_answer -> 'choices') < 2
       or jsonb_typeof(p_answer -> 'choiceIds') is distinct from 'array' or jsonb_array_length(p_answer -> 'choiceIds') < 1 then return false; end if;
    for choice_value in select value from jsonb_array_elements(p_answer -> 'choices') loop
      key := btrim(choice_value ->> 'id'); if jsonb_typeof(choice_value) is distinct from 'object' or key is null or key = '' or key = any(choice_ids) or btrim(choice_value ->> 'text') is null or btrim(choice_value ->> 'text') = '' or lower(btrim(choice_value ->> 'text')) = any(seen_texts) then return false; end if; choice_ids := array_append(choice_ids, key); seen_texts := array_append(seen_texts, lower(btrim(choice_value ->> 'text')));
    end loop;
    for choice_value in select value from jsonb_array_elements(p_answer -> 'choiceIds') loop
      key := btrim(choice_value #>> '{}'); if jsonb_typeof(choice_value) is distinct from 'string' or key is null or key = '' or not (key = any(choice_ids)) or key = any(mapped_choices) then return false; end if; mapped_choices := array_append(mapped_choices, key);
    end loop;
    if p_answer ? 'scoringPolicy' and p_answer ->> 'scoringPolicy' <> 'all_or_nothing' then return false; end if;
    return true;
  elsif p_question_type = 'essay' then
    return jsonb_typeof(p_answer -> 'keyPoints') is not distinct from 'array'
      and jsonb_array_length(p_answer -> 'keyPoints') > 0
      and not exists (select 1 from jsonb_array_elements(p_answer -> 'keyPoints') p where jsonb_typeof(p) is distinct from 'string' or btrim(p #>> '{}') is null or btrim(p #>> '{}') = '');
  elsif p_question_type = 'constructed_response' then
    return jsonb_typeof(p_answer -> 'expectedResponse') is not distinct from 'string'
      and char_length(btrim(p_answer ->> 'expectedResponse')) > 0
      and jsonb_typeof(coalesce(p_answer -> 'sampleResponse', '""'::jsonb)) is not distinct from 'string'
      and char_length(btrim(coalesce(p_answer ->> 'sampleResponse', ''))) > 0;
  end if;
  return false;
exception when others then
  return false;
end;
$$;

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
  )
$$;

create or replace function public.assessment_item_point_structure_valid(
  p_question_type public.assessment_question_type,
  p_points_possible numeric,
  p_answer jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  entry jsonb;
  value_numeric numeric;
  explicit_total numeric := 0;
  has_explicit boolean := false;
  missing_explicit integer := 0;
  entry_count integer := 0;
  seen_ids text[] := array[]::text[];
begin
  if p_points_possible is null or p_points_possible <= 0 or p_points_possible::text = 'NaN' then return false; end if;
  if p_question_type = 'fill_in_the_blank' then
    for entry in select value from jsonb_array_elements(coalesce(p_answer -> 'blanks', '[]'::jsonb)) loop
      entry_count := entry_count + 1;
      if entry ? 'pointsPossible' then
        has_explicit := true;
        if jsonb_typeof(entry -> 'pointsPossible') <> 'number' then return false; end if;
        value_numeric := (entry ->> 'pointsPossible')::numeric;
        if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' then return false; end if;
        explicit_total := explicit_total + value_numeric;
      else
        missing_explicit := missing_explicit + 1;
      end if;
    end loop;
    if has_explicit and (missing_explicit > 0 or abs(explicit_total - p_points_possible) > 0.000001) then return false; end if;
  elsif p_question_type = 'problem_solving' then
    if p_answer ? 'subparts' then
      if jsonb_typeof(p_answer -> 'subparts') <> 'array' then return false; end if;
      explicit_total := 0; has_explicit := false; missing_explicit := 0; entry_count := 0;
      for entry in select value from jsonb_array_elements(p_answer -> 'subparts') loop
        entry_count := entry_count + 1;
        if jsonb_typeof(entry) is distinct from 'object' or coalesce(btrim(entry ->> 'id'), '') = ''
           or btrim(entry ->> 'id') = any(seen_ids) or coalesce(btrim(entry ->> 'prompt'), '') = '' then return false; end if;
        seen_ids := array_append(seen_ids, btrim(entry ->> 'id'));
        if not (entry ? 'pointsPossible') then missing_explicit := missing_explicit + 1;
        else
          has_explicit := true;
          if jsonb_typeof(entry -> 'pointsPossible') <> 'number' then return false; end if;
          value_numeric := (entry ->> 'pointsPossible')::numeric;
          if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' then return false; end if;
          explicit_total := explicit_total + value_numeric;
        end if;
      end loop;
      if entry_count > 0 and (not has_explicit or missing_explicit > 0 or abs(explicit_total - p_points_possible) > 0.000001) then return false; end if;
    end if;
    if p_answer ? 'scoringCriteria' then
      if jsonb_typeof(p_answer -> 'scoringCriteria') <> 'array' then return false; end if;
      explicit_total := 0; has_explicit := false; missing_explicit := 0; entry_count := 0; seen_ids := array[]::text[];
      for entry in select value from jsonb_array_elements(p_answer -> 'scoringCriteria') loop
        entry_count := entry_count + 1;
        if jsonb_typeof(entry) is distinct from 'object' or coalesce(btrim(entry ->> 'id'), '') = ''
           or btrim(entry ->> 'id') = any(seen_ids) or coalesce(btrim(entry ->> 'label'), '') = '' then return false; end if;
        seen_ids := array_append(seen_ids, btrim(entry ->> 'id'));
        if not (entry ? 'pointsPossible') then missing_explicit := missing_explicit + 1;
        else
          has_explicit := true;
          if jsonb_typeof(entry -> 'pointsPossible') <> 'number' then return false; end if;
          value_numeric := (entry ->> 'pointsPossible')::numeric;
          if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' then return false; end if;
          explicit_total := explicit_total + value_numeric;
        end if;
      end loop;
      if entry_count > 0 and (not has_explicit or missing_explicit > 0 or abs(explicit_total - p_points_possible) > 0.000001) then return false; end if;
    end if;
  elsif p_question_type = 'matching' then
    if p_answer ? 'mappings' and jsonb_typeof(p_answer -> 'mappings') = 'array' then
      explicit_total := 0; has_explicit := false; missing_explicit := 0; entry_count := 0;
      for entry in select value from jsonb_array_elements(p_answer -> 'mappings') loop
        entry_count := entry_count + 1;
        if not (entry ? 'pointsPossible') then missing_explicit := missing_explicit + 1;
        else
          has_explicit := true;
          if jsonb_typeof(entry -> 'pointsPossible') <> 'number' then return false; end if;
          value_numeric := (entry ->> 'pointsPossible')::numeric;
          if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' then return false; end if;
          explicit_total := explicit_total + value_numeric;
        end if;
      end loop;
      if has_explicit and (missing_explicit > 0 or abs(explicit_total - p_points_possible) > 0.000001) then return false; end if;
    end if;
    if p_answer ? 'pointsPerMatch' then
      if jsonb_typeof(p_answer -> 'pointsPerMatch') <> 'number' then return false; end if;
      value_numeric := (p_answer ->> 'pointsPerMatch')::numeric;
      if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' then return false; end if;
      if jsonb_typeof(p_answer -> 'mappings') <> 'array' or abs(value_numeric * jsonb_array_length(p_answer -> 'mappings') - p_points_possible) > 0.000001 then return false; end if;
    end if;
    if p_answer ? 'groupPointsPossible' then
      if jsonb_typeof(p_answer -> 'groupPointsPossible') <> 'number' then return false; end if;
      value_numeric := (p_answer ->> 'groupPointsPossible')::numeric;
      if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' or abs(value_numeric - p_points_possible) > 0.000001 then return false; end if;
    end if;
  elsif p_question_type in ('constructed_response', 'essay') then
    if p_answer ? 'rubric' then
      if jsonb_typeof(p_answer -> 'rubric') <> 'array' then return false; end if;
      explicit_total := 0; has_explicit := false; missing_explicit := 0; entry_count := 0; seen_ids := array[]::text[];
      for entry in select value from jsonb_array_elements(p_answer -> 'rubric') loop
        entry_count := entry_count + 1;
        if jsonb_typeof(entry) is distinct from 'object' or coalesce(btrim(entry ->> 'id'), '') = ''
           or btrim(entry ->> 'id') = any(seen_ids) or coalesce(btrim(entry ->> 'label'), '') = '' then return false; end if;
        seen_ids := array_append(seen_ids, btrim(entry ->> 'id'));
        if not (entry ? 'pointsPossible') then missing_explicit := missing_explicit + 1;
        else
          has_explicit := true;
          if jsonb_typeof(entry -> 'pointsPossible') <> 'number' then return false; end if;
          value_numeric := (entry ->> 'pointsPossible')::numeric;
          if value_numeric is null or value_numeric <= 0 or value_numeric::text = 'NaN' then return false; end if;
          explicit_total := explicit_total + value_numeric;
        end if;
      end loop;
      if entry_count > 0 and (not has_explicit or missing_explicit > 0 or abs(explicit_total - p_points_possible) > 0.000001) then return false; end if;
    end if;
  end if;
  return true;
exception when others then
  return false;
end;
$$;

-- Keep the Phase 4.1 entry point under a private compatibility name so old
-- installed clients cannot bypass the expanded save contract.  The public
-- function below is authoritative for both legacy and typed assessments.
alter function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text)
  rename to save_assessment_document_legacy_phase41;

create or replace function public.save_assessment_document(
  p_document_id uuid,
  p_assignment_id uuid,
  p_source_tos_document_id uuid,
  p_title text,
  p_school_year text,
  p_academic_period_label text,
  p_instructions text,
  p_status text,
  p_structured_content jsonb,
  p_items jsonb,
  p_change_note text default 'Teacher saved assessment'
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
    select 1 from public.teacher_assignments ta where ta.id = p_assignment_id and ta.user_id = owner_id
  ) then raise exception 'A teacher-owned assignment is required'; end if;

  -- All normalized assessment writes, including creation of the base document,
  -- are gated by the existing server-managed write trigger.
  perform set_config('app.assessment_rpc', '1', true);

  -- For an existing document this owner-scoped lookup happens before any
  -- locked-item loop.  SECURITY DEFINER must not expose whether another
  -- teacher's assessment has locked rows.
  if p_document_id is not null then
    select * into saved from public.documents
    where id = p_document_id and user_id = owner_id and document_type = 'assessment'
    for update;
    if saved.id is null then raise exception 'Assessment document not found'; end if;
    if saved.status <> 'draft' then raise exception 'Only draft assessment documents can be edited'; end if;
    select * into assessment_row from public.assessment_documents
    where document_id = saved.id for update;
    if assessment_row.document_id is null then raise exception 'Assessment metadata is missing'; end if;
    if p_assignment_id is distinct from assessment_row.assignment_id
       or p_source_tos_document_id is distinct from assessment_row.source_tos_document_id then
      raise exception 'Assessment assignment and source cannot change';
    end if;
    if item_count <> assessment_row.total_items then raise exception 'Assessment items must preserve the source TOS total'; end if;
    if (select count(distinct value ->> 'id') from jsonb_array_elements(p_items)) <> item_count then
      raise exception 'Assessment item UUIDs must be unique within a saved assessment';
    end if;
    for existing_item in
      select ai.* from public.assessment_items ai
      where ai.assessment_document_id = saved.id and ai.locked
      for update
    loop
      select value into incoming_item
      from jsonb_array_elements(p_items) value
      where (value ->> 'id')::uuid = existing_item.id limit 1;
      if incoming_item is null then raise exception 'Locked assessment item is missing from the save payload'; end if;
      if coalesce((incoming_item ->> 'locked')::boolean, true)
         and (coalesce(incoming_item ->> 'prompt', '') is distinct from existing_item.prompt
           or coalesce(incoming_item -> 'answer', '{}'::jsonb) is distinct from existing_item.answer
           or coalesce(nullif(incoming_item ->> 'questionType', ''), 'multiple_choice') is distinct from existing_item.question_type::text
           or coalesce(nullif(incoming_item ->> 'pointsPossible', '')::numeric, nullif(incoming_item ->> 'points', '')::numeric, 1) is distinct from existing_item.points_possible
           or coalesce(incoming_item ->> 'rationale', '') is distinct from existing_item.rationale
           or coalesce(incoming_item ->> 'teacherNotes', '') is distinct from existing_item.teacher_notes) then
        raise exception 'Locked assessment item cannot be changed until explicitly unlocked';
      end if;
    end loop;
    if exists (
      select 1 from public.assessment_items existing_item
      where existing_item.assessment_document_id = saved.id
        and not exists (
          select 1 from jsonb_array_elements(p_items) incoming_item
          where (incoming_item ->> 'itemNumber')::integer = existing_item.item_number
            and (incoming_item ->> 'id')::uuid = existing_item.id
        )
    ) then raise exception 'Existing assessment item UUIDs are stable and cannot change on draft save'; end if;
    source_total_items := assessment_row.total_items;
    source_max_version := assessment_row.source_tos_version_number;
    update public.documents set
      title = coalesce(nullif(btrim(p_title), ''), title),
      school_year = assessment_row.source_tos_content_snapshot ->> 'schoolYear',
      academic_period_label = nullif(assessment_row.source_tos_content_snapshot ->> 'gradingTermLabel', ''),
      status = 'draft', structured_content = coalesce(p_structured_content, '{}'::jsonb)
    where id = saved.id returning * into saved;
    update public.assessment_documents set
      instructions = coalesce(p_instructions, instructions),
      settings = case when jsonb_typeof(p_structured_content -> 'settings') = 'object' then p_structured_content -> 'settings' else settings end
    where document_id = saved.id returning * into assessment_row;
    delete from public.assessment_items where assessment_document_id = saved.id;
  else
    select * into source_row from public.documents where id = p_source_tos_document_id for share;
    if source_row.id is null or source_row.user_id is distinct from owner_id
       or source_row.document_type <> 'tos'
       or (source_row.status <> 'final' and coalesce(current_setting('app.assessment_duplicate_rpc', true), '') <> '1')
       or source_row.assignment_id is distinct from p_assignment_id then
      raise exception 'A finalized teacher-owned TOS for the same assignment is required';
    end if;
    select coalesce(max(version_number), 0) into source_max_version from public.document_versions where document_id = source_row.id;
    if source_max_version <= 0 then raise exception 'The finalized TOS has no immutable version snapshot'; end if;
    source_total_items := (source_row.structured_content ->> 'totalItems')::integer;
    if source_total_items is null or source_total_items < 1 or source_total_items > 10000 then raise exception 'The finalized TOS has no supported total item count'; end if;
    if item_count <> source_total_items then raise exception 'Assessment items must exactly match the finalized TOS total'; end if;
    source_canonical_content := public.assessment_canonical_tos_snapshot(source_row.id);
    insert into public.documents (
      user_id, assignment_id, document_type, title, school_year, academic_period_label, status, structured_content
    ) values (
      owner_id, p_assignment_id, 'assessment', coalesce(nullif(btrim(p_title), ''), 'Untitled assessment'),
      source_canonical_content ->> 'schoolYear', nullif(source_canonical_content ->> 'gradingTermLabel', ''), 'draft', coalesce(p_structured_content, '{}'::jsonb)
    ) returning * into saved;
    insert into public.assessment_documents (
      document_id, user_id, assignment_id, source_tos_document_id, source_tos_version_number,
      source_tos_content_snapshot, source_tos_raw_content_snapshot, total_items, instructions, settings
    ) values (
      saved.id, owner_id, p_assignment_id, source_row.id, source_max_version,
      source_canonical_content, source_row.structured_content, source_total_items, coalesce(p_instructions, ''),
      case when jsonb_typeof(p_structured_content -> 'settings') = 'object' then p_structured_content -> 'settings' else '{}'::jsonb end
    ) returning * into assessment_row;
  end if;

  for item_value in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item_value) is distinct from 'object' then raise exception 'Assessment item must be an object'; end if;
    item_number := (item_value ->> 'itemNumber')::integer;
    if item_number is null or item_number <> expected_number then raise exception 'Assessment item numbers must be exactly contiguous from 1'; end if;
    expected_number := expected_number + 1;
    item_id := (item_value ->> 'id')::uuid;
    if item_id is null then raise exception 'Assessment item IDs must be stable UUIDs'; end if;
    item_competency_id := (item_value -> 'competencySnapshot' ->> 'id')::uuid;
    item_tos_row_id := (item_value -> 'mapping' ->> 'rowId')::uuid;
    item_cognitive_category_id := item_value -> 'cognitiveCategorySnapshot' ->> 'id';
    item_cognitive_category_label := item_value -> 'cognitiveCategorySnapshot' ->> 'label';
    item_cognitive_category_short_label := item_value -> 'cognitiveCategorySnapshot' ->> 'shortLabel';
    if item_competency_id is null or item_tos_row_id is null
       or coalesce(btrim(item_value -> 'competencySnapshot' ->> 'text'), '') = ''
       or coalesce(btrim(item_cognitive_category_id), '') = ''
       or coalesce(btrim(item_cognitive_category_label), '') = ''
       or coalesce(btrim(item_cognitive_category_short_label), '') = '' then
      raise exception 'Assessment item curriculum and cognitive snapshots are required';
    end if;
    if (item_value ->> 'questionType') not in ('multiple_choice', 'true_false', 'short_answer', 'constructed_response', 'identification', 'fill_in_the_blank', 'numerical_answer', 'problem_solving', 'matching', 'multiple_select', 'essay') then
      raise exception 'Unsupported assessment question type';
    end if;
    item_question_type := (item_value ->> 'questionType')::public.assessment_question_type;
    if (item_value ->> 'authorshipState') not in ('empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual') then raise exception 'Unsupported assessment authorship state'; end if;
    item_authorship := (item_value ->> 'authorshipState')::public.assessment_authorship_state;
    if jsonb_typeof(coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb)) is distinct from 'array'
       or jsonb_typeof(coalesce(item_value -> 'answer', '{}'::jsonb)) is distinct from 'object' then raise exception 'Assessment choices and answer must be JSON structures'; end if;
    item_points := coalesce(nullif(item_value ->> 'pointsPossible', '')::numeric, nullif(item_value ->> 'points', '')::numeric, 1);
    if item_points is null or item_points < 0 or item_points::text = 'NaN' then raise exception 'Assessment item points must be a finite nonnegative number'; end if;
    if item_authorship = 'empty' and coalesce(btrim(item_value ->> 'prompt'), '') <> '' then raise exception 'Empty assessment items cannot contain a prompt'; end if;
    if char_length(coalesce(item_value ->> 'prompt', '')) > 40000
       or octet_length(coalesce((item_value -> 'answer')::text, '')) > 256 * 1024
       or char_length(coalesce(item_value ->> 'rationale', '')) > 20000
       or char_length(coalesce(item_value ->> 'teacherNotes', '')) > 20000
       or octet_length(coalesce((item_value -> 'history')::text, '[]')) > 1024 * 1024 then
      raise exception 'Assessment item content exceeds the supported save limit';
    end if;
    if jsonb_typeof(item_value -> 'history') is not null and jsonb_typeof(item_value -> 'history') <> 'array' then raise exception 'Assessment item history must be an array'; end if;
    if jsonb_array_length(coalesce(item_value -> 'history', '[]'::jsonb)) > 5 then raise exception 'Assessment item history is limited to five versions'; end if;
    if item_value ->> 'qaState' is not null and item_value ->> 'qaState' not in ('empty', 'generated', 'verified', 'needs_review', 'teacher_edited', 'answer_needs_recheck', 'locked', 'repair_needed') then raise exception 'Unsupported assessment QA state'; end if;
    insert into public.assessment_items (
      id, assessment_document_id, item_number, canonical_competency_id, competency_code_snapshot,
      competency_text_snapshot, competency_source_page_snapshot, competency_academic_period_id_snapshot,
      competency_curriculum_period_id_snapshot, competency_period_label_snapshot, tos_row_id,
      allocation_item_start, allocation_item_end, allocation_index, cognitive_category_id,
      cognitive_category_label_snapshot, cognitive_category_short_label_snapshot, question_type, prompt,
      choices, answer, points, points_possible, rationale, teacher_notes, authorship_state,
      qa_state, locked, version_history
    ) values (
      item_id, saved.id, item_number, item_competency_id, nullif(item_value -> 'competencySnapshot' ->> 'code', ''),
      item_value -> 'competencySnapshot' ->> 'text', (item_value -> 'competencySnapshot' ->> 'sourcePage')::integer,
      item_value -> 'competencySnapshot' ->> 'academicPeriodId', item_value -> 'competencySnapshot' ->> 'curriculumPeriodId',
      coalesce(item_value -> 'competencySnapshot' ->> 'curriculumPeriodLabel', ''), item_tos_row_id,
      (item_value -> 'mapping' ->> 'allocationItemStart')::integer, (item_value -> 'mapping' ->> 'allocationItemEnd')::integer,
      (item_value -> 'mapping' ->> 'allocationIndex')::integer, item_cognitive_category_id,
      item_cognitive_category_label, item_cognitive_category_short_label, item_question_type,
      coalesce(item_value ->> 'prompt', ''), coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb),
      coalesce(item_value -> 'answer', '{}'::jsonb), item_points, item_points,
      coalesce(item_value ->> 'rationale', ''), coalesce(item_value ->> 'teacherNotes', ''), item_authorship,
      case when coalesce((item_value ->> 'locked')::boolean, false) then 'locked' else coalesce(nullif(item_value ->> 'qaState', ''), 'empty') end,
      coalesce((item_value ->> 'locked')::boolean, false), coalesce(item_value -> 'history', '[]'::jsonb)
    );
  end loop;
  if expected_number <> source_total_items + 1 then raise exception 'Assessment item numbering is incomplete'; end if;

  -- Every save retains the finalized TOS placement; question format and score
  -- may change, but the item/competency/cognitive allocation cannot.
  select exists (
    select 1 from public.assessment_items ai
    where ai.assessment_document_id = saved.id
      and not exists (
        select 1 from public.tos_competencies tc
        where tc.document_id = assessment_row.source_tos_document_id
          and tc.competency_id = ai.canonical_competency_id
          and ai.item_number between tc.item_start and tc.item_end
          and exists (
            select 1 from jsonb_array_elements(tc.cognitive_allocations) allocation
            where allocation ->> 'categoryId' = ai.cognitive_category_id
              and ai.item_number between (allocation ->> 'itemStart')::integer and (allocation ->> 'itemEnd')::integer
              and allocation ->> 'label' = ai.cognitive_category_label_snapshot
          )
      )
  ) into bad;
  if bad then raise exception 'Assessment item mappings do not match the finalized TOS ranges'; end if;

  select count(*) into canonical_count from public.assessment_items ai where ai.assessment_document_id = saved.id;
  if canonical_count <> source_total_items then raise exception 'Assessment item total is not exact'; end if;
  if p_status = 'final' then
    if saved.status <> 'draft' then raise exception 'Only draft assessments can be finalized'; end if;
    if exists (select 1 from public.assessment_items ai where ai.assessment_document_id = saved.id and ai.authorship_state in ('empty', 'ai_suggestion')) then raise exception 'Final assessment requires every item to be teacher-accepted, edited, or manual'; end if;
    if exists (select 1 from public.assessment_items ai where ai.assessment_document_id = saved.id and ai.points_possible <= 0) then raise exception 'Final assessment requires positive points for every item'; end if;
    -- QA review states are quality warnings, not structural validity failures.
    -- The mobile Final Test Review requires conscious teacher acknowledgement,
    -- while the server continues to block invalid answers, scoring, mappings,
    -- disabled types, and unaccepted AI suggestions below.
    select exists (select 1 from public.assessment_items ai where ai.assessment_document_id = saved.id and not public.assessment_item_content_valid(ai.question_type, ai.prompt, ai.choices, ai.answer, ai.authorship_state)) into bad;
    if bad then raise exception 'Final assessment contains invalid question content'; end if;
    select exists (select 1 from public.assessment_items ai where ai.assessment_document_id = saved.id and not public.assessment_item_point_structure_valid(ai.question_type, ai.points_possible, ai.answer)) into bad;
    if bad then raise exception 'Final assessment item point structure does not reconcile with pointsPossible'; end if;
    if exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and jsonb_typeof(assessment_row.settings -> 'allowedTypes') = 'array'
        and not exists (
          select 1 from jsonb_array_elements_text(assessment_row.settings -> 'allowedTypes') allowed(value)
          where allowed.value = ai.question_type::text
        )
    ) then raise exception 'Final assessment uses a disabled question type'; end if;
    select exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and public.assessment_item_mirror(ai) is distinct from ((coalesce(p_structured_content, '{}'::jsonb) -> 'items' -> (ai.item_number - 1)))
    ) into bad;
    if bad then raise exception 'Assessment JSON and relational item projections do not match'; end if;
  end if;

  select coalesce(sum(points_possible), 0) into total_points from public.assessment_items where assessment_document_id = saved.id;
  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number), '[]'::jsonb)
    into mirror from public.assessment_items ai where ai.assessment_document_id = saved.id;
  source_content := assessment_row.source_tos_content_snapshot;
  settings_value := coalesce(assessment_row.settings, '{}'::jsonb);
  normalized_content := jsonb_build_object(
    'schemaVersion', 2, 'title', saved.title, 'assessmentTitle', saved.title,
    'instructions', assessment_row.instructions, 'assignmentId', assessment_row.assignment_id,
    'gradeLevel', source_content -> 'gradeLevel', 'learningArea', source_content -> 'learningArea',
    'schoolYear', source_content -> 'schoolYear', 'gradingTermId', source_content -> 'gradingTermId',
    'gradingTermLabel', source_content -> 'gradingTermLabel', 'curriculumVersionId', source_content -> 'curriculumVersionId',
    'curriculumVersionCode', source_content -> 'curriculumVersionCode', 'curriculumVersionName', source_content -> 'curriculumVersionName',
    'curriculumSubjectId', source_content -> 'curriculumSubjectId', 'curriculumPeriodIds', source_content -> 'curriculumPeriodIds',
    'curriculumPeriodLabels', source_content -> 'curriculumPeriodLabels', 'totalItems', assessment_row.total_items,
    'totalPoints', total_points, 'settings', settings_value,
    'sourceTos', jsonb_build_object('id', assessment_row.source_tos_document_id, 'versionNumber', assessment_row.source_tos_version_number,
      'title', source_content ->> 'title', 'status', 'final', 'assignmentId', assessment_row.assignment_id,
      'schoolYear', source_content ->> 'schoolYear', 'academicPeriodLabel', source_content ->> 'gradingTermLabel', 'content', source_content),
    'sourceTosDocumentId', assessment_row.source_tos_document_id, 'sourceTosVersionNumber', assessment_row.source_tos_version_number,
    'items', mirror
  );
  update public.documents set status = p_status, structured_content = normalized_content where id = saved.id returning * into saved;
  select coalesce(max(version_number), 0) + 1 into next_version from public.document_versions where document_id = saved.id;
  insert into public.document_versions (document_id, version_number, structured_content, change_note)
  values (saved.id, next_version, saved.structured_content, nullif(p_change_note, ''));
  return saved;
end;
$$;

revoke all on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) to authenticated;
revoke all on function public.save_assessment_document_legacy_phase41(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- Duplicate through the authoritative save path so settings, typed payloads,
-- scoring, and bounded QA metadata are retained on copied assessments as well.
create or replace function public.duplicate_assessment_document(
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
  select * into source_document from public.documents where id = p_source_document_id and user_id = owner_id and document_type = 'assessment' for share;
  if source_document.id is null then raise exception 'Assessment document not found'; end if;
  select * into source_assessment from public.assessment_documents where document_id = source_document.id;
  for item_value in select value from jsonb_array_elements(source_document.structured_content -> 'items') loop
    copied_items := copied_items || jsonb_build_array(jsonb_set(item_value, '{id}', to_jsonb(gen_random_uuid()::text), true));
  end loop;
  perform set_config('app.assessment_duplicate_rpc', '1', true);
  select * into created from public.save_assessment_document(
    null, source_assessment.assignment_id, source_assessment.source_tos_document_id,
    coalesce(nullif(btrim(p_title), ''), source_document.title || ' — Copy'), source_document.school_year,
    source_document.academic_period_label, coalesce(p_instructions, source_assessment.instructions), 'draft',
    source_document.structured_content, copied_items, 'Duplicated assessment'
  );
  return created;
end;
$$;

revoke all on function public.duplicate_assessment_document(uuid, text, text) from public;
grant execute on function public.duplicate_assessment_document(uuid, text, text) to authenticated;

comment on column public.assessment_items.points_possible is
  'Canonical derived item score denominator. Legacy points remains a synchronized compatibility mirror.';
comment on column public.assessment_items.version_history is
  'Bounded per-item history; at most five versions and never a whole-assessment copy.';
