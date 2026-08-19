-- GuroDesk Admin Dashboard & Teacher Adoption Foundation
-- Provides security-definer RPC functions for administrative oversight,
-- registration tracking, user flow funnels, and geographic adoption metrics.

create or replace function public.get_admin_overview_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_users integer := 0;
  v_new_24h integer := 0;
  v_new_7d integer := 0;
  v_new_30d integer := 0;
  v_onboarded integer := 0;
  v_total_assignments integer := 0;
  v_total_lesson_plans integer := 0;
  v_total_assessments integer := 0;
  v_total_tos integer := 0;
  v_total_results integer := 0;
  v_total_remediations integer := 0;
  v_active_7d integer := 0;
  v_ai_configured integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  -- Total registered profiles
  select count(*) into v_total_users from public.profiles;

  -- New registrations within time windows
  select count(*) into v_new_24h from public.profiles where created_at >= (v_now - interval '24 hours');
  select count(*) into v_new_7d from public.profiles where created_at >= (v_now - interval '7 days');
  select count(*) into v_new_30d from public.profiles where created_at >= (v_now - interval '30 days');

  -- Onboarding completion
  select count(*) into v_onboarded from public.profiles where onboarding_completed = true;

  -- Total teaching assignments
  select count(*) into v_total_assignments from public.teacher_assignments where is_active = true;

  -- Document counts by type
  select count(*) into v_total_lesson_plans from public.documents where document_type = 'lesson_plan' and status <> 'archived';
  select count(*) into v_total_assessments from public.documents where document_type = 'assessment' and status <> 'archived';
  select count(*) into v_total_tos from public.documents where document_type = 'tos' and status <> 'archived';

  -- Result sessions and remediation plans (remediation_plans uses review_state)
  select count(*) into v_total_results from public.result_sessions where status <> 'archived';
  select count(*) into v_total_remediations from public.remediation_plans where review_state <> 'archived';

  -- Active users in the last 7 days (profiles updated or created documents recently)
  select count(distinct id) into v_active_7d
  from (
    select id from public.profiles where updated_at >= (v_now - interval '7 days')
    union
    select user_id as id from public.documents where updated_at >= (v_now - interval '7 days') and status <> 'archived'
    union
    select user_id as id from public.result_sessions where updated_at >= (v_now - interval '7 days') and status <> 'archived'
    union
    select user_id as id from public.remediation_plans where updated_at >= (v_now - interval '7 days') and review_state <> 'archived'
  ) active_set;

  -- Teachers with AI credentials configured
  select count(distinct user_id) into v_ai_configured from public.teacher_ai_credentials;

  return jsonb_build_object(
    'totalUsers', v_total_users,
    'newUsersLast24Hours', v_new_24h,
    'newUsersLast7Days', v_new_7d,
    'newUsersLast30Days', v_new_30d,
    'onboardingCompletedCount', v_onboarded,
    'onboardingRatePercentage', case when v_total_users > 0 then round((v_onboarded::numeric / v_total_users::numeric) * 100) else 0 end,
    'totalTeachingAssignments', v_total_assignments,
    'totalLessonPlans', v_total_lesson_plans,
    'totalAssessments', v_total_assessments,
    'totalTosDocuments', v_total_tos,
    'totalResultSessions', v_total_results,
    'totalLearnersEvaluated', (select coalesce(count(*), 0) from public.result_session_learners),
    'totalRemediationPlans', v_total_remediations,
    'activeUsersLast7Days', v_active_7d,
    'aiConfiguredCount', v_ai_configured
  );
end;
$$;

grant execute on function public.get_admin_overview_metrics() to authenticated;

create or replace function public.get_admin_registration_trends()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with daily_counts as (
    select
      date_trunc('day', created_at)::date as reg_date,
      count(*)::integer as reg_count
    from public.profiles
    where created_at >= (timezone('utc', now()) - interval '30 days')
    group by date_trunc('day', created_at)::date
  ),
  with_cumulative as (
    select
      reg_date,
      reg_count,
      sum(reg_count) over (order by reg_date asc)::integer as cumulative_count
    from daily_counts
    order by reg_date asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(reg_date, 'YYYY-MM-DD'),
        'label', to_char(reg_date, 'Mon DD'),
        'registrations', reg_count,
        'cumulative', cumulative_count
      )
    ),
    '[]'::jsonb
  )
  from with_cumulative;
$$;

grant execute on function public.get_admin_registration_trends() to authenticated;

create or replace function public.get_admin_region_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with region_agg as (
    select
      coalesce(nullif(trim(p.region), ''), 'Unspecified Region') as region_name,
      count(p.id)::integer as teacher_count,
      count(case when p.onboarding_completed then 1 end)::integer as onboarded_count,
      count(distinct nullif(trim(p.division), ''))::integer as divisions_count,
      coalesce(sum((select count(*) from public.documents d where d.user_id = p.id and d.status <> 'archived')), 0)::integer as doc_count
    from public.profiles p
    group by coalesce(nullif(trim(p.region), ''), 'Unspecified Region')
    order by teacher_count desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'region', region_name,
        'teacherCount', teacher_count,
        'onboardingCount', onboarded_count,
        'documentCount', doc_count,
        'divisionsCount', divisions_count
      )
    ),
    '[]'::jsonb
  )
  from region_agg;
$$;

grant execute on function public.get_admin_region_stats() to authenticated;

create or replace function public.get_admin_user_flow()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_users integer := 0;
  v_onboarded integer := 0;
  v_with_assignments integer := 0;
  v_with_lp integer := 0;
  v_with_tos integer := 0;
  v_with_assessments integer := 0;
  v_with_results integer := 0;
  v_with_remediation integer := 0;
  v_with_ai integer := 0;
  v_lp_total integer := 0;
  v_tos_total integer := 0;
  v_assessments_total integer := 0;
  v_results_total integer := 0;
  v_remediations_total integer := 0;
  v_avg_time_minutes numeric := null;
begin
  select count(*) into v_total_users from public.profiles;
  select count(*) into v_onboarded from public.profiles where onboarding_completed = true;

  select count(distinct user_id) into v_with_assignments from public.teacher_assignments where is_active = true;

  select count(distinct user_id), count(*) into v_with_lp, v_lp_total
  from public.documents where document_type = 'lesson_plan' and status <> 'archived';

  select count(distinct user_id), count(*) into v_with_tos, v_tos_total
  from public.documents where document_type = 'tos' and status <> 'archived';

  select count(distinct user_id), count(*) into v_with_assessments, v_assessments_total
  from public.documents where document_type = 'assessment' and status <> 'archived';

  select count(distinct user_id), count(*) into v_with_results, v_results_total
  from public.result_sessions where status <> 'archived';

  select count(distinct user_id), count(*) into v_with_remediation, v_remediations_total
  from public.remediation_plans where review_state <> 'archived';

  select count(distinct user_id) into v_with_ai from public.teacher_ai_credentials;

  -- Real average time from profile creation to first created document in minutes
  select round(avg(extract(epoch from (first_doc.created_at - p.created_at)) / 60.0)::numeric, 1)
  into v_avg_time_minutes
  from public.profiles p
  join (
    select user_id, min(created_at) as created_at
    from public.documents
    where status <> 'archived'
    group by user_id
  ) first_doc on first_doc.user_id = p.id
  where first_doc.created_at >= p.created_at;

  return jsonb_build_object(
    'funnelStages', jsonb_build_array(
      jsonb_build_object(
        'id', 'stage-signup',
        'label', 'Signed Up',
        'description', 'Total registered teacher accounts',
        'count', v_total_users,
        'percentageOfTotal', 100,
        'dropoffPercentage', 0,
        'stepNumber', 1
      ),
      jsonb_build_object(
        'id', 'stage-onboarding',
        'label', 'Onboarding Completed',
        'description', 'Profile and school identity verified',
        'count', v_onboarded,
        'percentageOfTotal', case when v_total_users > 0 then round((v_onboarded::numeric / v_total_users::numeric) * 100) else 0 end,
        'dropoffPercentage', case when v_total_users > 0 then round(((v_total_users - v_onboarded)::numeric / v_total_users::numeric) * 100) else 0 end,
        'stepNumber', 2
      ),
      jsonb_build_object(
        'id', 'stage-assignments',
        'label', 'Teaching Classes Setup',
        'description', 'Added grade level, subject & sections',
        'count', v_with_assignments,
        'percentageOfTotal', case when v_total_users > 0 then round((v_with_assignments::numeric / v_total_users::numeric) * 100) else 0 end,
        'dropoffPercentage', case when v_total_users > 0 then round(((v_onboarded - v_with_assignments)::numeric / v_total_users::numeric) * 100) else 0 end,
        'stepNumber', 3
      ),
      jsonb_build_object(
        'id', 'stage-lesson-plans',
        'label', 'Lesson Plans Generated',
        'description', 'Created DepEd DLL / DLP drafts',
        'count', v_with_lp,
        'percentageOfTotal', case when v_total_users > 0 then round((v_with_lp::numeric / v_total_users::numeric) * 100) else 0 end,
        'dropoffPercentage', case when v_total_users > 0 then round(((v_with_assignments - v_with_lp)::numeric / v_total_users::numeric) * 100) else 0 end,
        'stepNumber', 4
      ),
      jsonb_build_object(
        'id', 'stage-assessments',
        'label', 'Assessments Built',
        'description', 'Built TOS and DepEd test questions',
        'count', v_with_assessments,
        'percentageOfTotal', case when v_total_users > 0 then round((v_with_assessments::numeric / v_total_users::numeric) * 100) else 0 end,
        'dropoffPercentage', case when v_total_users > 0 then round(((v_with_lp - v_with_assessments)::numeric / v_total_users::numeric) * 100) else 0 end,
        'stepNumber', 5
      ),
      jsonb_build_object(
        'id', 'stage-results',
        'label', 'Results & Item Analysis',
        'description', 'Encoded scores and psychometric indices',
        'count', v_with_results,
        'percentageOfTotal', case when v_total_users > 0 then round((v_with_results::numeric / v_total_users::numeric) * 100) else 0 end,
        'dropoffPercentage', case when v_total_users > 0 then round(((v_with_assessments - v_with_results)::numeric / v_total_users::numeric) * 100) else 0 end,
        'stepNumber', 6
      ),
      jsonb_build_object(
        'id', 'stage-remediation',
        'label', 'Remediation Plans',
        'description', 'Targeted support for struggling competencies',
        'count', v_with_remediation,
        'percentageOfTotal', case when v_total_users > 0 then round((v_with_remediation::numeric / v_total_users::numeric) * 100) else 0 end,
        'dropoffPercentage', case when v_total_users > 0 then round(((v_with_results - v_with_remediation)::numeric / v_total_users::numeric) * 100) else 0 end,
        'stepNumber', 7
      )
    ),
    'featureAdoptions', jsonb_build_array(
      jsonb_build_object(
        'featureName', 'Lesson Planning (DO 42, s. 2016)',
        'description', 'Daily Lesson Logs and Detailed Lesson Plans',
        'activeTeachers', v_with_lp,
        'percentageOfOnboarded', case when v_onboarded > 0 then round((v_with_lp::numeric / v_onboarded::numeric) * 100) else 0 end,
        'totalEntitiesCreated', v_lp_total
      ),
      jsonb_build_object(
        'featureName', 'Table of Specifications (TOS)',
        'description', 'DepEd 60-30-10 cognitive item distributions',
        'activeTeachers', v_with_tos,
        'percentageOfOnboarded', case when v_onboarded > 0 then round((v_with_tos::numeric / v_onboarded::numeric) * 100) else 0 end,
        'totalEntitiesCreated', v_tos_total
      ),
      jsonb_build_object(
        'featureName', 'Assessment Engine (11 Question Types)',
        'description', 'Test generation, DOCX/PDF export & print previews',
        'activeTeachers', v_with_assessments,
        'percentageOfOnboarded', case when v_onboarded > 0 then round((v_with_assessments::numeric / v_onboarded::numeric) * 100) else 0 end,
        'totalEntitiesCreated', v_assessments_total
      ),
      jsonb_build_object(
        'featureName', 'Class Results & Item Analysis',
        'description', 'Difficulty, discrimination & mastery tracking',
        'activeTeachers', v_with_results,
        'percentageOfOnboarded', case when v_onboarded > 0 then round((v_with_results::numeric / v_onboarded::numeric) * 100) else 0 end,
        'totalEntitiesCreated', v_results_total
      ),
      jsonb_build_object(
        'featureName', 'Targeted Remediation',
        'description', 'Personalized intervention plans for unmastered items',
        'activeTeachers', v_with_remediation,
        'percentageOfOnboarded', case when v_onboarded > 0 then round((v_with_remediation::numeric / v_onboarded::numeric) * 100) else 0 end,
        'totalEntitiesCreated', v_remediations_total
      ),
      jsonb_build_object(
        'featureName', 'AI Assistance (Gemini BYOK)',
        'description', 'Teachers with personal API key connected',
        'activeTeachers', v_with_ai,
        'percentageOfOnboarded', case when v_onboarded > 0 then round((v_with_ai::numeric / v_onboarded::numeric) * 100) else 0 end,
        'totalEntitiesCreated', 0
      )
    ),
    'averageTimeFromSignupToFirstDocMinutes', v_avg_time_minutes
  );
end;
$$;

grant execute on function public.get_admin_user_flow() to authenticated;

create or replace function public.get_admin_teacher_directory(
  p_search text default '',
  p_region text default '',
  p_division text default '',
  p_onboarding_status text default 'all',
  p_sort_by text default 'createdAt',
  p_sort_direction text default 'desc',
  p_page integer default 1,
  p_page_size integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offset integer;
  v_total_count integer := 0;
  v_teachers jsonb;
begin
  v_offset := greatest(coalesce(p_page - 1, 0), 0) * greatest(coalesce(p_page_size, 15), 1);

  select count(*) into v_total_count
  from public.profiles p
  where (
    nullif(trim(p_search), '') is null
    or p.full_name ilike '%' || trim(p_search) || '%'
    or p.email ilike '%' || trim(p_search) || '%'
    or p.school_name ilike '%' || trim(p_search) || '%'
    or p.school_id ilike '%' || trim(p_search) || '%'
    or p.division ilike '%' || trim(p_search) || '%'
  )
  and (nullif(trim(p_region), '') is null or p.region = trim(p_region))
  and (nullif(trim(p_division), '') is null or p.division = trim(p_division))
  and (
    p_onboarding_status = 'all'
    or (p_onboarding_status = 'completed' and p.onboarding_completed = true)
    or (p_onboarding_status = 'pending' and p.onboarding_completed = false)
  );

  with teacher_metrics as (
    select
      p.id,
      p.email,
      p.full_name as "fullName",
      p.school_name as "schoolName",
      p.school_id as "schoolId",
      p.region,
      p.division,
      p.district,
      p.district_verified as "districtVerified",
      p.position_title as "positionTitle",
      p.school_year as "schoolYear",
      p.onboarding_completed as "onboardingCompleted",
      p.created_at as "createdAt",
      p.updated_at as "lastActiveAt",
      (select count(*)::integer from public.teacher_assignments ta where ta.user_id = p.id and ta.is_active = true) as "assignmentsCount",
      (select count(*)::integer from public.documents d where d.user_id = p.id and d.document_type = 'lesson_plan' and d.status <> 'archived') as "lessonPlansCount",
      (select count(*)::integer from public.documents d where d.user_id = p.id and d.document_type = 'assessment' and d.status <> 'archived') as "assessmentsCount",
      (select count(*)::integer from public.documents d where d.user_id = p.id and d.document_type = 'tos' and d.status <> 'archived') as "tosCount",
      (select count(*)::integer from public.result_sessions rs where rs.user_id = p.id and rs.status <> 'archived') as "resultSessionsCount",
      (select count(*)::integer from public.remediation_plans rp where rp.user_id = p.id and rp.review_state <> 'archived') as "remediationPlansCount",
      (select count(*)::integer from public.documents d where d.user_id = p.id and d.status <> 'archived') as "totalDocumentsCount",
      exists (select 1 from public.teacher_ai_credentials tac where tac.user_id = p.id) as "hasAiConfigured"
    from public.profiles p
    where (
      nullif(trim(p_search), '') is null
      or p.full_name ilike '%' || trim(p_search) || '%'
      or p.email ilike '%' || trim(p_search) || '%'
      or p.school_name ilike '%' || trim(p_search) || '%'
      or p.school_id ilike '%' || trim(p_search) || '%'
      or p.division ilike '%' || trim(p_search) || '%'
    )
    and (nullif(trim(p_region), '') is null or p.region = trim(p_region))
    and (nullif(trim(p_division), '') is null or p.division = trim(p_division))
    and (
      p_onboarding_status = 'all'
      or (p_onboarding_status = 'completed' and p.onboarding_completed = true)
      or (p_onboarding_status = 'pending' and p.onboarding_completed = false)
    )
  ),
  sorted_teachers as (
    select *
    from teacher_metrics
    order by
      case when p_sort_by = 'fullName' and p_sort_direction = 'asc' then "fullName" end asc,
      case when p_sort_by = 'fullName' and p_sort_direction = 'desc' then "fullName" end desc,
      case when p_sort_by = 'documentsCount' and p_sort_direction = 'asc' then "totalDocumentsCount" end asc,
      case when p_sort_by = 'documentsCount' and p_sort_direction = 'desc' then "totalDocumentsCount" end desc,
      case when p_sort_by = 'lastActiveAt' and p_sort_direction = 'asc' then "lastActiveAt" end asc,
      case when p_sort_by = 'lastActiveAt' and p_sort_direction = 'desc' then "lastActiveAt" end desc,
      case when p_sort_by = 'createdAt' and p_sort_direction = 'asc' then "createdAt" end asc,
      case when p_sort_by = 'createdAt' and p_sort_direction = 'desc' then "createdAt" end desc,
      "createdAt" desc
    limit greatest(coalesce(p_page_size, 15), 1)
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_teachers from sorted_teachers t;

  return jsonb_build_object(
    'teachers', v_teachers,
    'totalCount', v_total_count
  );
end;
$$;

grant execute on function public.get_admin_teacher_directory(
  text, text, text, text, text, text, integer, integer
) to authenticated;

create or replace function public.get_admin_teacher_details(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_assignments jsonb;
  v_recent_docs jsonb;
  v_recent_activity jsonb;
  v_assignments_count integer := 0;
  v_lp_count integer := 0;
  v_assessments_count integer := 0;
  v_tos_count integer := 0;
  v_results_count integer := 0;
  v_remediations_count integer := 0;
  v_total_docs integer := 0;
  v_has_ai boolean := false;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    return null;
  end if;

  select count(*)::integer into v_assignments_count from public.teacher_assignments where user_id = p_user_id and is_active = true;
  select count(*)::integer into v_lp_count from public.documents where user_id = p_user_id and document_type = 'lesson_plan' and status <> 'archived';
  select count(*)::integer into v_assessments_count from public.documents where user_id = p_user_id and document_type = 'assessment' and status <> 'archived';
  select count(*)::integer into v_tos_count from public.documents where user_id = p_user_id and document_type = 'tos' and status <> 'archived';
  select count(*)::integer into v_results_count from public.result_sessions where user_id = p_user_id and status <> 'archived';
  select count(*)::integer into v_remediations_count from public.remediation_plans where user_id = p_user_id and review_state <> 'archived';
  select count(*)::integer into v_total_docs from public.documents where user_id = p_user_id and status <> 'archived';
  select exists (select 1 from public.teacher_ai_credentials where user_id = p_user_id) into v_has_ai;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ta.id,
        'userId', ta.user_id,
        'schoolYear', ta.school_year,
        'gradeLevel', ta.grade_level,
        'learningArea', ta.learning_area,
        'sections', ta.section_names,
        'isActive', ta.is_active,
        'curriculumSourceKind', 'official',
        'curriculumVersionId', null
      ) order by ta.grade_level asc, ta.learning_area asc
    ),
    '[]'::jsonb
  ) into v_assignments
  from public.teacher_assignments ta
  where ta.user_id = p_user_id and ta.is_active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'documentType', d.document_type,
        'schoolYear', d.school_year,
        'academicPeriodLabel', d.academic_period_label,
        'status', d.status,
        'createdAt', d.created_at,
        'updatedAt', d.updated_at
      ) order by d.updated_at desc
    ),
    '[]'::jsonb
  ) into v_recent_docs
  from (
    select id, title, document_type, school_year, academic_period_label, status, created_at, updated_at
    from public.documents
    where user_id = p_user_id and status <> 'archived'
    order by updated_at desc
    limit 10
  ) d;

  with user_events as (
    select
      'onboarding' as event_type,
      'Profile setup completed' as title,
      v_profile.updated_at as event_time
    where v_profile.onboarding_completed = true
    union all
    select
      'document_update' as event_type,
      'Updated ' || d.title as title,
      d.updated_at as event_time
    from public.documents d
    where d.user_id = p_user_id and d.status <> 'archived'
    union all
    select
      'results_encoded' as event_type,
      'Encoded results for ' || rs.title as title,
      rs.updated_at as event_time
    from public.result_sessions rs
    where rs.user_id = p_user_id and rs.status <> 'archived'
    order by event_time desc
    limit 10
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', event_type,
        'title', title,
        'timestamp', event_time
      )
    ),
    '[]'::jsonb
  ) into v_recent_activity
  from user_events;

  return jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'fullName', v_profile.full_name,
    'schoolName', v_profile.school_name,
    'schoolId', v_profile.school_id,
    'region', v_profile.region,
    'division', v_profile.division,
    'district', v_profile.district,
    'districtVerified', v_profile.district_verified,
    'positionTitle', v_profile.position_title,
    'schoolYear', v_profile.school_year,
    'onboardingCompleted', v_profile.onboarding_completed,
    'createdAt', v_profile.created_at,
    'lastActiveAt', v_profile.updated_at,
    'assignmentsCount', v_assignments_count,
    'lessonPlansCount', v_lp_count,
    'assessmentsCount', v_assessments_count,
    'tosCount', v_tos_count,
    'resultSessionsCount', v_results_count,
    'remediationPlansCount', v_remediations_count,
    'totalDocumentsCount', v_total_docs,
    'hasAiConfigured', v_has_ai,
    'assignments', v_assignments,
    'recentDocuments', v_recent_docs,
    'recentActivity', v_recent_activity
  );
end;
$$;

grant execute on function public.get_admin_teacher_details(uuid) to authenticated;

create or replace function public.get_admin_recent_activity()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recent_events as (
    -- New user registrations
    select
      'usr-' || p.id::text || '-reg' as id,
      'user_registered' as event_type,
      p.id as user_id,
      p.email as user_email,
      p.full_name as user_name,
      coalesce(nullif(trim(p.school_name), ''), 'School unassigned') as school_name,
      coalesce(nullif(trim(p.region), ''), 'Unspecified') as region,
      'New teacher account registered' as title,
      p.created_at as event_time
    from public.profiles p
    where p.created_at >= (timezone('utc', now()) - interval '30 days')

    union all

    -- Onboarding completed
    select
      'usr-' || p.id::text || '-onb' as id,
      'onboarding_completed' as event_type,
      p.id as user_id,
      p.email as user_email,
      p.full_name as user_name,
      coalesce(nullif(trim(p.school_name), ''), 'School unassigned') as school_name,
      coalesce(nullif(trim(p.region), ''), 'Unspecified') as region,
      'Completed onboarding & setup profile' as title,
      p.updated_at as event_time
    from public.profiles p
    where p.onboarding_completed = true
      and p.updated_at >= (timezone('utc', now()) - interval '30 days')

    union all

    -- Lesson plans created
    select
      'doc-' || d.id::text as id,
      'lesson_plan_created' as event_type,
      d.user_id,
      p.email as user_email,
      p.full_name as user_name,
      coalesce(nullif(trim(p.school_name), ''), 'School unassigned') as school_name,
      coalesce(nullif(trim(p.region), ''), 'Unspecified') as region,
      'Created Lesson Plan: ' || d.title as title,
      d.created_at as event_time
    from public.documents d
    join public.profiles p on p.id = d.user_id
    where d.document_type = 'lesson_plan'
      and d.status <> 'archived'
      and d.created_at >= (timezone('utc', now()) - interval '30 days')

    union all

    -- Assessments created
    select
      'doc-' || d.id::text as id,
      'assessment_created' as event_type,
      d.user_id,
      p.email as user_email,
      p.full_name as user_name,
      coalesce(nullif(trim(p.school_name), ''), 'School unassigned') as school_name,
      coalesce(nullif(trim(p.region), ''), 'Unspecified') as region,
      'Created Assessment: ' || d.title as title,
      d.created_at as event_time
    from public.documents d
    join public.profiles p on p.id = d.user_id
    where d.document_type = 'assessment'
      and d.status <> 'archived'
      and d.created_at >= (timezone('utc', now()) - interval '30 days')

    union all

    -- Results encoded
    select
      'res-' || rs.id::text as id,
      'results_encoded' as event_type,
      rs.user_id,
      p.email as user_email,
      p.full_name as user_name,
      coalesce(nullif(trim(p.school_name), ''), 'School unassigned') as school_name,
      coalesce(nullif(trim(p.region), ''), 'Unspecified') as region,
      'Encoded results for: ' || rs.title as title,
      rs.created_at as event_time
    from public.result_sessions rs
    join public.profiles p on p.id = rs.user_id
    where rs.status <> 'archived'
      and rs.created_at >= (timezone('utc', now()) - interval '30 days')

    union all

    -- Remediation plans created
    select
      'rem-' || rp.id::text as id,
      'remediation_created' as event_type,
      rp.user_id,
      p.email as user_email,
      p.full_name as user_name,
      coalesce(nullif(trim(p.school_name), ''), 'School unassigned') as school_name,
      coalesce(nullif(trim(p.region), ''), 'Unspecified') as region,
      'Formulated targeted remediation plan' as title,
      rp.created_at as event_time
    from public.remediation_plans rp
    join public.profiles p on p.id = rp.user_id
    where rp.review_state <> 'archived'
      and rp.created_at >= (timezone('utc', now()) - interval '30 days')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'type', event_type,
        'userId', user_id,
        'userEmail', user_email,
        'userName', coalesce(nullif(trim(user_name), ''), 'Teacher'),
        'schoolName', school_name,
        'region', region,
        'title', title,
        'timestamp', to_char(event_time, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ) order by event_time desc
    ),
    '[]'::jsonb
  )
  from (
    select * from recent_events order by event_time desc limit 25
  ) top_events;
$$;

grant execute on function public.get_admin_recent_activity() to authenticated;
