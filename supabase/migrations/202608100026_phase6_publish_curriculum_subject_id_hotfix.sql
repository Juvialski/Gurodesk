-- GuroDesk Phase 6 universal curriculum publication hotfix.
--
-- Migration 025 may already be applied, so this additive migration does not
-- rewrite history. It replaces the publication RPC with equivalent logic that
-- uses an unambiguous local subject UUID name. PostgreSQL otherwise treats
-- `subject_id` in predicates such as `ap.subject_id = subject_id` as ambiguous
-- between the PL/pgSQL variable and the table column (SQLSTATE 42702).
--
-- This migration deliberately does NOT add Gemini model discovery or alter the
-- established Gemini 3.5/3.1 Flash-Lite BYOK policy.

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
  published_subject_id uuid := gen_random_uuid();
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
    published_subject_id, version_id, grade_value, area_value,
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
        new_id, version_id, published_subject_id, old_period.label, old_period.sequence,
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
      values (new_id, published_subject_id, old_domain.code, old_domain.name, old_domain.sort_order);
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
        published_subject_id,
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
        published_subject_id,
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
    where ap.subject_id = published_subject_id and lower(ap.label) = lower(btrim(item ->> 'label'))
    limit 1;

    if period_id is null then
      period_id := gen_random_uuid();
      insert into public.academic_periods (
        id, curriculum_version_id, subject_id, label, sequence, period_type
      ) values (
        period_id, version_id, published_subject_id,
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
    where cd.subject_id = published_subject_id and lower(cd.name) = lower(btrim(item ->> 'name'))
    limit 1;

    if domain_id is null then
      domain_id := gen_random_uuid();
      insert into public.curriculum_domains (id, subject_id, code, name, sort_order)
      values (
        domain_id,
        published_subject_id,
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
      published_subject_id,
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
      published_subject_id,
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
