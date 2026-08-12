# GuroDesk curriculum seed repair

Apply this ZIP directly into the existing repository root. The ZIP now uses the
same root paths as the current repo (`supabase/` and `scripts/`) and contains no
`patches/` wrapper/folder.

Make these repository edits as part of the same change:

1. Delete `supabase/migrations/2026081200295_fix_academic_period_seed_uniqueness.sql`.
   - Its version/filename ordering is unsafe after migration `202608120029` has
     already reached the hosted database.
   - The academic-period uniqueness repair is now executed at the beginning of
     `supabase/migrations/202608120030_seed_official_curriculum.sql`.

2. In the existing `scripts/test-db-migrations.sh`, change:

   `readonly EXPECTED_MIGRATION_COUNT=31`

   to:

   `readonly EXPECTED_MIGRATION_COUNT=30`

Files in this ZIP that should replace/merge at repository root:

- `supabase/migrations/202608120030_seed_official_curriculum.sql`
  - clean regenerated 196-manifest / 6,181-competency seed
  - fixes the malformed `JOIN ... ON cv.id` failure by restoring a boolean join condition
  - performs the academic-period legacy-constraint repair before curriculum rows are inserted
- `supabase/seeds/official-curriculum-complete.sql`
  - clean deterministic source bundle matching the verified manifests
- `scripts/generate-official-curriculum-bundle.mjs`
  - adds a generation-time guard against dangling/non-boolean JOIN conditions
- `DELETE_THESE_PATHS.txt`

Do not create a new wrapper directory when importing this ZIP. Do not alter the
curriculum manifest data while applying this repair.
