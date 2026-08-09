# Phase 5.5 testing manifest

## Toolchain and commands

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `tsconfig.tests.json`
- `tsconfig.e2e.json`
- `scripts/run-existing-validators.mjs`
- `scripts/test-release.sh`
- `scripts/prepare-e2e-user.mjs`

## Unit regressions

- `tests/unit/fixtures.ts`
- `tests/unit/error-and-hosting-regressions.test.ts`
- `tests/unit/assessment-ai-regressions.test.ts`
- `tests/unit/assessment-scheduler.test.ts`
- `tests/unit/assessment-lifecycle-and-results.test.ts`
- `tests/unit/gemini-boundary.test.ts`

## Database and Supabase integration

- `scripts/test-db-migrations.sh`
- `tests/db/fixture_upgrade.sql`
- `tests/db/assert_fresh.sql`
- `tests/db/assert_upgrade.sql`
- `tests/integration/fixtures.ts`
- `tests/integration/supabaseTestHarness.ts`
- `tests/integration/supabase.integration.test.ts`

## Browser and CI

- `tests/e2e/fixtures.ts`
- `tests/e2e/auth.setup.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/assessment-flow.spec.ts`
- `tests/e2e/deep-routes.spec.ts`
- `.github/workflows/ci.yml`

## Documentation

- `docs/TESTING.md`
- `docs/PRODUCTION_SMOKE_TEST.md`
- `README.md`
- `CODEX_HANDOVER.md`

No production feature or RLS policy was added or weakened. Applied migrations 001–022 remain unchanged and intact.
