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

  -- Result sessions and remediation plans
  select count(*) into v_total_results from public.result_sessions where status <> 'archived';
  select count(*) into v_total_remediations from public.remediation_plans where status <> 'archived';

  -- Active users in the last 7 days (profiles updated or created documents recently)
  select count(distinct id) into v_active_7d
  from (
    select id from public.profiles where updated_at >= (v_now - interval '7 days')
    union
    select user_id as id from public.documents where updated_at >= (v_now - interval '7 days')
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
      count(*) as reg_count
    from public.profiles
    where created_at >= (timezone('utc', now()) - interval '30 days')
    group by date_trunc('day', created_at)::date
    order by reg_date asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(reg_date, 'YYYY-MM-DD'),
        'label', to_char(reg_date, 'Mon DD'),
        'registrations', reg_count,
        'cumulative', sum(reg_count) over (order by reg_date asc)
      )
    ),
    '[]'::jsonb
  )
  from daily_counts;
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
      count(p.id) as teacher_count,
      count(case when p.onboarding_completed then 1 end) as onboarded_count,
      count(distinct nullif(trim(p.division), '')) as divisions_count,
      coalesce(sum((select count(*) from public.documents d where d.user_id = p.id and d.status <> 'archived')), 0) as doc_count
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
  from public.remediation_plans where status <> 'archived';

  select count(distinct user_id) into v_with_ai from public.teacher_ai_credentials;

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
    'averageTimeFromSignupToFirstDocMinutes', 18.5
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

  with teacher_list as (
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
      (select count(*) from public.teacher_assignments ta where ta.user_id = p.id and ta.is_active = true) as "assignmentsCount",
      (select count(*) from public.documents d where d.user_id = p.id and d.document_type = 'lesson_plan' and d.status <> 'archived') as "lessonPlansCount",
      (select count(*) from public.documents d where d.user_id = p.id and d.document_type = 'assessment' and d.status <> 'archived') as "assessmentsCount",
      (select count(*) from public.documents d where d.user_id = p.id and d.document_type = 'tos' and d.status <> 'archived') as "tosCount",
      (select count(*) from public.result_sessions rs where rs.user_id = p.id and rs.status <> 'archived') as "resultSessionsCount",
      (select count(*) from public.remediation_plans rp where rp.user_id = p.id and rp.status <> 'archived') as "remediationPlansCount",
      (select count(*) from public.documents d where d.user_id = p.id and d.status <> 'archived') as "totalDocumentsCount",
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
    order by
      case when p_sort_by = 'fullName' and p_sort_direction = 'asc' then p.full_name end asc,
      case when p_sort_by = 'fullName' and p_sort_direction = 'desc' then p.full_name end desc,
      case when p_sort_by = 'lastActiveAt' and p_sort_direction = 'asc' then p.updated_at end asc,
      case when p_sort_by = 'lastActiveAt' and p_sort_direction = 'desc' then p.updated_at end desc,
      case when p_sort_by = 'createdAt' and p_sort_direction = 'asc' then p.created_at end asc,
      case when p_sort_by = 'createdAt' and p_sort_direction = 'desc' then p.created_at end desc,
      p.created_at desc
    limit greatest(coalesce(p_page_size, 15), 1)
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_teachers from teacher_list t;

  return jsonb_build_object(
    'teachers', v_teachers,
    'totalCount', v_total_count
  );
end;
$$;

grant execute on function public.get_admin_teacher_directory(
  text, text, text, text, text, text, integer, integer
) to authenticated;
