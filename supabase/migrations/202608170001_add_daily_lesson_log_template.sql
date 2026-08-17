-- Add the built-in Daily Lesson Log export without rewriting the original
-- Phase 3.6 migration, so fresh and upgrade paths remain deterministic.
alter table public.teacher_export_preferences
  drop constraint if exists teacher_export_preferences_default_template_id_check;

alter table public.teacher_export_preferences
  add constraint teacher_export_preferences_default_template_id_check
  check (default_template_id in ('gurodesk_ilaw_standard', 'gurodesk_ilaw_multisession'));
