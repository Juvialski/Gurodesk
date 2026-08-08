-- GuroDesk Phase 4: teacher-owned, verified-curriculum Table of Specifications.
-- TOS arithmetic remains deterministic application code; database constraints
-- independently reject unreconciled final documents.

create table if not exists public.tos_competencies (
  document_id uuid not null references public.documents(id) on delete cascade,
  row_id uuid not null,
  competency_id uuid not null references public.curriculum_competencies(id) on delete restrict,
  competency_code_snapshot text,
  competency_text_snapshot text not null,
  source_page_snapshot integer,
  curriculum_period_label_snapshot text not null default '',
  row_order integer not null check (row_order > 0),
  instructional_minutes numeric check (instructional_minutes is null or instructional_minutes >= 0),
  source_weight numeric not null check (source_weight >= 0),
  computed_weight_percent numeric not null check (computed_weight_percent >= 0 and computed_weight_percent <= 100),
  item_count integer not null check (item_count >= 0),
  item_start integer,
  item_end integer,
  cognitive_allocations jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (document_id, row_id),
  unique (document_id, competency_id),
  unique (document_id, row_order),
  check (
    (item_count = 0 and item_start is null and item_end is null)
    or (item_count > 0 and item_start > 0 and item_end = item_start + item_count - 1)
  ),
  check (jsonb_typeof(cognitive_allocations) = 'array')
);

create index if not exists idx_tos_competencies_document_order
  on public.tos_competencies(document_id, row_order);
create index if not exists idx_tos_competencies_competency
  on public.tos_competencies(competency_id);
create index if not exists idx_documents_user_type_status_updated
  on public.documents(user_id, document_type, status, updated_at desc);
create index if not exists idx_document_versions_document_version_desc
  on public.document_versions(document_id, version_number desc);

alter table public.tos_competencies enable row level security;

create policy "tos_competencies_select_own" on public.tos_competencies
for select to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = tos_competencies.document_id
    and d.user_id = (select auth.uid())
    and d.document_type = 'tos'
));

create policy "tos_competencies_insert_own_draft" on public.tos_competencies
for insert to authenticated
with check (exists (
  select 1 from public.documents d
  where d.id = tos_competencies.document_id
    and d.user_id = (select auth.uid())
    and d.document_type = 'tos'
    and d.status = 'draft'
));

create policy "tos_competencies_delete_own_draft" on public.tos_competencies
for delete to authenticated
using (exists (
  select 1 from public.documents d
  where d.id = tos_competencies.document_id
    and d.user_id = (select auth.uid())
    and d.document_type = 'tos'
    and d.status = 'draft'
));

-- Documents may only point to an assignment owned by the same teacher. This
-- closes the generic Phase 1 assignment ownership gap without weakening RLS.
create or replace function public.guard_document_assignment_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assignment_id is not null and not exists (
    select 1 from public.teacher_assignments ta
    where ta.id = new.assignment_id and ta.user_id = new.user_id
  ) then
    raise exception 'document assignment must belong to the document owner';
  end if;
  return new;
end;
$$;

drop trigger if exists document_assignment_owner_guard on public.documents;
create trigger document_assignment_owner_guard
before insert or update of assignment_id, user_id on public.documents
for each row execute function public.guard_document_assignment_owner();

-- Every relational row must be a verified competency from the document's exact
-- assignment/curriculum context. Snapshot fields are checked against canonical
-- knowledge so a browser cannot disguise a stale or unrelated competency.
create or replace function public.guard_tos_competency_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  d public.documents%rowtype;
  c public.curriculum_competencies%rowtype;
  subject_version_id uuid;
  subject_version_code text;
  subject_grade text;
  subject_name text;
  period_label text;
  assignment_grade text;
  assignment_area text;
  source_status text;
  subject_source_status text;
begin
  select * into d from public.documents where id = new.document_id;
  if d.id is null or d.document_type <> 'tos' or d.status <> 'draft' then
    raise exception 'TOS competency links can only be changed on draft TOS documents';
  end if;

  select * into c from public.curriculum_competencies where id = new.competency_id;
  if c.id is null or c.verification_status <> 'verified' then
    raise exception 'TOS competencies must reference verified curriculum records';
  end if;

  select cs.curriculum_version_id, cv.code, cs.grade_level, cs.name, subject_sd.verification_status
  into subject_version_id, subject_version_code, subject_grade, subject_name, subject_source_status
  from public.curriculum_subjects cs
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  left join public.source_documents subject_sd on subject_sd.id = cs.source_document_id
  where cs.id = c.subject_id;

  if c.source_document_id is not null then
    select verification_status into source_status from public.source_documents where id = c.source_document_id;
  else
    source_status := subject_source_status;
  end if;
  if source_status is null or source_status not in ('verified', 'superseded') then
    raise exception 'TOS competency source is not verified';
  end if;

  if d.assignment_id is not null then
    select grade_level, learning_area into assignment_grade, assignment_area
    from public.teacher_assignments where id = d.assignment_id and user_id = d.user_id;
    if assignment_grade is null or subject_grade <> assignment_grade or lower(subject_name) <> lower(assignment_area) then
      raise exception 'TOS competency does not match the document assignment';
    end if;
  end if;

  if not (
    (d.structured_content #>> '{curriculumVersionId}' = subject_version_id::text
      and d.structured_content #>> '{curriculumSubjectId}' = c.subject_id::text)
    or
    (d.structured_content #>> '{curriculumVersionCode}' = subject_version_code
      and d.structured_content #>> '{gradeLevel}' = subject_grade
      and lower(d.structured_content #>> '{learningArea}') = lower(subject_name))
  ) then
    raise exception 'TOS competency does not match the saved curriculum version and subject';
  end if;

  if c.academic_period_id is not null then
    select label into period_label from public.academic_periods where id = c.academic_period_id;
    if not (
      (d.structured_content -> 'curriculumPeriodIds') ? c.academic_period_id::text
      or (d.structured_content -> 'curriculumPeriodLabels') ? period_label
    ) then
      raise exception 'TOS competency is outside the selected curriculum-guide periods';
    end if;
  else
    period_label := '';
  end if;

  if new.competency_text_snapshot <> c.competency_text
     or new.competency_code_snapshot is distinct from c.competency_code
     or new.source_page_snapshot is distinct from c.source_page
     or new.curriculum_period_label_snapshot is distinct from coalesce(period_label, '') then
    raise exception 'TOS competency snapshot does not match the verified curriculum record';
  end if;
  return new;
end;
$$;

drop trigger if exists tos_competency_guard on public.tos_competencies;
create trigger tos_competency_guard
before insert or update on public.tos_competencies
for each row execute function public.guard_tos_competency_link();

create or replace function public.tos_cognitive_allocations_valid(
  p_allocations jsonb,
  p_categories jsonb,
  p_item_start integer,
  p_item_end integer,
  p_item_count integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  category_value jsonb;
  allocation_value jsonb;
  category_id text;
  seen_ids text[] := array[]::text[];
  category_count integer;
  allocation_count integer;
  part_count integer;
  part_start integer;
  part_end integer;
  expected_cursor integer := p_item_start;
  allocated_total integer := 0;
  index_value integer;
  expected_range text;
begin
  if jsonb_typeof(p_allocations) is distinct from 'array'
     or jsonb_typeof(p_categories) is distinct from 'array'
     or p_item_count is null or p_item_count < 0 then
    return false;
  end if;
  category_count := jsonb_array_length(p_categories);
  allocation_count := jsonb_array_length(p_allocations);
  if category_count <= 0 or allocation_count <> category_count then return false; end if;
  if p_item_count = 0 and (p_item_start is not null or p_item_end is not null) then return false; end if;
  if p_item_count > 0 and (p_item_start is null or p_item_end <> p_item_start + p_item_count - 1) then return false; end if;

  for index_value in 0..category_count - 1 loop
    category_value := p_categories -> index_value;
    allocation_value := p_allocations -> index_value;
    category_id := category_value ->> 'id';
    if coalesce(category_id, '') = '' or category_id = any(seen_ids) then return false; end if;
    seen_ids := array_append(seen_ids, category_id);
    if coalesce(category_value ->> 'label', '') = ''
       or coalesce(category_value ->> 'shortLabel', '') = ''
       or jsonb_typeof(category_value -> 'sortOrder') is distinct from 'number'
       or category_value ->> 'sortOrder' !~ '^[1-9][0-9]*$'
       or (category_value ->> 'sortOrder')::integer <> index_value + 1 then return false; end if;
    if allocation_value ->> 'categoryId' is distinct from category_id
       or allocation_value ->> 'label' is distinct from category_value ->> 'label'
       or allocation_value ->> 'shortLabel' is distinct from category_value ->> 'shortLabel'
       or jsonb_typeof(allocation_value -> 'itemCount') is distinct from 'number'
       or allocation_value ->> 'itemCount' !~ '^\d+$' then return false; end if;
    part_count := (allocation_value ->> 'itemCount')::integer;
    allocated_total := allocated_total + part_count;
    if part_count = 0 then
      if allocation_value -> 'itemStart' is distinct from 'null'::jsonb
         or allocation_value -> 'itemEnd' is distinct from 'null'::jsonb
         or coalesce(allocation_value ->> 'rangeLabel', '') <> '' then return false; end if;
    else
      if jsonb_typeof(allocation_value -> 'itemStart') is distinct from 'number'
         or jsonb_typeof(allocation_value -> 'itemEnd') is distinct from 'number'
         or allocation_value ->> 'itemStart' !~ '^[1-9][0-9]*$'
         or allocation_value ->> 'itemEnd' !~ '^[1-9][0-9]*$' then return false; end if;
      part_start := (allocation_value ->> 'itemStart')::integer;
      part_end := (allocation_value ->> 'itemEnd')::integer;
      if part_start is distinct from expected_cursor or part_end <> part_start + part_count - 1 then return false; end if;
      expected_range := case when part_start = part_end then part_start::text else part_start::text || '–' || part_end::text end;
      if allocation_value ->> 'rangeLabel' is distinct from expected_range then return false; end if;
      expected_cursor := part_end + 1;
    end if;
  end loop;
  return allocated_total = p_item_count
    and (p_item_count = 0 or expected_cursor = p_item_end + 1);
exception when others then
  return false;
end;
$$;

create or replace function public.guard_tos_document_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_items integer;
  expected_rows integer;
  linked_rows integer;
  allocated_items integer;
  first_item integer;
  last_item integer;
  has_bad_range boolean;
  has_bad_cognitive_total boolean;
  canonical_rows integer;
  matched_rows integer;
  assignment_grade text;
  assignment_area text;
  assignment_school_year text;
  grading_term_valid boolean;
  grading_term_id_text text;
  weighting_method text;
  total_source_weight numeric;
  total_computed_weight numeric;
  has_bad_weight boolean;
begin
  if tg_op = 'INSERT' then
    if new.document_type = 'tos' then
      if new.status <> 'draft' or new.assignment_id is null then
        raise exception 'New TOS documents must start as assignment-bound drafts';
      end if;
      if jsonb_typeof(new.structured_content) is distinct from 'object'
         or new.structured_content #>> '{schemaVersion}' is distinct from '1'
         or jsonb_typeof(new.structured_content -> 'rows') is distinct from 'array'
         or jsonb_typeof(new.structured_content -> 'cognitiveCategories') is distinct from 'array' then
        raise exception 'New TOS drafts require the Phase 4 structured schema';
      end if;
    end if;
    return new;
  end if;

  if new.document_type is distinct from old.document_type
     and (old.document_type = 'tos' or new.document_type = 'tos') then
    raise exception 'A TOS document type cannot be changed';
  end if;
  if old.document_type <> 'tos' then return new; end if;
  if new.user_id is distinct from old.user_id then raise exception 'A TOS owner cannot be changed'; end if;
  if old.status = 'archived' then raise exception 'Archived TOS documents are immutable'; end if;
  if old.status = 'final' then
    if new.status <> 'archived' or new.structured_content <> old.structured_content
       or new.assignment_id is distinct from old.assignment_id
       or new.title <> old.title or new.school_year <> old.school_year
       or new.academic_period_label is distinct from old.academic_period_label then
      raise exception 'Final TOS documents are immutable except for archiving';
    end if;
    return new;
  end if;
  if new.status = 'draft' then
    if new.assignment_id is null
       or jsonb_typeof(new.structured_content) is distinct from 'object'
       or new.structured_content #>> '{schemaVersion}' is distinct from '1'
       or jsonb_typeof(new.structured_content -> 'rows') is distinct from 'array'
       or jsonb_typeof(new.structured_content -> 'cognitiveCategories') is distinct from 'array' then
      raise exception 'TOS drafts must remain assignment-bound Phase 4 documents';
    end if;
    return new;
  end if;
  if new.status <> 'final' then return new; end if;

  grading_term_id_text := new.structured_content #>> '{gradingTermId}';
  weighting_method := new.structured_content #>> '{weightingMethod}';
  if jsonb_typeof(new.structured_content) is distinct from 'object'
     or new.structured_content #>> '{schemaVersion}' is distinct from '1'
     or new.structured_content #>> '{calculation,engine}' is distinct from 'hamilton-largest-remainder-v1'
     or jsonb_typeof(new.structured_content #> '{calculation,valid}') is distinct from 'boolean'
     or new.structured_content #>> '{calculation,valid}' is distinct from 'true'
     or coalesce(btrim(new.structured_content #>> '{title}'), '') = ''
     or new.title is distinct from new.structured_content #>> '{title}'
     or new.academic_period_label is distinct from new.structured_content #>> '{gradingTermLabel}'
     or coalesce(grading_term_id_text, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or jsonb_typeof(new.structured_content -> 'curriculumPeriodIds') is distinct from 'array'
     or jsonb_array_length(new.structured_content -> 'curriculumPeriodIds') = 0
     or jsonb_typeof(new.structured_content -> 'curriculumPeriodLabels') is distinct from 'array'
     or jsonb_array_length(new.structured_content -> 'curriculumPeriodLabels') = 0
     or jsonb_typeof(new.structured_content -> 'cognitiveCategories') is distinct from 'array'
     or jsonb_array_length(new.structured_content -> 'cognitiveCategories') = 0
     or jsonb_typeof(new.structured_content -> 'rows') is distinct from 'array'
     or weighting_method not in ('equal', 'instructional_time', 'manual_percentage')
     or jsonb_typeof(new.structured_content -> 'totalItems') is distinct from 'number'
     or new.structured_content ->> 'totalItems' !~ '^[1-9][0-9]*$'
     or (new.structured_content ->> 'totalItems')::numeric > 10000 then
    raise exception 'Final TOS metadata or calculation record is incomplete';
  end if;

  expected_items := (new.structured_content #>> '{totalItems}')::integer;
  expected_rows := jsonb_array_length(new.structured_content -> 'rows');
  if expected_items is null or expected_rows is null or expected_items <= 0 or expected_rows <= 0 or expected_rows > 10000 then
    raise exception 'Final TOS requires supported item and competency totals';
  end if;

  select ta.grade_level, ta.learning_area, ta.school_year
    into assignment_grade, assignment_area, assignment_school_year
  from public.teacher_assignments ta
  where ta.id = new.assignment_id and ta.user_id = new.user_id;
  if assignment_grade is null
     or new.school_year is distinct from assignment_school_year
     or new.structured_content #>> '{schoolYear}' is distinct from assignment_school_year
     or new.structured_content #>> '{gradeLevel}' is distinct from assignment_grade
     or lower(new.structured_content #>> '{learningArea}') is distinct from lower(assignment_area) then
    raise exception 'Final TOS metadata does not match its current teacher assignment';
  end if;

  select exists (
    select 1 from public.grading_periods gp
    join public.school_year_calendars syc on syc.id = gp.school_year_calendar_id
    where gp.id = grading_term_id_text::uuid
      and gp.label = new.structured_content #>> '{gradingTermLabel}'
      and syc.school_year = new.school_year
      and syc.status in ('active', 'superseded')
  ) into grading_term_valid;
  if grading_term_valid is not true then raise exception 'Final TOS grading term is not valid for its school year'; end if;

  select count(*), coalesce(sum(item_count), 0), min(item_start), max(item_end)
    into linked_rows, allocated_items, first_item, last_item
  from public.tos_competencies where document_id = new.id;

  select exists (
    select 1 from (
      select item_count, item_start, item_end,
        lag(item_end) over (order by row_order, row_id) as prior_end
      from public.tos_competencies where document_id = new.id
    ) ordered
    where item_count <= 0 or item_start is null or item_end is null
       or (prior_end is not null and item_start <> prior_end + 1)
  ) into has_bad_range;

  select exists (
    select 1 from public.tos_competencies tc
    where tc.document_id = new.id
      and not public.tos_cognitive_allocations_valid(
        tc.cognitive_allocations,
        new.structured_content -> 'cognitiveCategories',
        tc.item_start,
        tc.item_end,
        tc.item_count
      )
  ) into has_bad_cognitive_total;

  select coalesce(sum(source_weight), 0), coalesce(sum(computed_weight_percent), 0)
    into total_source_weight, total_computed_weight
  from public.tos_competencies where document_id = new.id;
  select exists (
    select 1 from public.tos_competencies tc
    where tc.document_id = new.id
      and (
        total_source_weight <= 0
        or abs(tc.computed_weight_percent - (tc.source_weight / total_source_weight * 100)) > 0.01
        or (weighting_method = 'equal' and tc.source_weight <> 1)
      )
  ) into has_bad_weight;
  if total_computed_weight <> 100 then has_bad_weight := true; end if;
  if weighting_method = 'manual_percentage' and total_source_weight <> 100 then has_bad_weight := true; end if;

  select count(*) into canonical_rows
  from public.tos_competencies tc
  join public.curriculum_competencies c on c.id = tc.competency_id
  join public.curriculum_subjects cs on cs.id = c.subject_id
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  left join public.academic_periods ap on ap.id = c.academic_period_id
  left join public.source_documents sd on sd.id = c.source_document_id
  left join public.source_documents subject_sd on subject_sd.id = cs.source_document_id
  where tc.document_id = new.id
    and c.verification_status = 'verified'
    and cv.status in ('active', 'superseded')
    and cs.grade_level = assignment_grade
    and lower(cs.name) = lower(assignment_area)
    and (
      (new.structured_content #>> '{curriculumVersionId}' = cv.id::text
        and new.structured_content #>> '{curriculumSubjectId}' = cs.id::text)
      or
      (new.structured_content #>> '{curriculumVersionCode}' = cv.code
        and new.structured_content #>> '{gradeLevel}' = cs.grade_level
        and lower(new.structured_content #>> '{learningArea}') = lower(cs.name))
    )
    and (
      (c.source_document_id is not null and sd.id is not null and sd.verification_status in ('verified', 'superseded'))
      or (c.source_document_id is null and subject_sd.id is not null and subject_sd.verification_status in ('verified', 'superseded'))
    )
    and exists (
      select 1 from public.curriculum_applicability ca
      where ca.curriculum_version_id = cv.id
        and ca.school_year = new.school_year
        and ca.grade_level = assignment_grade
        and ca.implementation_status in ('full', 'pilot', 'transitional')
    )
    and tc.competency_text_snapshot = c.competency_text
    and tc.competency_code_snapshot is not distinct from c.competency_code
    and tc.source_page_snapshot is not distinct from c.source_page
    and (
      (c.academic_period_id is null and tc.curriculum_period_label_snapshot = '')
      or
      (ap.id is not null
        and tc.curriculum_period_label_snapshot = ap.label
        and (new.structured_content -> 'curriculumPeriodLabels') ? ap.label)
    );

  select count(*) into matched_rows
  from public.tos_competencies tc
  where tc.document_id = new.id
    and exists (
      select 1
      from jsonb_array_elements(new.structured_content -> 'rows') with ordinality as saved_row(value, position)
      where saved_row.value ->> 'id' = tc.row_id::text
        and saved_row.position::integer = tc.row_order
        and saved_row.value ->> 'sortOrder' ~ '^[1-9][0-9]*$'
        and (saved_row.value ->> 'sortOrder')::integer = tc.row_order
        and (
          saved_row.value #>> '{competency,id}' = tc.competency_id::text
          or saved_row.value #>> '{competency,id}' ~ '^comp-[a-z0-9_-]+-q[1-9][0-9]*-[1-9][0-9]*$'
        )
        and (
          saved_row.value #>> '{competency,academicPeriodId}' is not distinct from (
            select c.academic_period_id::text from public.curriculum_competencies c where c.id = tc.competency_id
          )
          or (
            (select c.academic_period_id from public.curriculum_competencies c where c.id = tc.competency_id) is not null
            and saved_row.value #>> '{competency,academicPeriodId}' ~ '^period-[a-z0-9_-]+-[1-9][0-9]*$'
          )
        )
        and saved_row.value #>> '{competency,verificationStatus}' = 'verified'
        and saved_row.value #>> '{competency,text}' = tc.competency_text_snapshot
        and (saved_row.value #>> '{competency,code}') is not distinct from tc.competency_code_snapshot
        and (saved_row.value #>> '{competency,sourcePage}') is not distinct from tc.source_page_snapshot::text
        and saved_row.value #>> '{competency,curriculumPeriodLabel}' = tc.curriculum_period_label_snapshot
        and saved_row.value ->> 'computedWeightPercent' ~ '^\d+(\.\d+)?$'
        and (saved_row.value ->> 'computedWeightPercent')::numeric = tc.computed_weight_percent
        and saved_row.value ->> 'itemCount' ~ '^\d+$'
        and (saved_row.value ->> 'itemCount')::integer = tc.item_count
        and (saved_row.value ->> 'itemStart') is not distinct from tc.item_start::text
        and (saved_row.value ->> 'itemEnd') is not distinct from tc.item_end::text
        and saved_row.value ->> 'itemRangeLabel' is not distinct from
          case when tc.item_start = tc.item_end then tc.item_start::text else tc.item_start::text || '–' || tc.item_end::text end
        and saved_row.value -> 'cognitiveAllocations' = tc.cognitive_allocations
        and coalesce(saved_row.value ->> 'notes', '') = tc.notes
        and (
          (weighting_method = 'equal' and tc.source_weight = 1)
          or (weighting_method = 'manual_percentage'
            and btrim(saved_row.value ->> 'manualWeight') ~ '^(\d+|\d+\.\d+|\.\d+)$'
            and btrim(saved_row.value ->> 'manualWeight')::numeric = tc.source_weight)
          or (weighting_method = 'instructional_time'
            and coalesce(nullif(btrim(saved_row.value ->> 'instructionalMinutes'), ''), '0') ~ '^(\d+|\d+\.\d+|\.\d+)$'
            and coalesce(nullif(btrim(saved_row.value ->> 'instructionalMinutes'), ''), '0')::numeric = tc.source_weight)
        )
        and coalesce(nullif(btrim(saved_row.value ->> 'instructionalMinutes'), ''), '0') ~ '^(\d+|\d+\.\d+|\.\d+)$'
        and coalesce(nullif(btrim(saved_row.value ->> 'instructionalMinutes'), ''), '0')::numeric
          = coalesce(tc.instructional_minutes, 0)
    );

  if linked_rows <> expected_rows or allocated_items <> expected_items
     or first_item <> 1 or last_item <> expected_items
     or has_bad_range or has_bad_cognitive_total or has_bad_weight
     or canonical_rows <> expected_rows or matched_rows <> expected_rows then
    raise exception 'Final TOS verification failed: curriculum links, weights, cognitive allocations, and contiguous item ranges must reconcile exactly';
  end if;
  return new;
end;
$$;

drop trigger if exists tos_document_state_guard on public.documents;
create trigger tos_document_state_guard
before insert or update on public.documents
for each row execute function public.guard_tos_document_state();

create or replace function public.guard_final_tos_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.document_type = 'tos' and old.status <> 'draft' then
    raise exception 'Final or archived TOS documents cannot be deleted';
  end if;
  return old;
end;
$$;
drop trigger if exists final_tos_delete_guard on public.documents;
create trigger final_tos_delete_guard before delete on public.documents
for each row execute function public.guard_final_tos_delete();

create or replace function public.guard_tos_version_immutability()
returns trigger language plpgsql set search_path = '' as $$
declare
  document_row public.documents%rowtype;
  expected_version integer;
begin
  select * into document_row from public.documents d
  where d.id = case when tg_op = 'INSERT' then new.document_id else old.document_id end;
  if document_row.id is null or document_row.document_type <> 'tos' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    select coalesce(max(version_number), 0) + 1 into expected_version
    from public.document_versions where document_id = new.document_id;
    if new.version_number <> expected_version
       or new.structured_content is distinct from document_row.structured_content then
      raise exception 'TOS versions must be the next exact saved document snapshot';
    end if;
    return new;
  end if;
  raise exception 'TOS version history is immutable';
end;
$$;
drop trigger if exists tos_version_immutability_guard on public.document_versions;
create trigger tos_version_immutability_guard before insert or update or delete on public.document_versions
for each row execute function public.guard_tos_version_immutability();

drop policy if exists "document_versions_insert_own" on public.document_versions;
create policy "document_versions_insert_own" on public.document_versions
for insert to authenticated
with check (exists (
  select 1 from public.documents d
  where d.id = document_versions.document_id
    and d.user_id = (select auth.uid())
    and d.document_type <> 'tos'
));

-- Atomic save avoids partial document/link/version writes and serializes version
-- numbers under a row lock. The caller supplies only precomputed values.
create or replace function public.save_tos_document(
  p_document_id uuid,
  p_assignment_id uuid,
  p_title text,
  p_school_year text,
  p_academic_period_label text,
  p_status text,
  p_structured_content jsonb,
  p_rows jsonb,
  p_change_note text default 'Teacher saved TOS'
)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved public.documents%rowtype;
  row_value jsonb;
  next_version integer;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_status not in ('draft', 'final') then raise exception 'TOS status must be draft or final'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'TOS rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 10000 then raise exception 'TOS rows exceed the supported limit'; end if;
  if p_assignment_id is null or not exists (
    select 1 from public.teacher_assignments ta where ta.id = p_assignment_id and ta.user_id = owner_id
  ) then raise exception 'A teacher-owned assignment is required'; end if;

  if p_document_id is null then
    insert into public.documents (
      user_id, assignment_id, document_type, title, school_year,
      academic_period_label, status, structured_content
    ) values (
      owner_id, p_assignment_id, 'tos', p_title, p_school_year,
      p_academic_period_label, 'draft', p_structured_content
    ) returning * into saved;
  else
    select * into saved from public.documents
    where id = p_document_id and user_id = owner_id and document_type = 'tos'
    for update;
    if saved.id is null then raise exception 'TOS document not found'; end if;
    if saved.status <> 'draft' then raise exception 'Only draft TOS documents can be edited'; end if;
    update public.documents set
      assignment_id = p_assignment_id,
      title = p_title,
      school_year = p_school_year,
      academic_period_label = p_academic_period_label,
      status = 'draft',
      structured_content = p_structured_content
    where id = saved.id returning * into saved;
    delete from public.tos_competencies where document_id = saved.id;
  end if;

  for row_value in select value from jsonb_array_elements(p_rows)
  loop
    insert into public.tos_competencies (
      document_id, row_id, competency_id, competency_code_snapshot,
      competency_text_snapshot, source_page_snapshot,
      curriculum_period_label_snapshot, row_order, instructional_minutes,
      source_weight, computed_weight_percent, item_count, item_start, item_end,
      cognitive_allocations, notes
    ) values (
      saved.id,
      (row_value ->> 'rowId')::uuid,
      (row_value ->> 'competencyId')::uuid,
      nullif(row_value ->> 'competencyCode', ''),
      row_value ->> 'competencyText',
      (row_value ->> 'sourcePage')::integer,
      coalesce(row_value ->> 'curriculumPeriodLabel', ''),
      (row_value ->> 'rowOrder')::integer,
      (row_value ->> 'instructionalMinutes')::numeric,
      (row_value ->> 'sourceWeight')::numeric,
      (row_value ->> 'computedWeightPercent')::numeric,
      (row_value ->> 'itemCount')::integer,
      (row_value ->> 'itemStart')::integer,
      (row_value ->> 'itemEnd')::integer,
      coalesce(row_value -> 'cognitiveAllocations', '[]'::jsonb),
      coalesce(row_value ->> 'notes', '')
    );
  end loop;

  if p_status = 'final' then
    update public.documents set status = 'final' where id = saved.id returning * into saved;
  else
    select * into saved from public.documents where id = saved.id;
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.document_versions where document_id = saved.id;
  insert into public.document_versions (document_id, version_number, structured_content, change_note)
  values (saved.id, next_version, saved.structured_content, nullif(p_change_note, ''));
  return saved;
end;
$$;

revoke all on function public.save_tos_document(uuid, uuid, text, text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.save_tos_document(uuid, uuid, text, text, text, text, jsonb, jsonb, text) to authenticated;

-- Phase 3.7 anticipated both formats; Phase 4 now enforces only supported pairs
-- and verifies that metadata paths remain in the teacher's private folder.
do $$ begin
  alter table public.document_templates add constraint document_templates_supported_pair_check
    check ((document_type = 'lesson_plan' and file_type = 'docx') or (document_type = 'tos' and file_type = 'xlsx')) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.document_templates add constraint document_templates_storage_owner_check
    check (split_part(storage_path, '/', 1) = user_id::text) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.document_templates add constraint document_templates_tos_hash_check
    check (document_type <> 'tos' or source_hash ~ '^[0-9a-fA-F]{64}$') not valid;
exception when duplicate_object then null; end $$;

create or replace function public.guard_document_template_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.document_type is distinct from old.document_type
     or new.file_type is distinct from old.file_type
     or new.original_filename is distinct from old.original_filename
     or new.storage_path is distinct from old.storage_path
     or new.file_size_bytes is distinct from old.file_size_bytes
     or new.source_hash is distinct from old.source_hash then
    raise exception 'Template master identity and fingerprint are immutable; upload a new template instead';
  end if;
  return new;
end;
$$;

drop trigger if exists document_template_identity_guard on public.document_templates;
create trigger document_template_identity_guard
before update on public.document_templates
for each row execute function public.guard_document_template_identity();

create or replace function public.guard_document_template_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.document_templates
    set is_default = false, updated_at = timezone('utc', now())
    where user_id = new.user_id
      and document_type = new.document_type
      and id <> new.id
      and is_default = true;
  end if;
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists document_template_default_guard on public.document_templates;
create trigger document_template_default_guard
before insert or update on public.document_templates
for each row execute function public.guard_document_template_default();

comment on table public.tos_competencies is
'Teacher-owned TOS row projection linked only to verified curriculum competencies; final totals and ranges are independently reconciled in the database.';
