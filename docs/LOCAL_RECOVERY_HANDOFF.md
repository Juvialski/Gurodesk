# GuroDesk local recovery handoff — 2026-10-09

## Local project and preserved work

Repository: `%USERPROFILE%\Documents\Gurodesk`. This repository already existed and was already registered in Codex under “Gurodesk”; it was reused rather than cloned or replaced. The request to open its README in Codex returned `queued`, which does not prove a visible tab was activated. Open this existing local project to continue work.

Fetched `origin/main` and independently checked the remote main ref: `ef43eb2cdc054a0290a28afa8f9808146f161be3`. The existing local HEAD matches it. During the original local-only implementation, no branches, commits, pushes, PRs, merges, deployments, credential rotations, or production database writes were performed. The user subsequently authorized a remote review PR; that PR is prepared separately from the original dirty checkout. Production deployment/credential/data changes remain unauthorized.

Pre-existing uncommitted feature-tour changes were preserved. Their initial status, binary patch, and copies of initially untracked files were saved in `%USERPROFILE%\Documents\Codex\2026-10-09\gurodesk-local-project-setup-full-application`. Those unrelated files remain in the repository. `src/styles.css` contains their existing styles plus this task's additions.

## Environment and architecture

- Windows PowerShell, Node `24.19.0`, npm `11.17.0`; dependencies installed from the existing npm lockfile with `npm ci`. CI specifies Node 22. Vite's supported engine range includes the installed Node 24, but the Node 22 CI host was not separately executed here.
- React 19 + TypeScript + Vite SPA; lazy route pages inside AppShell, AppContext for authenticated/demo workspaces, repository modules for Supabase persistence, and teacher-owned metadata/storage with RLS.
- Sixty-five repository migrations after these two additions. Eleven configured Edge Functions share generation/model/credential contracts. Sponsored admission is centralized at the provider request boundary, leaving question/scoring schemas and curriculum artifacts intact.
- Vitest unit/diagnostic/integration harnesses, local-only Supabase migration scripts, authenticated Playwright fixtures, and the new isolated demo/mobile suite. No separate lint script or ESLint configuration exists; source validators and semantic/type checks ran instead.
- Docker CLI exists, but the Docker Desktop Linux engine pipe was unavailable. `psql` and a standalone Deno executable were not on PATH. No heavyweight service was started.
- Browser-safe production Supabase defaults already exist in `src/lib/supabase.ts`. No environment values were invented and no production credentials were changed. Agent browser tests blocked all remote requests and used only synthetic local demo records. No Chrome profiles, saved sessions, or visible browser windows were used.

To preview locally:

```powershell
Set-Location (Join-Path $env:USERPROFILE 'Documents\Gurodesk')
npm.cmd ci --no-audit --no-fund
npm.cmd run dev -- --host 127.0.0.1
```

Choose **Open sample teacher workspace** for isolated manual exploration. Do not use real production records as test fixtures. For authenticated database tests, start an isolated Supabase stack only when ready, obtain its actual disposable environment values using the CLI, and follow `docs/TESTING.md`; fresh/upgrade scripts also require Bash and a PostgreSQL client. No local `.env` with guessed credentials was created.

## Implemented

- Real optional-key onboarding; removed hidden assertion targets and the mandatory workspace key modal. Corrected the authenticated E2E fixture's stale “Continue” selector. Demo onboarding and reload were exercised headlessly.
- Shared atomic sponsored admission, Manila-day allowance, audited provider dispatch/outcomes, replay protection, pre-dispatch cancellation/expiry, global/rate/provider quota controls, BYOK priority, and an informational usage UI. See `SPONSORED_GEMINI.md` for accounting ambiguity and deployment order.
- Authenticated/metered handwriting access now uses the correct encrypted teacher credential table and backend client. Configured the two missing functions, strengthened actual token validation in the health function, and enforced teacher consent before subjective grading. Existing scoring remains authoritative.
- Resumable official-page school caching, retained evidence timestamps, incomplete-division rejection, snapshot reuse, pre-write reconciliation, preservation of District/existing facts, read-only coverage auditing, and stale-pagination protection. No national crawl/import was performed.
- Word run/placeholder fidelity repairs and reusable Word/Excel merge generation, private master/mapping save/load, output preview, editable downloads, bounded archive validation, student-field restrictions, and a functional Documents entry point. Workbook row capacity and PDF limitations are explicit.
- Removed misleading offline “saved/synced” assurances. Kept the existing feature tours and other teacher capabilities.
- Updated affected dependency patches and enhanced Edge semantic source checking. Actual Deno runtime execution is still a separate blocked gate.

## Validation evidence

Baseline: `npm run test:ci` passed before implementation: 84 unit files / 618 tests, all 42 retained validators, application/test/E2E type checks, Edge parser/declaration checks, and the production build.

Post-change: the first full run found three regressions in legacy provider-envelope and onboarding-style assertions. These were repaired; a subsequent Strict-OOXML guard was also made compatible with the retained validator’s error contract. The final packaged-tree `npm run test:ci` passed: **88 unit files / 646 tests**, 42 retained validators, application/test/E2E types, eleven-function semantic source checks, and the production build. Seven isolated headless demo tests passed, covering 360/390/412/768/1280 widths across nine workspace routes, optional onboarding/reload, and Word upload → repeat → preview → editable download. The Word workflow was also rerun after the final archive guard and passed.

Final dependency patches: `fflate 0.8.3`, `DOMPurify 3.4.16`, `@xmldom/xmldom 0.8.15`, `Vitest 4.1.11`, and `source-map-js 1.2.2`; a clean lockfile reinstall succeeded. Both full and production-only npm audits reported **zero vulnerabilities**. The build retains non-blocking >500 kB chunk warnings. A whole-tree whitespace check found one pre-existing blank-line-at-EOF warning in `src/components/PageHeader.tsx`; that unrelated work was preserved. Logs remain in the original Codex task folder; this document must not be interpreted as a database/provider acceptance certificate.

Blocked/not run: fresh and data-bearing upgrade database execution, SQL/RLS/quota concurrency assertions, Supabase integration tests, Edge Runtime boots/preflight tests, and authenticated Supabase E2E workflows. Docker was stopped and database-test prerequisites were unavailable. No live Gemini provider calls were made. No actual teacher master documents, Microsoft Office/LibreOffice render certification, physical camera/printed-sheet OMR alignment, or hosted data round-trips were performed.

The old GitHub run `32317823060` still reports failure on this main SHA. Read-only log inspection confirmed authentication setup timed out waiting for a visible “Optional AI setup” heading. Local fixes have not been published, so GitHub CI has not rerun them.

## Supabase evidence and deployment gates

Management status returned `ACTIVE_HEALTHY`; SQL returned `FATAL 28P01: password authentication failed for user "postgres"`. Public Auth health and REST endpoints returned 200. This suggests a SQL connector/connection credential problem rather than proving a total application database outage, but the precise cause remains unconfirmed.

Anonymous school REST reads are restricted by authenticated-only RLS, so their empty result was not treated as the production population count. Production migration history, school completeness, real teacher persistence, and quota enforcement remain unverified. Nine deployed functions were listed; handwriting/performance functions were absent. No restore, reset, password rotation, or production migration was attempted.

Pending additions:

- `supabase/migrations/20261009063731_sponsored_gemini_allowance.sql`
- `supabase/migrations/20261009065739_reusable_mail_merge_templates.sql`
- All eleven function deployments after migration reconciliation; the two missing functions are now in configuration.
- Sponsored secret `GURODESK_SPONSORED_GEMINI_KEY`, configured privately in Supabase; preserve existing BYOK encryption secrets/material.

## Outstanding scope

This implementation is **not completion of the entire requested full-application project**. Required database/hosted/provider/device acceptance is blocked. School population must be verified through an authorized connection, then reconciled/imported from the official source if incomplete. The universal merge route still needs automatic bindings to all saved assessment/result/lesson models and general no-placeholder structural mapping outside the existing lesson/TOS flows. Nested repeats, expanding workbook rows with complete formula/range rewriting, native workbook layout preview, and hosted vector PDF conversion remain unimplemented. Populated authenticated lesson/TOS/assessment/results workflows and actual scan reliability still require the local stack and real-device/teacher-document review.

## Replacement ZIP

The ZIP contains actual new/changed task files at repository-root-relative paths, an integrity manifest, and handoff instructions. It excludes `.git`, dependencies, `.env` files, test logs/screenshots, API keys, secrets, generated curriculum bundles, and unrelated feature-tour files. The unchanged `src/lib/supabase.ts` is deliberately omitted because it contains the existing public browser configuration; preserve the destination’s authorized configuration. Browser request identity/usage notifications are installed separately from `src/main.tsx` through `src/lib/aiFetch.ts`. `src/styles.css` preserves existing tour styles because it is supplied as a complete replacement. Deleted `src/components/AiKeyPromptModal.tsx` is listed as a deletion instruction. Destination AI Studio does not need Git history. Review replacements against any newer destination work before applying them. Publish manually only after the remaining validation/deployment gates are satisfied.

## Subsequent authorized remote review

The recovery PR is isolated on `codex/gurodesk-recovery` from current main. It excludes all pre-existing feature-tour source/tests and their CSS. The original local checkout and ZIP retain those styles. PR-tree validation results are recorded in the PR description; the 646-test count above describes the original local tree including its pre-existing tour work. Nothing is merged or deployed by this review publication.

The isolated PR tree passed 638 tests in 87 unit files, all 42 validators, application/test/E2E and Edge source types, the production build, seven headless demo/mobile tests, and a zero-vulnerability npm audit. The eight-test difference comes from the pre-existing tour test file intentionally excluded from this PR. Database/runtime/hosted gates remain blocked locally.
