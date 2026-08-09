GuroDesk Phase 5.5 Hotfix 023 v2

ROOT CAUSE FIXED
PostgreSQL SQLSTATE 42P13:
  cannot remove parameter defaults from existing function

Migration 022 already defined defaults on save_assessment_document parameters
6 through 11. Migration 023 must preserve those defaults when using
CREATE OR REPLACE FUNCTION.

THIS ZIP:
- replaces only:
  supabase/migrations/202608090023_phase55_restore_guarded_assessment_rpc.sql
- preserves scripts/test-db-migrations.sh from Hotfix 023
- does not add migration 024
- keeps the migration count at 23

The corrected defaults exactly preserve migration 022's public RPC signature:
- p_academic_period_label default null
- p_instructions default ''
- p_status default 'draft'
- p_structured_content default '{}'::jsonb
- p_items default '[]'::jsonb
- p_change_note default 'Teacher saved assessment draft'

Because migration 023 failed before it could be applied, correcting migration 023
itself is appropriate here. A later migration cannot repair a fresh migration
sequence that stops at 023.
