# GuroDesk Visual Reliability Release — Validation Report

Date: 2026-08-12

This report distinguishes code-level checks that actually ran from environment-dependent checks that could not run. The pre-change green baseline described by the incoming release brief is not reported as a post-change pass.

## Passed in this environment

- **TypeScript/TSX parser/transpile gate:** PASS — 209 non-declaration `.ts`/`.tsx` files across `src`, `supabase/functions`, and `tests` parsed/transpiled with the available TypeScript 5.8.3 compiler.
- **Pure changed-module TypeScript check:** PASS — visual planning, TikZ safety, final QA, Edge TikZ safety, assessment contract, visual contract/model schema, and finished-visual verifier compiled with strict/no-emit settings independent of missing React/Vitest packages.
- **Targeted client runtime behavior:** PASS — Balanced budgets 1/2/3/5/10/20/40, English false-positive rejection, text-only “circle” definition, spaced 20-item selection, nested formatted/fraction labels, and client TikZ answer-leak detection. The 20-item selected positions were `3, 6, 9, 12, 17`.
- **Targeted Edge shared runtime behavior:** PASS — brace-aware learner-visible answer leakage is rejected at the Edge contract and a false finished-visual check forces `needs_repair` even if provider status says pass.
- **Migration harness shell syntax:** PASS.
- **Migration inventory:** PASS — exactly 27 SQL migrations are present and the harness now expects 27.
- **Repository hidden-file restoration:** PASS — local Git blob hashes for `.github/workflows/ci.yml` and `.gitignore` match the fetched current GitHub blob SHAs.
- **Packaging secret scan:** no `.env`, `.env.local`, `.env.*.local`, or credential/secret-named files were found in the project tree. Partial `node_modules` is excluded from final packaging.

## Required commands — exact result

| Required check | Result in this environment |
|---|---|
| `npm ci` | **BLOCKED / did not complete.** Bounded install attempts could not finish because external package resolution is unavailable in this sandbox. The partial install was not used as evidence and is excluded from the ZIP. |
| `npm run typecheck` | **NOT COMPLETED AS PROJECT CHECK (exit 2).** TypeScript could not load missing installed type packages such as Node/React because `npm ci` did not complete. |
| `npm run typecheck:tests` | **NOT COMPLETED (exit 2).** Missing `node` and `vitest/globals` type packages. |
| `npm run typecheck:e2e` | **NOT COMPLETED (exit 2).** Missing Node type package. |
| `npm run validate:all` | **BLOCKED (exit 1).** Validator bootstrap could not import the incomplete `node_modules/esbuild/index.js`. |
| `npm run test:unit` | **BLOCKED (exit 127).** `vitest` is not installed. |
| `npm run build:bundle` | **BLOCKED (exit 127).** `vite` is not installed. |
| `npm audit --omit=dev` | **BLOCKED (exit 1).** npm audit endpoint failed with `getaddrinfo EAI_AGAIN registry.npmjs.org`. |
| Real Deno type-checking | **SKIPPED.** `deno` is not installed in this environment. |
| `npm run test:db:fresh` | **SKIPPED by harness (exit 77).** `psql` is not installed. |
| `npm run test:db:upgrade` | **SKIPPED by harness (exit 77).** `psql` is not installed. |
| Two-teacher Supabase integration/RLS | **SKIPPED.** Local Supabase/PostgreSQL test runtime is unavailable and Vitest did not install. |
| `npm run test:integration` | **BLOCKED (exit 127).** `vitest` is not installed. |
| Chromium E2E | **SKIPPED.** System Chromium exists, but the project Playwright package/runner did not install; `npm run test:e2e` cannot execute the project suite. |
| Phone viewport E2E | **SKIPPED** for the same reason. |
| Visual preview screenshot inspection | **SKIPPED.** The Vite application cannot be built/served without completed dependencies. |
| Student/Teacher/Answer Key export inspection | **SKIPPED.** Browser app/build unavailable. |
| PDF/DOCX/browser-print direct TikZ inspection | **SKIPPED.** Browser app/build and local TikZ runtime are unavailable. |

## Additional notes

- `npm run test:e2e` reached a non-project/global `playwright` executable and returned `unknown command 'test'`; this is not evidence about the repository's Playwright tests.
- `npm audit` independently confirms the package-registry DNS/network limitation, so missing dependencies are an environment limitation rather than a source-level validation result.
- Database, hosted Edge, browser, screenshot, and export checks are intentionally **not** reported as passed.

## Promotion gate

Do not promote this checkpoint as a fully validated production visual release until:

1. the local/pinned TikZJax runtime assets are actually vendored and the runtime CDN references removed;
2. `npm ci` succeeds from a clean tree;
3. all three TypeScript checks, all validators, unit tests, bundle build, and production audit pass;
4. Deno type-checking passes for changed Edge files/shared modules;
5. fresh + upgrade migrations and two-teacher RLS/integration pass;
6. Chromium + phone E2E pass; and
7. the required TikZ fixture gallery and Student/Teacher/Answer Key PDF/DOCX/browser-print outputs are visually inspected.
