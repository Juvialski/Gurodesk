-- GuroDesk Phase 6A-C: teacher-owned custom and hybrid curriculum architecture.
--
-- Goals:
-- - keep official DepEd knowledge immutable;
-- - allow private-school teachers to upload/paste/manual-build their own curriculum;
-- - allow a hybrid curriculum to inherit an official subject and add school enrichment;
-- - reuse the same normalized curriculum_* tables so lesson plans, TOS, assessments,
--   results, and remediation do not need a second curriculum system;
-- - keep every teacher-owned source and curriculum private with RLS;
-- - publish reviewed curricula through guarded RPCs rather than browser CRUD on
--   canonical knowledge tables.

-- -----------------------------------------------------------------------------
-- 1. Ownership/provenance columns on the existing normalized curriculum model.
-- -----------------------------------------------------------------------------

alter table public.source_documents
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists original_filename text,
  add column if not exists storage_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists source_hash text;

alter table public.source_documents
  drop constraint if exists source_documents_source_type_check;

alter table public.source_documents
  add constraint source_documents_source_type_check
  check (source_type in ('curriculum_guide','school_curriculum','deped_order','memorandum','advisory','other'));

alter table public.source_documents
  drop constraint if exists source_documents_file_size_check;

alter table public.source_documents
  add constraint source_documents_file_size_check
  check (file_size_bytes is null or (file_size_bytes >= 0 and file_size_bytes <= 20971520));

alter table public.curriculum_versions
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists origin_kind text not null default 'official',
  add column if not exists base_curriculum_version_id uuid references public.curriculum_versions(id) on delete restrict,
  add column if not exists revision_of_version_id uuid references public.curriculum_versions(id) on delete set null,
  add column if not exists revision_number integer not null default 1,
  add column if not exists organization_name text,
  add column if not exists approval_status text not null default 'approved';

alter table public.curriculum_versions
  drop constraint if exists curriculum_versions_origin_kind_check;
alter table public.curriculum_versions
  add constraint curriculum_versions_origin_kind_check
  check (origin_kind in ('official','custom','hybrid'));

alter table public.curriculum_versions
  drop constraint if exists curriculum_versions_approval_status_check;
alter table public.curriculum_versions
  add constraint curriculum_versions_approval_status_check
  check (approval_status in ('draft','approved','archived'));

alter table public.curriculum_versions
  drop constraint if exists curriculum_versions_revision_number_check;
alter table public.curriculum_versions
  add constraint curriculum_versions_revision_number_check
  check (revision_number > 0);

alter table public.curriculum_competencies
  add column if not exists base_competency_id uuid references public.curriculum_competencies(id) on delete restrict,
  add column if not exists provenance_kind text not null default 'official';

alter table public.curriculum_competencies
  drop constraint if exists curriculum_competencies_provenance_kind_check;
alter table public.curriculum_competencies
  add constraint curriculum_competencies_provenance_kind_check
  check (provenance_kind in ('official','custom','inherited'));

alter table public.teacher_assignments
  add column if not exists curriculum_source_kind text not null default 'official',
  add column if not exists curriculum_version_id uuid references public.curriculum_versions(id) on delete restrict;

alter table public.teacher_assignments
  drop constraint if exists teacher_assignments_curriculum_source_kind_check;
alter table public.teacher_assignments
  add constraint teacher_assignments_curriculum_source_kind_check
  check (curriculum_source_kind in ('official','custom','hybrid'));

create index if not exists idx_source_documents_owner
  on public.source_documents(owner_user_id, updated_at desc)
  where owner_user_id is not null;

create index if not exists idx_curriculum_versions_owner
  on public.curriculum_versions(owner_user_id, status, updated_at desc)
  where owner_user_id is not null;

create index if not exists idx_teacher_assignments_curriculum_version
  on public.teacher_assignments(curriculum_version_id)
  where curriculum_version_id is not null;

create index if not exists idx_curriculum_competencies_base
  on public.curriculum_competencies(base_competency_id)
  where base_competency_id is not null;

-- -----------------------------------------------------------------------------
-- 2. Teacher-owned import/review drafts. Raw files remain in private Storage.
-- -----------------------------------------------------------------------------

create table if not exists public.custom_curriculum_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','analyzing','analyzed','approved','rejected')),
  source_kind text not null check (source_kind in ('upload','paste','manual')),
  curriculum_mode text not null check (curriculum_mode in ('custom','hybrid')),
  base_curriculum_version_id uuid references public.curriculum_versions(id) on delete restrict,
  revision_of_version_id uuid references public.curriculum_versions(id) on delete set null,
  title text not null default '' check (char_length(title) <= 240),
  organization_name text not null default '' check (char_length(organization_name) <= 240),
  school_year text not null,
  grade_level text not null,
  learning_area text not null,
  original_filename text,
  mime_type text,
  storage_path text check (storage_path is null or storage_path like user_id::text || '/%'),
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0 and file_size_bytes <= 20971520),
  source_hash text not null default '',
  analysis_json jsonb not null default '{}'::jsonb check (pg_column_size(analysis_json) <= 8388608),
  review_json jsonb not null default '{}'::jsonb check (pg_column_size(review_json) <= 8388608),
  analysis_model text,
  fallback_used boolean not null default false,
  published_version_id uuid references public.curriculum_versions(id) on delete set null,
  error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_custom_curriculum_imports_user
  on public.custom_curriculum_imports(user_id, updated_at desc);

create trigger custom_curriculum_imports_set_updated_at
before update on public.custom_curriculum_imports
for each row execute function public.set_updated_at();

alter table public.custom_curriculum_imports enable row level security;

create policy "teachers read own curriculum imports"
on public.custom_curriculum_imports for select to authenticated
using ((select auth.uid()) = user_id);

create policy "teachers create own curriculum imports"
on public.custom_curriculum_imports for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "teachers update own unapproved curriculum imports"
on public.custom_curriculum_imports for update to authenticated
using ((select auth.uid()) = user_id and status <> 'approved')
with check ((select auth.uid()) = user_id);

create policy "teachers delete own unapproved curriculum imports"
on public.custom_curriculum_imports for delete to authenticated
using ((select auth.uid()) = user_id and status <> 'approved');

-- Private source documents. 15 MB keeps inline PDF analysis comfortably below
-- the product's 20 MB request guard while allowing normal school curriculum files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'custom-curricula',
  'custom-curricula',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "teachers read own curriculum files"
on storage.objects for select to authenticated
using (
  bucket_id = 'custom-curricula'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "teachers upload own curriculum files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'custom-curricula'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "teachers replace own curriculum files"
on storage.objects for update to authenticated
using (
  bucket_id = 'custom-curricula'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'custom-curricula'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "teachers delete own curriculum files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'custom-curricula'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- -----------------------------------------------------------------------------
-- 3. Read isolation for teacher-owned curriculum rows.
-- Official rows remain readable to every authenticated teacher; private rows
-- are visible only to their owner. Browser clients still cannot mutate these
-- normalized knowledge tables directly.
-- -----------------------------------------------------------------------------

drop policy if exists "knowledge_read_source_documents" on public.source_documents;
create policy "knowledge_read_source_documents" on public.source_documents
for select to authenticated
using (
  verification_status in ('verified','superseded')
  and (owner_user_id is null or owner_user_id = (select auth.uid()))
);

drop policy if exists "knowledge_read_curriculum_versions" on public.curriculum_versions;
create policy "knowledge_read_curriculum_versions" on public.curriculum_versions
for select to authenticated
using (
  status in ('active','superseded')
  and approval_status in ('approved','archived')
  and (owner_user_id is null or owner_user_id = (select auth.uid()))
);

drop policy if exists "knowledge_read_academic_periods" on public.academic_periods;
create policy "knowledge_read_academic_periods" on public.academic_periods
for select to authenticated
using (exists (
  select 1 from public.curriculum_versions cv
  where cv.id = academic_periods.curriculum_version_id
    and cv.status in ('active','superseded')
    and cv.approval_status in ('approved','archived')
    and (cv.owner_user_id is null or cv.owner_user_id = (select auth.uid()))
));

drop policy if exists "knowledge_read_curriculum_subjects" on public.curriculum_subjects;
create policy "knowledge_read_curriculum_subjects" on public.curriculum_subjects
for select to authenticated
using (exists (
  select 1 from public.curriculum_versions cv
  where cv.id = curriculum_subjects.curriculum_version_id
    and cv.status in ('active','superseded')
    and cv.approval_status in ('approved','archived')
    and (cv.owner_user_id is null or cv.owner_user_id = (select auth.uid()))
));

drop policy if exists "knowledge_read_curriculum_domains" on public.curriculum_domains;
create policy "knowledge_read_curriculum_domains" on public.curriculum_domains
for select to authenticated
using (exists (
  select 1
  from public.curriculum_subjects cs
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  where cs.id = curriculum_domains.subject_id
    and cv.status in ('active','superseded')
    and cv.approval_status in ('approved','archived')
    and (cv.owner_user_id is null or cv.owner_user_id = (select auth.uid()))
));

drop policy if exists "knowledge_read_curriculum_standards" on public.curriculum_standards;
create policy "knowledge_read_curriculum_standards" on public.curriculum_standards
for select to authenticated
using (exists (
  select 1
  from public.curriculum_subjects cs
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  where cs.id = curriculum_standards.subject_id
    and cv.status in ('active','superseded')
    and cv.approval_status in ('approved','archived')
    and (cv.owner_user_id is null or cv.owner_user_id = (select auth.uid()))
));

drop policy if exists "knowledge_read_curriculum_competencies" on public.curriculum_competencies;
create policy "knowledge_read_curriculum_competencies" on public.curriculum_competencies
for select to authenticated
using (
  verification_status = 'verified'
  and exists (
    select 1
    from public.curriculum_subjects cs
    join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
    where cs.id = curriculum_competencies.subject_id
      and cv.status in ('active','superseded')
      and cv.approval_status in ('approved','archived')
      and (cv.owner_user_id is null or cv.owner_user_id = (select auth.uid()))
  )
);

drop policy if exists "knowledge_read_curriculum_applicability" on public.curriculum_applicability;
create policy "knowledge_read_curriculum_applicability" on public.curriculum_applicability
for select to authenticated
using (exists (
  select 1 from public.curriculum_versions cv
  where cv.id = curriculum_applicability.curriculum_version_id
    and cv.status in ('active','superseded')
    and cv.approval_status in ('approved','archived')
    and (cv.owner_user_id is null or cv.owner_user_id = (select auth.uid()))
));

-- -----------------------------------------------------------------------------
-- 4. Assignment guard: custom/hybrid assignments must point to an active,
-- approved curriculum owned by the same teacher and matching grade/subject/year.
-- -----------------------------------------------------------------------------

create or replace function public.guard_teacher_assignment_curriculum()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cv public.curriculum_versions%rowtype;
  expected_origin text;
begin
  if new.curriculum_source_kind = 'official' then
    new.curriculum_version_id := null;
    return new;
  end if;

  if new.curriculum_version_id is null then
    raise exception 'A custom or hybrid teaching assignment requires a curriculum version';
  end if;

  select * into cv
  from public.curriculum_versions v
  where v.id = new.curriculum_version_id;

  if cv.id is null or cv.owner_user_id is distinct from new.user_id
     or cv.status <> 'active' or cv.approval_status <> 'approved' then
    raise exception 'The selected custom curriculum is unavailable for this teacher';
  end if;

  expected_origin := case when new.curriculum_source_kind = 'hybrid' then 'hybrid' else 'custom' end;
  if cv.origin_kind <> expected_origin then
    raise exception 'The assignment curriculum source does not match the selected curriculum version';
  end if;

  if not exists (
    select 1 from public.curriculum_subjects cs
    where cs.curriculum_version_id = cv.id
      and cs.grade_level = new.grade_level
      and lower(cs.name) = lower(new.learning_area)
  ) then
    raise exception 'The selected curriculum does not match this grade level and learning area';
  end if;

  if not exists (
    select 1 from public.curriculum_applicability ca
    where ca.curriculum_version_id = cv.id
      and ca.school_year = new.school_year
      and ca.grade_level = new.grade_level
      and ca.implementation_status in ('full','pilot','transitional')
  ) then
    raise exception 'The selected curriculum does not apply to this school year and grade level';
  end if;

  return new;
end;
$$;

drop trigger if exists teacher_assignment_curriculum_guard on public.teacher_assignments;
create trigger teacher_assignment_curriculum_guard
before insert or update of user_id, school_year, grade_level, learning_area, curriculum_source_kind, curriculum_version_id
on public.teacher_assignments
for each row execute function public.guard_teacher_assignment_curriculum();

-- Downstream curriculum links must stay on the curriculum selected by the
-- teaching assignment. This closes a cross-source integrity gap where a browser
-- could otherwise attach a teacher-private competency to an official assignment
-- (or an official/other-private competency to a custom assignment) as long as
-- the grade and learning-area labels happened to match.
create or replace function public.guard_assignment_curriculum_competency_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  d public.documents%rowtype;
  ta public.teacher_assignments%rowtype;
  subject_version_id uuid;
  subject_grade text;
  subject_name text;
  version_owner uuid;
  version_origin text;
  version_status text;
  version_approval text;
begin
  select * into d from public.documents where id = new.document_id;
  if d.id is null then
    raise exception 'Curriculum competency links require an existing document';
  end if;

  -- Unassigned documents keep the historical behavior. Assignment-bound lesson
  -- plans and TOS documents receive the stronger source/version invariant below.
  if d.assignment_id is null then return new; end if;

  select * into ta
  from public.teacher_assignments a
  where a.id = d.assignment_id and a.user_id = d.user_id;

  if ta.id is null then
    raise exception 'The document assignment is unavailable to this teacher';
  end if;

  select cs.curriculum_version_id, cs.grade_level, cs.name,
         cv.owner_user_id, cv.origin_kind, cv.status, cv.approval_status
    into subject_version_id, subject_grade, subject_name,
         version_owner, version_origin, version_status, version_approval
  from public.curriculum_competencies c
  join public.curriculum_subjects cs on cs.id = c.subject_id
  join public.curriculum_versions cv on cv.id = cs.curriculum_version_id
  where c.id = new.competency_id
    and c.verification_status = 'verified';

  if subject_version_id is null then
    raise exception 'The selected curriculum competency is unavailable or unverified';
  end if;

  if subject_grade <> ta.grade_level or lower(subject_name) <> lower(ta.learning_area) then
    raise exception 'The curriculum competency does not match the document assignment';
  end if;

  if version_status not in ('active','superseded')
     or version_approval not in ('approved','archived') then
    raise exception 'The curriculum version is not approved for document use';
  end if;

  if not exists (
    select 1
    from public.curriculum_applicability ca
    where ca.curriculum_version_id = subject_version_id
      and ca.school_year = d.school_year
      and ca.grade_level = ta.grade_level
      and ca.implementation_status in ('full','pilot','transitional','legacy')
  ) then
    raise exception 'The curriculum version does not apply to this document school year and grade level';
  end if;

  if ta.curriculum_source_kind = 'official' then
    if version_origin <> 'official' or version_owner is not null then
      raise exception 'Official assignments can only link official curriculum competencies';
    end if;
  else
    if ta.curriculum_version_id is null
       or subject_version_id <> ta.curriculum_version_id
       or version_owner is distinct from d.user_id
       or version_origin <> ta.curriculum_source_kind then
      raise exception 'The competency does not belong to the curriculum version selected by this assignment';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lesson_plan_assignment_curriculum_guard on public.lesson_plan_competencies;
create trigger lesson_plan_assignment_curriculum_guard
before insert or update of document_id, competency_id on public.lesson_plan_competencies
for each row execute function public.guard_assignment_curriculum_competency_link();

drop trigger if exists tos_assignment_curriculum_guard on public.tos_competencies;
create trigger tos_assignment_curriculum_guard
before insert or update of document_id, competency_id on public.tos_competencies
for each row execute function public.guard_assignment_curriculum_competency_link();

-- -----------------------------------------------------------------------------
-- 5. Guarded publication RPC. The teacher reviews structured JSON in the UI;
-- this RPC validates bounded structure, materializes it into normalized tables,
-- and marks only that teacher's source as verified/approved.
-- -----------------------------------------------------------------------------

create or replace function public.publish_custom_curriculum(
  p_import_id uuid,
  p_review_json jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  imp public.custom_curriculum_imports%rowtype;
  source_id uuid := gen_random_uuid();
  version_id uuid := gen_random_uuid();
  subject_id uuid := gen_random_uuid();
  title_value text;
  grade_value text;
  area_value text;
  year_value text;
  organization_value text;
  version_code text;
  period_map jsonb := '{}'::jsonb;
  domain_map jsonb := '{}'::jsonb;
  item jsonb;
  old_period public.academic_periods%rowtype;
  old_domain public.curriculum_domains%rowtype;
  old_standard public.curriculum_standards%rowtype;
  old_competency public.curriculum_competencies%rowtype;
  old_subject public.curriculum_subjects%rowtype;
  new_id uuid;
  period_id uuid;
  domain_id uuid;
  period_key text;
  domain_key text;
  standard_type_value text;
  competency_count integer;
  period_count integer;
  domain_count integer;
  standards_count integer;
  review_mode text;
  next_revision integer := 1;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  if jsonb_typeof(p_review_json) is distinct from 'object' then raise exception 'Curriculum review must be a JSON object'; end if;
  if pg_column_size(p_review_json) > 8388608 then raise exception 'Curriculum review is too large'; end if;

  select * into imp
  from public.custom_curriculum_imports ci
  where ci.id = p_import_id and ci.user_id = owner_id
  for update;

  if imp.id is null then raise exception 'Curriculum import was not found'; end if;
  if imp.status = 'approved' then
    if imp.published_version_id is not null then return imp.published_version_id; end if;
    raise exception 'This curriculum import is already approved';
  end if;
  if imp.status not in ('draft','analyzed') then raise exception 'This curriculum import is not ready for approval'; end if;

  review_mode := coalesce(nullif(p_review_json ->> 'curriculumMode', ''), imp.curriculum_mode);
  if review_mode not in ('custom','hybrid') then raise exception 'Curriculum mode must be custom or hybrid'; end if;
  if review_mode = 'hybrid' and imp.base_curriculum_version_id is null then raise exception 'Hybrid curriculum requires a verified base curriculum'; end if;
  if review_mode = 'hybrid' and not exists (
    select 1
    from public.curriculum_versions base
    where base.id = imp.base_curriculum_version_id
      and base.status in ('active','superseded')
      and base.approval_status = 'approved'
      and base.origin_kind = 'official'
      and base.owner_user_id is null
  ) then
    raise exception 'The selected hybrid base curriculum is unavailable to this teacher';
  end if;

  title_value := btrim(coalesce(nullif(p_review_json ->> 'title', ''), imp.title));
  grade_value := btrim(coalesce(nullif(p_review_json ->> 'gradeLevel', ''), imp.grade_level));
  area_value := btrim(coalesce(nullif(p_review_json ->> 'learningArea', ''), imp.learning_area));
  year_value := btrim(coalesce(nullif(p_review_json ->> 'schoolYear', ''), imp.school_year));
  organization_value := btrim(coalesce(nullif(p_review_json ->> 'organizationName', ''), imp.organization_name));

  if title_value = '' or char_length(title_value) > 240 then raise exception 'Curriculum title is required and must be 240 characters or fewer'; end if;
  if grade_value = '' or char_length(grade_value) > 80 then raise exception 'Grade level is required'; end if;
  if area_value = '' or char_length(area_value) > 160 then raise exception 'Learning area is required'; end if;
  if year_value !~ '^[0-9]{4}-[0-9]{4}$' then raise exception 'School year must use YYYY-YYYY'; end if;
  if char_length(organization_value) > 240 then raise exception 'Organization name is too long'; end if;

  if jsonb_typeof(p_review_json -> 'periods') is distinct from 'array'
     or jsonb_typeof(p_review_json -> 'domains') is distinct from 'array'
     or jsonb_typeof(p_review_json -> 'competencies') is distinct from 'array'
     or jsonb_typeof(coalesce(p_review_json -> 'standards', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Curriculum review arrays are malformed';
  end if;

  period_count := jsonb_array_length(p_review_json -> 'periods');
  domain_count := jsonb_array_length(p_review_json -> 'domains');
  competency_count := jsonb_array_length(p_review_json -> 'competencies');
  standards_count := jsonb_array_length(coalesce(p_review_json -> 'standards', '[]'::jsonb));
  if period_count < 1 or period_count > 16 then raise exception 'Curriculum must contain 1 to 16 periods'; end if;
  if domain_count < 1 or domain_count > 120 then raise exception 'Curriculum must contain 1 to 120 domains/strands'; end if;
  if competency_count < 1 or competency_count > 2500 then raise exception 'Curriculum must contain 1 to 2500 competencies/objectives'; end if;
  if standards_count > 800 then raise exception 'Curriculum contains too many standards'; end if;

  if imp.revision_of_version_id is not null then
    select coalesce(max(v.revision_number), 0) + 1 into next_revision
    from public.curriculum_versions v
    where (v.id = imp.revision_of_version_id or v.revision_of_version_id = imp.revision_of_version_id)
      and v.owner_user_id = owner_id;
  end if;

  version_code := 'SCH-' || upper(substr(replace(p_import_id::text, '-', ''), 1, 12)) || '-R' || next_revision::text;

  insert into public.source_documents (
    id, source_type, title, publisher, content_hash, verification_status,
    owner_user_id, original_filename, storage_path, file_size_bytes, source_hash
  ) values (
    source_id,
    'school_curriculum',
    title_value,
    coalesce(nullif(organization_value, ''), 'Teacher-provided school curriculum'),
    nullif(imp.source_hash, ''),
    'verified',
    owner_id,
    imp.original_filename,
    imp.storage_path,
    imp.file_size_bytes,
    nullif(imp.source_hash, '')
  );

  insert into public.curriculum_versions (
    id, code, name, framework, effective_from_school_year, status,
    source_document_id, implementation_notes, owner_user_id, origin_kind,
    base_curriculum_version_id, revision_of_version_id, revision_number,
    organization_name, approval_status
  ) values (
    version_id,
    version_code,
    title_value,
    case when review_mode = 'hybrid' then 'School hybrid curriculum' else 'School custom curriculum' end,
    year_value,
    'active',
    source_id,
    case when review_mode = 'hybrid' then 'Teacher-approved school enrichment layered on an inherited base curriculum.' else 'Teacher-approved private-school/custom curriculum.' end,
    owner_id,
    review_mode,
    imp.base_curriculum_version_id,
    imp.revision_of_version_id,
    next_revision,
    nullif(organization_value, ''),
    'approved'
  );

  -- Publishing a revision supersedes the teacher-owned previous version for
  -- new assignments while preserving it for historical documents and reloads.
  if imp.revision_of_version_id is not null then
    update public.curriculum_versions previous
    set status = 'superseded', updated_at = timezone('utc', now())
    where previous.id = imp.revision_of_version_id
      and previous.owner_user_id = owner_id
      and previous.origin_kind in ('custom','hybrid')
      and previous.status = 'active';
  end if;

  insert into public.curriculum_subjects (
    id, curriculum_version_id, grade_level, name, description, source_document_id
  ) values (
    subject_id, version_id, grade_value, area_value,
    case when review_mode = 'hybrid' then 'Hybrid curriculum: inherited base plus school enrichment.' else 'Teacher-approved school curriculum.' end,
    source_id
  );

  -- Hybrid mode clones the selected official/base subject into the teacher-owned
  -- version before adding school-specific material. The original official rows
  -- remain immutable, and each inherited competency retains base_competency_id.
  if review_mode = 'hybrid' then
    select * into old_subject
    from public.curriculum_subjects cs
    where cs.curriculum_version_id = imp.base_curriculum_version_id
      and cs.grade_level = grade_value
      and lower(cs.name) = lower(area_value)
    order by cs.created_at
    limit 1;

    if old_subject.id is null then
      raise exception 'The selected base curriculum does not contain this grade level and learning area';
    end if;

    for old_period in
      select ap.* from public.academic_periods ap
      where ap.curriculum_version_id = imp.base_curriculum_version_id
        and ap.subject_id = old_subject.id
      order by ap.sequence
    loop
      new_id := gen_random_uuid();
      insert into public.academic_periods (
        id, curriculum_version_id, subject_id, label, sequence, period_type, grade_min, grade_max
      ) values (
        new_id, version_id, subject_id, old_period.label, old_period.sequence,
        old_period.period_type, old_period.grade_min, old_period.grade_max
      );
      period_map := period_map || jsonb_build_object(old_period.id::text, new_id::text);
    end loop;

    for old_domain in
      select cd.* from public.curriculum_domains cd
      where cd.subject_id = old_subject.id
      order by cd.sort_order, cd.name
    loop
      new_id := gen_random_uuid();
      insert into public.curriculum_domains (id, subject_id, code, name, sort_order)
      values (new_id, subject_id, old_domain.code, old_domain.name, old_domain.sort_order);
      domain_map := domain_map || jsonb_build_object(old_domain.id::text, new_id::text);
    end loop;

    for old_standard in
      select csd.* from public.curriculum_standards csd
      where csd.subject_id = old_subject.id
      order by csd.sort_order, csd.created_at
    loop
      insert into public.curriculum_standards (
        subject_id, domain_id, academic_period_id, standard_type, standard_text,
        sort_order, source_document_id, source_page
      ) values (
        subject_id,
        case when old_standard.domain_id is null then null else nullif(domain_map ->> old_standard.domain_id::text, '')::uuid end,
        case when old_standard.academic_period_id is null then null else nullif(period_map ->> old_standard.academic_period_id::text, '')::uuid end,
        old_standard.standard_type,
        old_standard.standard_text,
        old_standard.sort_order,
        old_standard.source_document_id,
        old_standard.source_page
      );
    end loop;

    for old_competency in
      select cc.* from public.curriculum_competencies cc
      where cc.subject_id = old_subject.id
        and cc.verification_status = 'verified'
      order by cc.sort_order, cc.created_at
    loop
      insert into public.curriculum_competencies (
        subject_id, domain_id, academic_period_id, competency_code, competency_text,
        sort_order, source_document_id, source_page, verification_status,
        base_competency_id, provenance_kind
      ) values (
        subject_id,
        case when old_competency.domain_id is null then null else nullif(domain_map ->> old_competency.domain_id::text, '')::uuid end,
        case when old_competency.academic_period_id is null then null else nullif(period_map ->> old_competency.academic_period_id::text, '')::uuid end,
        old_competency.competency_code,
        old_competency.competency_text,
        old_competency.sort_order,
        old_competency.source_document_id,
        old_competency.source_page,
        'verified',
        old_competency.id,
        'inherited'
      );
    end loop;
  end if;

  -- Review periods. Duplicate labels in hybrid mode reuse the inherited period.
  for item in select value from jsonb_array_elements(p_review_json -> 'periods')
  loop
    period_key := btrim(coalesce(item ->> 'key', item ->> 'label', ''));
    if period_key = '' then raise exception 'Every curriculum period requires a key or label'; end if;
    if btrim(coalesce(item ->> 'label', '')) = '' then raise exception 'Every curriculum period requires a label'; end if;

    select ap.id into period_id
    from public.academic_periods ap
    where ap.subject_id = subject_id and lower(ap.label) = lower(btrim(item ->> 'label'))
    limit 1;

    if period_id is null then
      period_id := gen_random_uuid();
      insert into public.academic_periods (
        id, curriculum_version_id, subject_id, label, sequence, period_type
      ) values (
        period_id, version_id, subject_id,
        left(btrim(item ->> 'label'), 120),
        greatest(1, least(50, coalesce((item ->> 'sequence')::integer, 1))),
        case when item ->> 'periodType' in ('term','quarter','semester','year') then item ->> 'periodType' else 'quarter' end
      );
    end if;
    period_map := period_map || jsonb_build_object(period_key, period_id::text);
  end loop;

  -- Review domains/strands. Duplicate names in hybrid mode reuse the inherited domain.
  for item in select value from jsonb_array_elements(p_review_json -> 'domains')
  loop
    domain_key := btrim(coalesce(item ->> 'key', item ->> 'name', ''));
    if domain_key = '' or btrim(coalesce(item ->> 'name', '')) = '' then raise exception 'Every curriculum domain requires a key and name'; end if;

    select cd.id into domain_id
    from public.curriculum_domains cd
    where cd.subject_id = subject_id and lower(cd.name) = lower(btrim(item ->> 'name'))
    limit 1;

    if domain_id is null then
      domain_id := gen_random_uuid();
      insert into public.curriculum_domains (id, subject_id, code, name, sort_order)
      values (
        domain_id,
        subject_id,
        nullif(left(btrim(coalesce(item ->> 'code', '')), 80), ''),
        left(btrim(item ->> 'name'), 200),
        greatest(0, least(10000, coalesce((item ->> 'sortOrder')::integer, 0)))
      );
    end if;
    domain_map := domain_map || jsonb_build_object(domain_key, domain_id::text);
  end loop;

  -- Teacher-reviewed school standards.
  for item in select value from jsonb_array_elements(coalesce(p_review_json -> 'standards', '[]'::jsonb))
  loop
    if btrim(coalesce(item ->> 'standardText', '')) = '' then raise exception 'A curriculum standard has empty text'; end if;
    if char_length(item ->> 'standardText') > 12000 then raise exception 'A curriculum standard is too long'; end if;
    standard_type_value := coalesce(nullif(item ->> 'standardType', ''), 'other');
    if standard_type_value not in ('content','performance','stage','key_stage','other') then standard_type_value := 'other'; end if;
    domain_key := nullif(btrim(coalesce(item ->> 'domainKey', '')), '');
    period_key := nullif(btrim(coalesce(item ->> 'periodKey', '')), '');
    if domain_key is not null and nullif(domain_map ->> domain_key, '') is null then raise exception 'A standard references an unknown domain key'; end if;
    if period_key is not null and nullif(period_map ->> period_key, '') is null then raise exception 'A standard references an unknown period key'; end if;
    insert into public.curriculum_standards (
      subject_id, domain_id, academic_period_id, standard_type, standard_text,
      sort_order, source_document_id, source_page
    ) values (
      subject_id,
      case when domain_key is null then null else nullif(domain_map ->> domain_key, '')::uuid end,
      case when period_key is null then null else nullif(period_map ->> period_key, '')::uuid end,
      standard_type_value,
      btrim(item ->> 'standardText'),
      greatest(0, least(100000, coalesce((item ->> 'sortOrder')::integer, 0))),
      source_id,
      case when coalesce(item ->> 'sourcePage', '') ~ '^[0-9]+$' then (item ->> 'sourcePage')::integer else null end
    );
  end loop;

  -- Teacher-reviewed school competencies/objectives. They are marked verified
  -- only after this explicit approval action; the owner/source metadata still
  -- distinguishes them from official DepEd records.
  for item in select value from jsonb_array_elements(p_review_json -> 'competencies')
  loop
    if btrim(coalesce(item ->> 'competencyText', '')) = '' then raise exception 'A curriculum competency/objective has empty text'; end if;
    if char_length(item ->> 'competencyText') > 12000 then raise exception 'A curriculum competency/objective is too long'; end if;
    domain_key := nullif(btrim(coalesce(item ->> 'domainKey', '')), '');
    period_key := nullif(btrim(coalesce(item ->> 'periodKey', '')), '');
    if domain_key is not null and nullif(domain_map ->> domain_key, '') is null then raise exception 'A competency references an unknown domain key'; end if;
    if period_key is not null and nullif(period_map ->> period_key, '') is null then raise exception 'A competency references an unknown period key'; end if;

    insert into public.curriculum_competencies (
      subject_id, domain_id, academic_period_id, competency_code, competency_text,
      sort_order, source_document_id, source_page, verification_status,
      base_competency_id, provenance_kind
    ) values (
      subject_id,
      case when domain_key is null then null else nullif(domain_map ->> domain_key, '')::uuid end,
      case when period_key is null then null else nullif(period_map ->> period_key, '')::uuid end,
      nullif(left(btrim(coalesce(item ->> 'competencyCode', '')), 120), ''),
      btrim(item ->> 'competencyText'),
      greatest(0, least(100000, coalesce((item ->> 'sortOrder')::integer, 0))),
      source_id,
      case when coalesce(item ->> 'sourcePage', '') ~ '^[0-9]+$' then (item ->> 'sourcePage')::integer else null end,
      'verified',
      null,
      'custom'
    );
  end loop;

  insert into public.curriculum_applicability (
    curriculum_version_id, school_year, grade_level, implementation_status,
    priority, source_document_id, notes
  ) values (
    version_id, year_value, grade_value, 'full', 1, source_id,
    case when review_mode = 'hybrid' then 'Teacher-approved hybrid school curriculum.' else 'Teacher-approved private/custom school curriculum.' end
  );

  update public.custom_curriculum_imports ci
  set status = 'approved',
      curriculum_mode = review_mode,
      title = title_value,
      organization_name = organization_value,
      school_year = year_value,
      grade_level = grade_value,
      learning_area = area_value,
      review_json = p_review_json,
      published_version_id = version_id,
      error_code = null,
      updated_at = timezone('utc', now())
  where ci.id = imp.id;

  return version_id;
end;
$$;

revoke all on function public.publish_custom_curriculum(uuid, jsonb) from public, anon;
grant execute on function public.publish_custom_curriculum(uuid, jsonb) to authenticated;

-- Archive only teacher-owned custom/hybrid versions. Existing documents keep
-- readable snapshots because archived versions are represented as superseded.
create or replace function public.archive_custom_curriculum(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  update public.curriculum_versions v
  set status = 'superseded', approval_status = 'archived', updated_at = timezone('utc', now())
  where v.id = p_version_id
    and v.owner_user_id = owner_id
    and v.origin_kind in ('custom','hybrid')
    and v.status = 'active';
  if not found then raise exception 'Custom curriculum version was not found or is already archived'; end if;
end;
$$;

revoke all on function public.archive_custom_curriculum(uuid) from public, anon;
grant execute on function public.archive_custom_curriculum(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Explicit Data API grants for the new teacher-owned staging table.
-- Canonical curriculum tables remain browser read-only; writes are RPC-only.
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on public.custom_curriculum_imports to authenticated;
grant select, insert, update, delete on public.custom_curriculum_imports to service_role;
revoke all on public.custom_curriculum_imports from anon;

comment on table public.custom_curriculum_imports is
  'Teacher-owned private/custom curriculum import drafts. Source files are private; AI analysis is draft-only until explicit teacher approval publishes normalized curriculum rows.';
comment on column public.curriculum_versions.origin_kind is
  'official = immutable DepEd/admin knowledge; custom = teacher-owned school curriculum; hybrid = inherited base curriculum plus teacher-owned enrichment.';
comment on column public.curriculum_competencies.base_competency_id is
  'For hybrid curricula, points to the immutable inherited competency. Custom additions leave this null.';
