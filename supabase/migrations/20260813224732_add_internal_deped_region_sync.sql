-- GuroDesk Supabase migration-lineage compatibility marker.
--
-- Production already recorded migration version 20260813224732 (add_internal_deped_region_sync).
-- That historical production migration was part of a one-off online DepEd/NID
-- school-directory synchronization sequence. Replaying its external HTTP side
-- effects on fresh/local/CI databases would make migrations network-dependent
-- and nondeterministic.
--
-- This file intentionally preserves the exact remote migration VERSION locally
-- without replaying those external side effects.
--
-- Current deterministic schema is provided by:
--   202608130039_philippine_school_identity.sql
--   202608140040_school_district_identity.sql
--
-- Current production school rows are preserved. Do not delete or rewrite
-- supabase_migrations.schema_migrations to resolve this lineage mismatch.

select 1;
