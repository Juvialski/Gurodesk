# GuroDesk automated testing

Phase 5.5 adds behavior-first regression testing around the defects that escaped the earlier source validators. The suite never connects to the production Supabase project and never sends a Gemini request.

## Test layers

| Layer | Command | Main regressions caught |
|---|---|---|
| Existing deterministic validators | `npm run validate:all` | Curriculum, document, assessment, scoring, export, privacy, and source contracts from Phases 1–5.4 |
| Unit regression tests | `npm run test:unit` | Error extraction, partial-credit totals, item locks/replacement, AI risk routing, targeted repair, malformed JSON, retry ceilings, 429 pacing, and Lite fallback rules |
| Fresh database | `npm run test:db:fresh` | Real application of migrations 001–021, SQL/function/trigger/policy dependencies, and required final schema |
| Upgrade database | `npm run test:db:upgrade` | Real 001–014 schema plus existing teacher/TOS/assessment data upgraded through 015–021, including the migration 018 trigger/backfill and migration 020 existing-save regressions |
| Supabase integration | `npm run test:integration` | Real Auth JWTs, RLS, RPCs, PostgREST relationships, repository reloads, 40-item assessment round trip, result partial credit, analysis, and remediation persistence |
| Browser E2E | `npm run test:e2e` | Login/dashboard, finalized-TOS assessment creation, editor save/reload/list/reopen, and representative deep-route refreshes |
| Static CI gate | `npm run test:ci` | Production and test typechecks, all old validators, unit regressions, and a production bundle |
| Full release gate | `npm run test:release` | Starts an isolated local stack and executes every practical layer above, including Chromium |

`npm test` is the fast unit-test alias. Integration, database, and E2E commands intentionally fail when their required local environment is absent; a skipped live gate must not be reported as green.

## Local architecture

Install dependencies with `npm ci`. The full release gate requires Docker, a PostgreSQL `psql` client, and the repository-local Supabase CLI installed by npm. It performs this sequence:

1. Run typechecks, all retained validators, unit regressions, and the bundle build.
2. Start the local Supabase stack only if it is not already running.
3. Read the local API, anon, service-role, and database values from `supabase status -o env`.
4. Refuse any non-local host or any value containing production ref `hmeybakjxtzmiebtxonc`.
5. Apply all migrations to a fresh database and run schema behavior assertions.
6. Reset to migration 014, insert the upgrade fixture, apply 015–021, and run data/trigger/RPC assertions.
7. Reset the ordinary project to the final all-migrations state.
8. Run Supabase integration tests with real local Auth sessions for Teacher A and Teacher B.
9. Prepare a disposable local E2E teacher and run Playwright Chromium.
10. Stop only a stack that the release command started itself.

The individual DB harness also accepts an explicitly local disposable PostgreSQL URL. It never permits a remote database URL and requires an explicit reset flag for direct-`psql` mode.

## Deterministic fixtures

Fixtures use the checked-in Grade 7 Mathematics curriculum seed and reproducible shapes for:

- two authenticated teachers with separate JWT sessions;
- teacher-owned assignments and sections;
- finalized TOS documents, including a 40-item allocation;
- new and existing assessment RPC saves, mixed structured item types, stable item IDs, locks, and multi-point fields;
- learners and result sessions with the required objective `1/1`, manual multi-point `3/5`, and essay `8/10` outcomes (`12/16` total), plus unit coverage for component partial credit;
- competency/cognitive analysis and point-weighted remediation; and
- a local-only E2E teacher that completes onboarding through the real UI.

Service-role access is limited to fixture setup, verification, and cleanup. RLS assertions themselves use the teachers' anon-key JWT clients.

## Production safety

The database script, integration harness, E2E configuration, E2E user provisioner, and full release runner each independently reject the production project reference. Networked tests accept only `http://localhost`, `http://127.0.0.1`, or loopback IPv6. E2E aborts any `*.supabase.co` or Gemini provider request before it leaves the browser.

Do not put production URLs, database credentials, service-role keys, or teacher Gemini keys in CI. GitHub Actions obtains disposable local keys from the Supabase CLI after startup.

## Gemini mocking

Unit tests exercise the provider boundary with deterministic function mocks and a stubbed `fetch`. They verify low-risk generation-only flow, high-risk verification, a single targeted repair, malformed JSON rejection, retry limits, 429 handling, scheduler pacing, and Lite-only fallback. Playwright mocks only the local AI-settings status call and aborts every generation/function/provider request. No automated test consumes a teacher's Gemini quota.

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual dispatch:

- **Static checks** installs with npm cache and runs `npm run test:ci`.
- **Local Supabase integration and E2E** starts one stack, runs both migration paths, restores the final schema, runs integration tests, installs Chromium, and runs E2E.

Job names identify whether a failure is static/unit/build or local DB/RLS/E2E. Playwright artifacts are retained on failure, and Supabase is stopped in an always-run cleanup step.

## Adding a regression

Add the smallest behavior test at the lowest layer that can reproduce the defect:

- pure deterministic bug: `tests/unit/`;
- migration or trigger bug: `tests/db/` SQL assertion plus `scripts/test-db-migrations.sh`;
- Auth/RLS/RPC/PostgREST/repository bug: `tests/integration/` using a real teacher JWT;
- route or critical UI round trip: `tests/e2e/` using accessible locators.

Keep fixtures deterministic, assert the externally visible behavior, and add a root-cause fix alongside the test. Do not replace behavior coverage with migration/query string matching when the local stack can execute it.
