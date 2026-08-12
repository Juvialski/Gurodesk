-- Repair the Phase 1 academic-period uniqueness rule before the official
-- curriculum seed. PostgreSQL shortens auto-generated object names while
-- preserving the `_key` suffix, so the earlier Phase 2 DROP CONSTRAINT used a
-- different truncated identifier and silently did nothing because of IF EXISTS.
--
-- This migration is intentionally ordered after 202608120029 and before
-- 202608120030_seed_official_curriculum.sql.

alter table public.academic_periods
  drop constraint if exists academic_periods_curriculum_version_id_label_grade_min_grad_key;

-- Keep this fallback for databases where the legacy object was created with an
-- explicit (rather than PostgreSQL-generated) long name.
alter table public.academic_periods
  drop constraint if exists academic_periods_curriculum_version_id_label_grade_min_grade_max_key;

-- The official seed upserts subject-scoped periods using this partial unique
-- index as its ON CONFLICT target. Phase 2 normally creates it already; this is
-- idempotent protection for drifted databases.
create unique index if not exists uq_academic_periods_subject_label
  on public.academic_periods(subject_id, label)
  where subject_id is not null;
