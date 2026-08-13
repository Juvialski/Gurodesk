# GuroDesk — Philippine School Directory + School-Aware Identity

Target base: `Juvialski/Gurodesk` main `955b8651ec1f7981b5aeb4fed1a4ca58a30c2164`

## Implemented scope

### Package A — Philippine school identity foundation
- Canonical `philippine_schools` Supabase table keyed by DepEd School ID.
- Official/custom school distinction without deleting legacy `school_name`, `region`, or `division` fields.
- Profile fields for `school_directory_id`, `school_id`, `school_source`, and `school_is_custom`.
- Database guard trigger canonicalizes an official selection from the directory record, preventing client-side name/region/division drift.
- Authenticated read-only school directory access with server-side search/list RPCs.
- Mobile `SchoolPicker` with:
  - search by school name or School ID;
  - Region and Schools Division filters;
  - selected-school confirmation;
  - manual/custom-school fallback;
  - demo-mode reference records;
  - directory error fallback.
- Onboarding and Settings are patched to use the same picker.
- Existing free-text school profiles continue to load as custom/legacy identities.

### Package B — school-aware historical records
- New `school_identity_snapshot` JSONB column on:
  - `documents` (lesson plans and TOS shell records),
  - `assessment_documents`,
  - `result_sessions`.
- Insert triggers capture school identity from the authenticated teacher profile.
- Update protection preserves the original snapshot instead of silently changing historical school identity.
- Existing records are intentionally not backfilled with current profile data because that could fabricate historical identity.
- Existing exports that already consume `profile.schoolName`, `profile.region`, and `profile.division` automatically receive canonical directory values after official school selection.

## Official data pipeline

`scripts/schools/import-deped-nid.mjs` reads the public DepEd National Inventory Dashboard hierarchy, validates uniqueness/completeness, writes a generated JSON checkpoint, and can upsert it to Supabase with `--sync`.

Safety rules in the importer:
- refuses a national import below 40,000 records;
- compares collected schools to the dashboard-reported national total and requires at least 95%;
- rejects duplicate/conflicting School IDs;
- crawls conservatively with bounded concurrency and a courtesy delay;
- never deactivates missing rows automatically from a partial crawl;
- requires the Supabase service-role key only in a backend/admin environment, never in the browser.

`data/schools/philippine-schools.sample.json` is intentionally a tiny validation/demo sample. It is not a production school masterlist.

## Files added

- `src/types/school.ts`
- `src/lib/schoolDirectory.ts`
- `src/lib/schoolDirectoryRepository.ts`
- `src/components/SchoolPicker.tsx`
- `src/school-directory.css`
- `supabase/migrations/202608130039_philippine_school_identity.sql`
- `scripts/schools/import-deped-nid.mjs`
- `scripts/schools/validate-school-directory.mjs`
- `scripts/check-school-directory-contract.mjs`
- `scripts/apply-school-directory-overlay.mjs`
- `tests/unit/schoolDirectory.test.ts`
- `data/schools/philippine-schools.sample.json`

## Existing files patched by the overlay script

- `src/types/app.ts`
- `src/lib/repository.ts`
- `src/pages/OnboardingPage.tsx`
- `src/pages/SettingsPage.tsx`
- `package.json`

The overlay is idempotent and refuses ambiguous source matches instead of guessing against a newer/conflicting codebase.

## Deliberately untouched

Assessment generation, Gemini contracts, TikZ generation/rendering/export logic, result scoring, item analysis, and remediation logic are not modified by this package.

## Deferred follow-up packages

- complete offline directory/cache and offline document sync;
- Curriculum Explorer action shortcuts;
- Practice/Mastery assessment modes and answer-specific feedback;
- ALS content/program modeling;
- school administrator/aggregate analytics and organization permissions.
