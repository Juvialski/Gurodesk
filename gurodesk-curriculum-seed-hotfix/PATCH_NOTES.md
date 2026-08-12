# GuroDesk curriculum seed hotfix

Target: current `main` at commit `2470485bec2d2e1caf1d4d5cb892448fa2c3777a`.

## Root cause

Phase 1 created an unnamed UNIQUE constraint on:

`(curriculum_version_id, label, grade_min, grade_max)`

PostgreSQL generates the constraint name while preserving the `_key` suffix and
truncating the table/column-name portion to fit the 63-byte identifier limit.
The actual generated name is:

`academic_periods_curriculum_version_id_label_grade_min_grad_key`

Phase 2 tried to drop:

`academic_periods_curriculum_version_id_label_grade_min_grade_max_key`

That SQL identifier itself truncates differently, so `DROP CONSTRAINT IF EXISTS`
was a no-op. The stale table-wide unique constraint therefore remained beside
the newer subject-scoped partial unique index. The official curriculum seed then
failed when different subjects legitimately inserted the same quarter/grade tuple.

## Files to apply

1. Add `supabase/migrations/2026081200295_fix_academic_period_seed_uniqueness.sql`.
   The numeric version is deliberately sorted after `202608120029` and before
   `202608120030` by the Supabase CLI's string-based migration ordering.
2. Apply `patches/test-db-migrations.patch` to `scripts/test-db-migrations.sh`.
   Current main already has 30 migrations; adding this repair makes 31. The
   harness still expected 29, so it would fail after Supabase startup was fixed.

After both changes are pushed to `main`, the hosted Supabase integration should
apply the repair first and then retry `202608120030_seed_official_curriculum.sql`.
