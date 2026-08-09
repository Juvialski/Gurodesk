-- Phase 5.5 Explicit Data API Table-Level Grants
--
-- This migration ensures explicit table-level SQL GRANT statements exist for all public tables
-- accessed via the Supabase Data API (PostgREST) by `authenticated` and `service_role` clients.
-- Supabase Data API access requires BOTH SQL GRANT privileges AND RLS policy approval.
--
-- Security guarantees:
-- 1. `authenticated`: Granted least-privilege table access for application operations (protected by RLS).
-- 2. `service_role`: Granted full table access for administrative test harness setup and automated tasks.
-- 3. `anon`: Revoked ALL table privileges across all public tables to enforce zero-trust for unauthenticated requests.
-- 4. Server-only credential stores (`teacher_ai_credentials`, `teacher_ai_settings`) remain accessible ONLY to `service_role`.

-- Grant usage on schema public
grant usage on schema public to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. Curricular & Policy Reference Tables (Read-Only for Authenticated)
-- -----------------------------------------------------------------------------
grant select on
  public.source_documents,
  public.curriculum_versions,
  public.academic_periods,
  public.curriculum_subjects,
  public.curriculum_domains,
  public.curriculum_standards,
  public.curriculum_competencies,
  public.policy_documents,
  public.policy_sections,
  public.curriculum_applicability,
  public.school_year_calendars,
  public.grading_periods,
  public.instructional_pacing_plans,
  public.instructional_pacing_entries
to authenticated;

grant select, insert, update, delete on
  public.source_documents,
  public.curriculum_versions,
  public.academic_periods,
  public.curriculum_subjects,
  public.curriculum_domains,
  public.curriculum_standards,
  public.curriculum_competencies,
  public.policy_documents,
  public.policy_sections,
  public.curriculum_applicability,
  public.school_year_calendars,
  public.grading_periods,
  public.instructional_pacing_plans,
  public.instructional_pacing_entries
to service_role;

-- -----------------------------------------------------------------------------
-- 2. Teacher-Owned Browser-Writable Data Tables (Protected by RLS)
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on
  public.profiles,
  public.teacher_assignments,
  public.documents,
  public.document_versions,
  public.lesson_plan_competencies,
  public.teacher_lesson_preferences,
  public.teacher_export_preferences,
  public.document_templates,
  public.tos_competencies
to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.teacher_assignments,
  public.documents,
  public.document_versions,
  public.lesson_plan_competencies,
  public.teacher_lesson_preferences,
  public.teacher_export_preferences,
  public.document_templates,
  public.tos_competencies
to service_role;

-- -----------------------------------------------------------------------------
-- 3. Teacher-Owned Browser-Readable Tables (Mutations via Guarded RPCs or Service Role)
-- -----------------------------------------------------------------------------
grant select, insert on
  public.lesson_plan_ai_events
to authenticated;

grant select on
  public.assessment_documents,
  public.assessment_items,
  public.assessment_ai_audit_events,
  public.class_learners,
  public.result_sessions,
  public.result_session_learners,
  public.result_item_outcomes,
  public.result_score_only_outcomes,
  public.remediation_plans,
  public.remediation_plan_targets,
  public.remediation_plan_participants
to authenticated;

grant select, insert, update, delete on
  public.lesson_plan_ai_events,
  public.assessment_documents,
  public.assessment_items,
  public.assessment_ai_audit_events,
  public.class_learners,
  public.result_sessions,
  public.result_session_learners,
  public.result_item_outcomes,
  public.result_score_only_outcomes,
  public.remediation_plans,
  public.remediation_plan_targets,
  public.remediation_plan_participants
to service_role;

-- -----------------------------------------------------------------------------
-- 4. Server-Only Encrypted Credential & Settings Stores
-- -----------------------------------------------------------------------------
revoke all on
  public.teacher_ai_credentials,
  public.teacher_ai_settings
from public, anon, authenticated;

grant select, insert, update, delete on
  public.teacher_ai_credentials,
  public.teacher_ai_settings
to service_role;

-- -----------------------------------------------------------------------------
-- 5. Revoke ALL table permissions from `anon` (Zero-Trust)
-- -----------------------------------------------------------------------------
revoke all on
  public.profiles,
  public.teacher_assignments,
  public.source_documents,
  public.curriculum_versions,
  public.academic_periods,
  public.curriculum_subjects,
  public.curriculum_domains,
  public.curriculum_standards,
  public.curriculum_competencies,
  public.policy_documents,
  public.policy_sections,
  public.documents,
  public.document_versions,
  public.curriculum_applicability,
  public.school_year_calendars,
  public.grading_periods,
  public.instructional_pacing_plans,
  public.instructional_pacing_entries,
  public.lesson_plan_competencies,
  public.lesson_plan_ai_events,
  public.teacher_ai_credentials,
  public.teacher_ai_settings,
  public.teacher_lesson_preferences,
  public.teacher_export_preferences,
  public.document_templates,
  public.tos_competencies,
  public.assessment_documents,
  public.assessment_items,
  public.assessment_ai_audit_events,
  public.class_learners,
  public.result_sessions,
  public.result_session_learners,
  public.result_item_outcomes,
  public.result_score_only_outcomes,
  public.remediation_plans,
  public.remediation_plan_targets,
  public.remediation_plan_participants
from anon;
