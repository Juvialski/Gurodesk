-- GuroDesk Phase 4.1: assignment-bound assessment documents and structured items.
--
-- An assessment uses the generic documents/document_versions shell, while its
-- source snapshot and item projection stay normalized.  A source is a finalized
-- teacher-owned TOS document.  The source JSON and its maximum version are copied
-- by save_assessment_document() while holding a source row lock; later source
-- archival therefore cannot change an existing assessment.

create table if not exists public.assessment_documents (
  document_id uuid primary key references public.documents(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.teacher_assignments(id) on delete restrict,
  source_tos_document_id uuid not null references public.documents(id) on delete restrict,
  source_tos_version_number integer not null check (source_tos_version_number > 0),
  source_tos_content_snapshot jsonb not null,
  source_tos_raw_content_snapshot jsonb not null,
  total_items integer not null check (total_items between 1 and 10000),
  instructions text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_id),
  check (jsonb_typeof(source_tos_content_snapshot) = 'object'),
  check (jsonb_typeof(source_tos_raw_content_snapshot) = 'object')
);

create type public.assessment_question_type as enum (
  'multiple_choice',
  'true_false',
  'short_answer',
  'constructed_response'
);

create type public.assessment_authorship_state as enum (
  'empty',
  'ai_suggestion',
  'teacher_accepted',
  'teacher_edited',
  'manual'
);

create table if not exists public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_document_id uuid not null references public.assessment_documents(document_id) on delete restrict,
  item_number integer not null check (item_number between 1 and 10000),
  canonical_competency_id uuid not null references public.curriculum_competencies(id) on delete restrict,
  competency_code_snapshot text,
  competency_text_snapshot text not null,
  competency_source_page_snapshot integer,
  competency_academic_period_id_snapshot text,
  competency_curriculum_period_id_snapshot text,
  competency_period_label_snapshot text not null default '',
  tos_row_id uuid not null,
  allocation_item_start integer not null check (allocation_item_start > 0),
  allocation_item_end integer not null check (allocation_item_end >= allocation_item_start),
  allocation_index integer not null check (allocation_index >= 0),
  cognitive_category_id text not null,
  cognitive_category_label_snapshot text not null,
  cognitive_category_short_label_snapshot text not null default '',
  question_type public.assessment_question_type not null,
  prompt text not null default '',
  choices jsonb not null default '[]'::jsonb,
  answer jsonb not null default '{}'::jsonb,
  points numeric(10,2) not null default 1 check (points >= 0),
  rationale text not null default '',
  teacher_notes text not null default '',
  authorship_state public.assessment_authorship_state not null default 'empty',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_document_id, item_number),
  check (jsonb_typeof(choices) = 'array'),
  check (jsonb_typeof(answer) = 'object')
);

create index if not exists idx_assessment_documents_user_updated
  on public.assessment_documents(user_id, updated_at desc);
create index if not exists idx_assessment_documents_assignment
  on public.assessment_documents(user_id, assignment_id, updated_at desc);
create index if not exists idx_assessment_documents_source
  on public.assessment_documents(user_id, source_tos_document_id);
create index if not exists idx_assessment_items_document_number
  on public.assessment_items(assessment_document_id, item_number);
create index if not exists idx_assessment_items_competency
  on public.assessment_items(canonical_competency_id);
create index if not exists idx_assessment_items_authorship
  on public.assessment_items(assessment_document_id, authorship_state);

drop trigger if exists assessment_documents_set_updated_at on public.assessment_documents;
create trigger assessment_documents_set_updated_at
before update on public.assessment_documents
for each row execute function public.set_updated_at();
drop trigger if exists assessment_items_set_updated_at on public.assessment_items;
create trigger assessment_items_set_updated_at
before update on public.assessment_items
for each row execute function public.set_updated_at();

alter table public.assessment_documents enable row level security;
alter table public.assessment_items enable row level security;

drop policy if exists assessment_documents_select_own on public.assessment_documents;
create policy assessment_documents_select_own on public.assessment_documents
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists assessment_items_select_own on public.assessment_items;
create policy assessment_items_select_own on public.assessment_items
for select to authenticated
using (exists (
  select 1 from public.assessment_documents ad
  where ad.document_id = assessment_items.assessment_document_id
    and ad.user_id = (select auth.uid())
));

-- There are intentionally no browser insert/update/delete policies for either
-- normalized table.  Authenticated teachers use the save RPC, which validates the
-- source, assignment, immutable mappings, and draft state in one transaction.

create or replace function public.assessment_rpc_enabled()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.assessment_rpc', true), '') = '1'
$$;

create or replace function public.guard_assessment_document_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.document_type = 'assessment' then
      if new.status <> 'draft' or new.assignment_id is null or not public.assessment_rpc_enabled() then
        raise exception 'Assessment documents must begin as assignment-bound drafts through the save RPC';
      end if;
    end if;
    return new;
  end if;

  if old.document_type <> 'assessment' and new.document_type <> 'assessment' then
    return new;
  end if;
  if old.document_type is distinct from new.document_type then
    raise exception 'An assessment document type cannot be changed';
  end if;
  if old.user_id is distinct from new.user_id
     or old.assignment_id is distinct from new.assignment_id
     or old.school_year is distinct from new.school_year then
    raise exception 'Assessment ownership and assignment identity are immutable';
  end if;
  if old.status = 'archived' then
    raise exception 'Archived assessment documents are immutable';
  end if;
  if old.status = 'final' then
    if new.status <> 'archived'
       or new.id is distinct from old.id
       or new.created_at is distinct from old.created_at
       or new.structured_content is distinct from old.structured_content
       or new.title is distinct from old.title
       or new.academic_period_label is distinct from old.academic_period_label then
      raise exception 'Final assessment documents are immutable except for archiving';
    end if;
    return new;
  end if;
  if new.status = 'archived' then
    if new.id is distinct from old.id
       or new.created_at is distinct from old.created_at
       or new.structured_content is distinct from old.structured_content
       or new.title is distinct from old.title
       or new.academic_period_label is distinct from old.academic_period_label then
      raise exception 'Archiving cannot modify assessment content or identity';
    end if;
    return new;
  end if;
  if not public.assessment_rpc_enabled() then
    raise exception 'Assessment edits must use the save RPC';
  end if;
  if new.status not in ('draft', 'final') then
    raise exception 'Assessment status must be draft or final when saved';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_document_state_guard on public.documents;
create trigger assessment_document_state_guard
before insert or update on public.documents
for each row execute function public.guard_assessment_document_state();

create or replace function public.guard_assessment_document_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.document_type = 'assessment' then
    raise exception 'Assessment documents cannot be hard deleted; archive them instead';
  end if;
  return old;
end;
$$;

drop trigger if exists assessment_document_delete_guard on public.documents;
create trigger assessment_document_delete_guard
before delete on public.documents
for each row execute function public.guard_assessment_document_delete();

-- Final TOS rows are the authority for canonical competency IDs.  A local/demo
-- fallback can leave a non-UUID ID in the document JSON, while the relational TOS
-- projection has already resolved that row to a verified curriculum UUID.  Keep a
-- raw source snapshot for exact provenance and persist this server-derived
-- canonical form as the assessment's user-facing sourceTos snapshot.
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
  competency_row public.curriculum_competencies%rowtype;
  period_id text;
  canonical_rows jsonb := '[]'::jsonb;
begin
  select * into source_row from public.documents
  where id = p_source_document_id and document_type = 'tos' and status in ('final', 'archived');
  if source_row.id is null then raise exception 'Finalized TOS source not found'; end if;
  source_content := source_row.structured_content;
  if jsonb_typeof(source_content) is distinct from 'object'
     or jsonb_typeof(source_content -> 'rows') is distinct from 'array' then
    raise exception 'Finalized TOS source has no structured row projection';
  end if;
  for row_value, row_position in
    select value, ordinality::integer
    from jsonb_array_elements(source_content -> 'rows') with ordinality
  loop
    if (row_value ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Finalized TOS row IDs must be stable UUIDs';
    end if;
    select * into tos_row from public.tos_competencies
    where document_id = source_row.id and row_id = (row_value ->> 'id')::uuid;
    if tos_row.document_id is null then raise exception 'Finalized TOS relational row projection is incomplete'; end if;
    select * into competency_row from public.curriculum_competencies
    where id = tos_row.competency_id;
    if competency_row.id is null or competency_row.verification_status <> 'verified'
       or tos_row.competency_text_snapshot is distinct from competency_row.competency_text
       or tos_row.competency_code_snapshot is distinct from competency_row.competency_code
       or tos_row.source_page_snapshot is distinct from competency_row.source_page then
      raise exception 'Finalized TOS competency is not a verified canonical record';
    end if;
    period_id := competency_row.academic_period_id::text;
    canonical_rows := canonical_rows || jsonb_build_array(
      row_value || jsonb_build_object(
        'competency', jsonb_build_object(
          'id', competency_row.id,
          'code', tos_row.competency_code_snapshot,
          'text', tos_row.competency_text_snapshot,
          'sourcePage', tos_row.source_page_snapshot,
          'sourceTitle', row_value #>> '{competency,sourceTitle}',
          'sourceUrl', row_value #>> '{competency,sourceUrl}',
          'academicPeriodId', period_id,
          'curriculumPeriodId', period_id,
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
begin
  select * into document_row from public.documents where id = new.document_id;
  if document_row.id is null or document_row.document_type <> 'assessment'
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
  select * into source_row from public.documents where id = new.source_tos_document_id;
  if source_row.id is null or source_row.document_type <> 'tos'
     or source_row.user_id is distinct from new.user_id
     or source_row.assignment_id is distinct from new.assignment_id
     or (tg_op = 'INSERT' and source_row.status <> 'final'
         and coalesce(current_setting('app.assessment_duplicate_rpc', true), '') <> '1')
     or (tg_op = 'UPDATE' and source_row.status not in ('final', 'archived'))
     or source_row.structured_content is distinct from new.source_tos_raw_content_snapshot
     or public.assessment_canonical_tos_snapshot(source_row.id) is distinct from new.source_tos_content_snapshot then
    raise exception 'Assessment source must be the owner''s finalized TOS snapshot';
  end if;
  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.assignment_id is distinct from old.assignment_id
     or new.source_tos_document_id is distinct from old.source_tos_document_id
    or new.source_tos_version_number is distinct from old.source_tos_version_number
    or new.source_tos_content_snapshot is distinct from old.source_tos_content_snapshot
    or new.source_tos_raw_content_snapshot is distinct from old.source_tos_raw_content_snapshot
    or new.total_items is distinct from old.total_items
  ) then
    raise exception 'Assessment source, assignment, and immutable snapshots cannot change';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_metadata_guard on public.assessment_documents;
create trigger assessment_metadata_guard
before insert or update on public.assessment_documents
for each row execute function public.guard_assessment_metadata();

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
begin
  select * into assessment_row from public.assessment_documents
  where document_id = new.assessment_document_id;
  if assessment_row.document_id is null then
    raise exception 'Assessment item must belong to an assessment document';
  end if;
  select * into source_row from public.documents where id = assessment_row.source_tos_document_id;
  if source_row.id is null or source_row.document_type <> 'tos' or source_row.status not in ('final', 'archived') then
    raise exception 'Assessment items require a finalized TOS source';
  end if;
  select * into competency_row from public.curriculum_competencies
  where id = new.canonical_competency_id;
  if competency_row.id is null or competency_row.verification_status <> 'verified'
     or new.competency_text_snapshot is distinct from competency_row.competency_text
     or new.competency_code_snapshot is distinct from competency_row.competency_code then
    raise exception 'Assessment competency snapshots must match the verified canonical record';
  end if;
  select * into source_tos_row from public.tos_competencies
  where document_id = assessment_row.source_tos_document_id
    and row_id = new.tos_row_id
    and competency_id = new.canonical_competency_id
    and new.item_number between item_start and item_end;
  if source_tos_row.document_id is null then
    raise exception 'Assessment item competency or item number is outside the finalized TOS range';
  end if;
  select value into category
  from jsonb_array_elements(source_tos_row.cognitive_allocations)
  where value ->> 'categoryId' = new.cognitive_category_id
    and new.item_number between (value ->> 'itemStart')::integer and (value ->> 'itemEnd')::integer;
  if category is null
     or category ->> 'label' is distinct from new.cognitive_category_label_snapshot
     or category ->> 'itemStart' is distinct from new.allocation_item_start::text
     or category ->> 'itemEnd' is distinct from new.allocation_item_end::text
     or new.allocation_index <> new.item_number - new.allocation_item_start
     or new.competency_source_page_snapshot is distinct from competency_row.source_page
     or new.competency_academic_period_id_snapshot is distinct from competency_row.academic_period_id::text
     or new.competency_curriculum_period_id_snapshot is distinct from competency_row.academic_period_id::text
     or new.competency_period_label_snapshot is distinct from source_tos_row.curriculum_period_label_snapshot then
    raise exception 'Assessment item cognitive mapping is outside the finalized TOS allocation';
  end if;
  if new.cognitive_category_short_label_snapshot is distinct from coalesce(
    (select category_value ->> 'shortLabel'
     from jsonb_array_elements(source_row.structured_content -> 'cognitiveCategories') category_value
     where category_value ->> 'id' = new.cognitive_category_id
     limit 1), '') then
    raise exception 'Assessment item cognitive category snapshot does not match the finalized TOS';
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
  ) then
    raise exception 'Assessment item identity and curriculum mappings are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists assessment_item_mapping_guard on public.assessment_items;
create trigger assessment_item_mapping_guard
before insert or update on public.assessment_items
for each row execute function public.guard_assessment_item_mapping();

create or replace function public.guard_assessment_item_write_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assessment_status text;
begin
  select d.status into assessment_status
  from public.documents d
  join public.assessment_documents ad on ad.document_id = d.id
  where ad.document_id = case when tg_op = 'DELETE' then old.assessment_document_id else new.assessment_document_id end;
  if assessment_status is null then raise exception 'Assessment document not found'; end if;
  if assessment_status <> 'draft' then
    raise exception 'Final or archived assessment items are immutable';
  end if;
  if not public.assessment_rpc_enabled() then
    raise exception 'Assessment item writes must use the save RPC';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists assessment_item_write_state_guard on public.assessment_items;
create trigger assessment_item_write_state_guard
before insert or update or delete on public.assessment_items
for each row execute function public.guard_assessment_item_write_state();

create or replace function public.guard_assessment_version_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  document_row public.documents%rowtype;
  expected_version integer;
begin
  select * into document_row from public.documents
  where id = case when tg_op = 'INSERT' then new.document_id else old.document_id end;
  if document_row.id is null or document_row.document_type <> 'assessment' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.assessment_rpc_enabled() then raise exception 'Assessment versions are server-managed'; end if;
    select coalesce(max(version_number), 0) + 1 into expected_version
    from public.document_versions where document_id = new.document_id;
    if new.version_number <> expected_version
       or new.structured_content is distinct from document_row.structured_content then
      raise exception 'Assessment versions must be the next exact saved document snapshot';
    end if;
    return new;
  end if;
  raise exception 'Assessment version history is immutable';
end;
$$;

drop trigger if exists assessment_version_immutability_guard on public.document_versions;
create trigger assessment_version_immutability_guard
before insert or update or delete on public.document_versions
for each row execute function public.guard_assessment_version_immutability();

-- Phase 1 granted generic browser version inserts.  TOS and assessment versions
-- must now be written only by their security-definer save RPCs.
drop policy if exists document_versions_insert_own on public.document_versions;
create policy document_versions_insert_own on public.document_versions
for insert to authenticated
with check (exists (
  select 1 from public.documents d
  where d.id = document_versions.document_id
    and d.user_id = (select auth.uid())
    and d.document_type not in ('tos', 'assessment')
));

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
  choice text;
  choice_key text;
  choice_id text;
  seen text[] := array[]::text[];
  seen_texts text[] := array[]::text[];
  idx integer;
  accepted jsonb;
  seen_answers text[] := array[]::text[];
  answer_key text;
begin
  if p_authorship = 'empty' then
    return coalesce(btrim(p_prompt), '') = ''
      and jsonb_array_length(p_choices) = 0
      and jsonb_typeof(p_answer) = 'object';
  end if;
  if coalesce(btrim(p_prompt), '') = '' then return false; end if;
  if p_question_type = 'multiple_choice' then
    if jsonb_typeof(p_choices) <> 'array' then return false; end if;
    if jsonb_array_length(p_choices) < 2 or jsonb_array_length(p_choices) > 6 then return false; end if;
    if exists (select 1 from jsonb_object_keys(p_answer) as answer_key_value(key) where key not in ('type', 'choices', 'choiceId')) then return false; end if;
    for idx in 0..jsonb_array_length(p_choices) - 1 loop
      if jsonb_typeof(p_choices -> idx) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(p_choices -> idx) as choice_key_value(key) where key not in ('id', 'text')) then return false; end if;
      choice_id := btrim(p_choices -> idx ->> 'id');
      choice := btrim(p_choices -> idx ->> 'text');
      if choice_id = '' then return false; end if;
      if choice = '' then return false; end if;
      choice_key := lower(choice_id);
      if choice_key = any(seen) then return false; end if;
      if lower(choice) = any(seen_texts) then return false; end if;
      seen := array_append(seen, choice_key);
      seen_texts := array_append(seen_texts, lower(choice));
    end loop;
    if p_answer ->> 'type' <> 'multiple_choice' then return false; end if;
    if coalesce(btrim(p_answer ->> 'choiceId'), '') = '' then return false; end if;
    return exists (
      select 1 from jsonb_array_elements(p_choices) choice_value
      where choice_value ->> 'id' = p_answer ->> 'choiceId'
    );
  elsif p_question_type = 'true_false' then
    if exists (select 1 from jsonb_object_keys(p_answer) as answer_key_value(key) where key not in ('type', 'value')) then return false; end if;
    return p_answer ->> 'type' = 'true_false'
      and jsonb_typeof(p_answer -> 'value') = 'boolean';
  elsif p_question_type = 'short_answer' then
    accepted := p_answer -> 'acceptedAnswers';
    if p_answer ->> 'type' <> 'short_answer' then return false; end if;
    if exists (select 1 from jsonb_object_keys(p_answer) as answer_key_value(key) where key not in ('type', 'acceptedAnswers', 'caseSensitive')) then return false; end if;
    if p_answer -> 'caseSensitive' is not null
       and jsonb_typeof(p_answer -> 'caseSensitive') is distinct from 'boolean' then return false; end if;
    if jsonb_typeof(accepted) <> 'array' or jsonb_array_length(accepted) < 1 then return false; end if;
    for idx in 0..jsonb_array_length(accepted) - 1 loop
      if jsonb_typeof(accepted -> idx) <> 'string' or btrim(accepted ->> idx) = '' then return false; end if;
      answer_key := case when p_answer ->> 'caseSensitive' = 'true'
        then btrim(accepted ->> idx) else lower(btrim(accepted ->> idx)) end;
      if answer_key = any(seen_answers) then return false; end if;
      seen_answers := array_append(seen_answers, answer_key);
    end loop;
    return true;
  elsif p_question_type = 'constructed_response' then
    if exists (select 1 from jsonb_object_keys(p_answer) as answer_key_value(key) where key not in ('type', 'expectedResponse', 'sampleResponse', 'rubricGuidance')) then return false; end if;
    return p_answer ->> 'type' = 'constructed_response'
      and jsonb_typeof(p_answer -> 'expectedResponse') = 'string'
      and char_length(btrim(p_answer ->> 'expectedResponse')) > 0
      and jsonb_typeof(coalesce(p_answer -> 'sampleResponse', '""'::jsonb)) = 'string'
      and char_length(btrim(coalesce(p_answer ->> 'sampleResponse', ''))) > 0
      and (p_answer -> 'rubricGuidance' is null or jsonb_typeof(p_answer -> 'rubricGuidance') = 'string');
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
    'points', p_item.points,
    'rationale', p_item.rationale,
    'teacherNotes', p_item.teacher_notes,
    'authorshipState', p_item.authorship_state
  )
$$;

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
  source_max_version integer;
  source_canonical_content jsonb;
  source_content jsonb;
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
  item_count integer;
  item_number integer;
  expected_number integer := 1;
  next_version integer;
  canonical_count integer;
  bad_mapping boolean;
  mirror jsonb;
  normalized_content jsonb;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'Assessment status must be draft or final'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Assessment items must be an array'; end if;
  item_count := jsonb_array_length(p_items);
  if item_count > 10000 then raise exception 'Assessment contains too many items'; end if;
  if jsonb_typeof(coalesce(p_structured_content, '{}'::jsonb)) is distinct from 'object' then
    raise exception 'Assessment content must be an object';
  end if;
  if p_assignment_id is null or not exists (
    select 1 from public.teacher_assignments ta where ta.id = p_assignment_id and ta.user_id = owner_id
  ) then raise exception 'A teacher-owned assignment is required'; end if;

  perform set_config('app.assessment_rpc', '1', true);

  if p_document_id is null then
    select * into source_row from public.documents
    where id = p_source_tos_document_id
    for share;
    if source_row.id is null or source_row.user_id is distinct from owner_id
       or source_row.document_type <> 'tos'
       or (source_row.status <> 'final' and coalesce(current_setting('app.assessment_duplicate_rpc', true), '') <> '1')
       or source_row.assignment_id is distinct from p_assignment_id then
      raise exception 'A finalized teacher-owned TOS for the same assignment is required';
    end if;
    select coalesce(max(version_number), 0) into source_max_version
    from public.document_versions where document_id = source_row.id;
    if source_max_version <= 0 then raise exception 'The finalized TOS has no immutable version snapshot'; end if;
    source_total_items := (source_row.structured_content ->> 'totalItems')::integer;
    if source_total_items is null or source_total_items < 1 or source_total_items > 10000 then
      raise exception 'The finalized TOS has no supported total item count';
    end if;
    if item_count <> source_total_items then
      raise exception 'Assessment items must exactly match the finalized TOS total';
    end if;
    source_canonical_content := public.assessment_canonical_tos_snapshot(source_row.id);
    p_school_year := source_canonical_content ->> 'schoolYear';
    p_academic_period_label := source_canonical_content ->> 'gradingTermLabel';

    insert into public.documents (
      user_id, assignment_id, document_type, title, school_year,
      academic_period_label, status, structured_content
    ) values (
      owner_id, p_assignment_id, 'assessment', coalesce(nullif(btrim(p_title), ''), 'Untitled assessment'),
      p_school_year, nullif(p_academic_period_label, ''), 'draft', coalesce(p_structured_content, '{}'::jsonb)
    ) returning * into saved;

    insert into public.assessment_documents (
      document_id, user_id, assignment_id, source_tos_document_id,
      source_tos_version_number, source_tos_content_snapshot, source_tos_raw_content_snapshot,
      total_items, instructions
    ) values (
      saved.id, owner_id, p_assignment_id, source_row.id,
      source_max_version, source_canonical_content, source_row.structured_content,
      source_total_items, coalesce(p_instructions, '')
    ) returning * into assessment_row;
  else
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
    if item_count <> assessment_row.total_items then
      raise exception 'Assessment items must preserve the source TOS total';
    end if;
    if (select count(distinct value ->> 'id') from jsonb_array_elements(p_items)) <> item_count then
      raise exception 'Assessment item UUIDs must be unique within a saved assessment';
    end if;
    if exists (
      select 1 from public.assessment_items existing_item
      where existing_item.assessment_document_id = saved.id
        and not exists (
          select 1 from jsonb_array_elements(p_items) incoming_item
          where (incoming_item ->> 'itemNumber')::integer = existing_item.item_number
            and (incoming_item ->> 'id')::uuid = existing_item.id
        )
    ) then
      raise exception 'Existing assessment item UUIDs are stable and cannot change on draft save';
    end if;
    source_total_items := assessment_row.total_items;
    source_max_version := assessment_row.source_tos_version_number;
    update public.documents set
      title = coalesce(nullif(btrim(p_title), ''), title),
      school_year = assessment_row.source_tos_content_snapshot ->> 'schoolYear',
      academic_period_label = nullif(assessment_row.source_tos_content_snapshot ->> 'gradingTermLabel', ''),
      status = 'draft',
      structured_content = coalesce(p_structured_content, '{}'::jsonb)
    where id = saved.id returning * into saved;
    update public.assessment_documents set instructions = coalesce(p_instructions, instructions)
    where document_id = saved.id returning * into assessment_row;
    delete from public.assessment_items where assessment_document_id = saved.id;
  end if;

  -- Numbering and UUID checks happen before inserting any projection rows.
  for item_value in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item_value) is distinct from 'object' then raise exception 'Assessment item must be an object'; end if;
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
    if (item_value ->> 'questionType') not in ('multiple_choice', 'true_false', 'short_answer', 'constructed_response') then
      raise exception 'Unsupported assessment question type';
    end if;
    item_question_type := (item_value ->> 'questionType')::public.assessment_question_type;
    if (item_value ->> 'authorshipState') not in ('empty', 'ai_suggestion', 'teacher_accepted', 'teacher_edited', 'manual') then
      raise exception 'Unsupported assessment authorship state';
    end if;
    item_authorship := (item_value ->> 'authorshipState')::public.assessment_authorship_state;
    if jsonb_typeof(coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb)) is distinct from 'array'
       or jsonb_typeof(coalesce(item_value -> 'answer', '{}'::jsonb)) is distinct from 'object' then
      raise exception 'Assessment choices and answer must be JSON structures';
    end if;
    if item_authorship = 'empty' then
      if coalesce(btrim(item_value ->> 'prompt'), '') <> '' then
        raise exception 'Empty assessment items cannot contain a prompt';
      end if;
    elsif p_status = 'final' and not public.assessment_item_content_valid(
      item_question_type,
      coalesce(item_value ->> 'prompt', ''),
      coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb),
      coalesce(item_value -> 'answer', '{}'::jsonb),
      item_authorship
    ) then
      raise exception 'Assessment item content does not match its question type';
    end if;
    insert into public.assessment_items (
      id, assessment_document_id, item_number, canonical_competency_id,
      competency_code_snapshot, competency_text_snapshot, competency_source_page_snapshot,
      competency_academic_period_id_snapshot, competency_curriculum_period_id_snapshot,
      competency_period_label_snapshot, tos_row_id, allocation_item_start,
      allocation_item_end, allocation_index, cognitive_category_id,
      cognitive_category_label_snapshot, cognitive_category_short_label_snapshot,
      question_type, prompt, choices, answer, points, rationale, teacher_notes, authorship_state
    ) values (
      item_id, saved.id, item_number, item_competency_id,
      nullif(item_value -> 'competencySnapshot' ->> 'code', ''), item_value -> 'competencySnapshot' ->> 'text',
      (item_value -> 'competencySnapshot' ->> 'sourcePage')::integer,
      item_value -> 'competencySnapshot' ->> 'academicPeriodId',
      item_value -> 'competencySnapshot' ->> 'curriculumPeriodId',
      coalesce(item_value -> 'competencySnapshot' ->> 'curriculumPeriodLabel', ''),
      item_tos_row_id,
      (item_value -> 'mapping' ->> 'allocationItemStart')::integer,
      (item_value -> 'mapping' ->> 'allocationItemEnd')::integer,
      (item_value -> 'mapping' ->> 'allocationIndex')::integer,
      item_cognitive_category_id, item_cognitive_category_label, item_cognitive_category_short_label,
      item_question_type,
      coalesce(item_value ->> 'prompt', ''), coalesce(item_value -> 'answer' -> 'choices', '[]'::jsonb),
      coalesce(item_value -> 'answer', '{}'::jsonb),
      coalesce(nullif(item_value ->> 'points', '')::numeric, 1),
      coalesce(item_value ->> 'rationale', ''), coalesce(item_value ->> 'teacherNotes', ''),
      item_authorship
    );
  end loop;
  if expected_number <> source_total_items + 1 then raise exception 'Assessment item numbering is incomplete'; end if;

  if p_status = 'final' then
    if saved.status <> 'draft' then raise exception 'Only draft assessments can be finalized'; end if;
    if exists (select 1 from public.assessment_items ai where ai.assessment_document_id = saved.id and ai.authorship_state in ('empty', 'ai_suggestion')) then
      raise exception 'Final assessment requires every item to be teacher-accepted, edited, or manual';
    end if;
    if exists (select 1 from public.assessment_items ai where ai.assessment_document_id = saved.id and ai.points <= 0) then
      raise exception 'Final assessment requires positive points for every item';
    end if;
    select exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and not public.assessment_item_content_valid(ai.question_type, ai.prompt, ai.choices, ai.answer, ai.authorship_state)
    ) into bad_mapping;
    if bad_mapping then raise exception 'Final assessment contains invalid question content'; end if;
    select count(*) into canonical_count from public.assessment_items ai
    where ai.assessment_document_id = saved.id;
    if canonical_count <> source_total_items then raise exception 'Final assessment item total is not exact'; end if;
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
    ) into bad_mapping;
    if bad_mapping then raise exception 'Final assessment item mappings do not match the finalized TOS ranges'; end if;
    select exists (
      select 1 from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and public.assessment_item_mirror(ai) is distinct from
          ((coalesce(p_structured_content, '{}'::jsonb) -> 'items' -> (ai.item_number - 1)))
    ) into bad_mapping;
    if bad_mapping then raise exception 'Assessment JSON and relational item projections do not match'; end if;
  end if;

  -- Persist the same structured item mirror for both draft and final saves.  The
  -- final check above makes the supplied JSON mirror independently auditable.
  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number), '[]'::jsonb)
    into mirror from public.assessment_items ai where ai.assessment_document_id = saved.id;
  source_content := assessment_row.source_tos_content_snapshot;
  -- Only teacher-authored assessment fields are accepted from the request.  All
  -- assignment/curriculum/source metadata in the persisted JSON comes from the
  -- locked, server-derived TOS snapshot above.
  normalized_content := jsonb_build_object(
    'schemaVersion', 1,
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
  update public.documents set
    status = case when p_status = 'final' then 'final' else 'draft' end,
    structured_content = normalized_content
  where id = saved.id returning * into saved;
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.document_versions where document_id = saved.id;
  insert into public.document_versions (document_id, version_number, structured_content, change_note)
  values (saved.id, next_version, saved.structured_content, nullif(p_change_note, ''));
  return saved;
end;
$$;

revoke all on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) to authenticated;

-- Duplication deliberately copies the persisted item mirror, not a browser's
-- source edits.  It remains available when the source TOS was archived after the
-- original assessment was created, because the original assessment's source
-- snapshot and source identity are immutable.
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
  created public.documents%rowtype;
  source_items jsonb;
  copied_items jsonb := '[]'::jsonb;
  item_value jsonb;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into source_document from public.documents
  where id = p_source_document_id and user_id = owner_id and document_type = 'assessment'
  for share;
  if source_document.id is null then raise exception 'Assessment document not found'; end if;
  select * into source_assessment from public.assessment_documents
  where document_id = source_document.id;
  if source_assessment.document_id is null then raise exception 'Assessment metadata is missing'; end if;
  source_items := source_document.structured_content -> 'items';
  if jsonb_typeof(source_items) is distinct from 'array'
     or jsonb_array_length(source_items) <> source_assessment.total_items then
    raise exception 'Assessment item mirror is incomplete and cannot be duplicated';
  end if;
  for item_value in select value from jsonb_array_elements(source_items)
  loop
    copied_items := copied_items || jsonb_build_array(
      jsonb_set(item_value, '{id}', to_jsonb(gen_random_uuid()::text), true)
    );
  end loop;
  perform set_config('app.assessment_duplicate_rpc', '1', true);
  select * into created from public.save_assessment_document(
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
    'Duplicated assessment'
  );
  return created;
end;
$$;

revoke all on function public.duplicate_assessment_document(uuid, text, text) from public;
grant execute on function public.duplicate_assessment_document(uuid, text, text) to authenticated;

create or replace function public.archive_assessment_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved public.documents%rowtype;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into saved from public.documents
  where id = p_document_id and user_id = owner_id and document_type = 'assessment'
  for update;
  if saved.id is null then raise exception 'Assessment document not found'; end if;
  if saved.status = 'archived' then return saved; end if;
  perform set_config('app.assessment_rpc', '1', true);
  update public.documents set status = 'archived' where id = saved.id returning * into saved;
  return saved;
end;
$$;

revoke all on function public.archive_assessment_document(uuid) from public;
grant execute on function public.archive_assessment_document(uuid) to authenticated;

comment on table public.assessment_documents is
'Teacher-owned assignment-bound assessment shell. The finalized TOS source JSON and maximum version are immutable server snapshots; raw provenance is retained alongside the canonicalized source snapshot.';
comment on table public.assessment_items is
'Normalized assessment item projection. Curriculum/cognitive mapping is immutable; authored content remains teacher-editable only while its document is draft.';
comment on function public.save_assessment_document(uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text) is
'Atomic assessment draft save/finalization. Authenticated callers cannot supply a different owner, source, assignment, mapping, item total, or version snapshot.';
