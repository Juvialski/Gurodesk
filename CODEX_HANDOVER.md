# GuroDesk handover — Assessment Generation V2 checkpoint

## 2026-08-12 — Assessment Generation V2

This checkpoint implements the requested assessment-generation overhaul on top of the visual-reliability checkpoint. It stops at Assessment Generation V2 and does not begin another product phase.

### What changed

- **Configuration-first creation:** `Create Assessment` now collects finalized TOS, total points, allowed question types, visual policy, title/directions, and optional planning guidance before generation. Teachers see live CPD suitability/feasibility and cannot spend a provider request on an impossible type/point combination.
- **Points are the primary teacher-facing size:** V2 derives logical question count. Multi-point questions remain one logical item but print using point ranges such as `16–20`. Internal result/scoring identity stays one question. Legacy assessments retain their original numbering.
- **Deterministic TOS point blueprint:** GuroDesk allocates requested points across the immutable finalized competency/CPD structure. Gemini cannot change curriculum mappings, CPD allocations, total points, or learner numbering.
- **One successful master plan:** the new `assessment-master-planner` Edge Function uses `gemini-3.6-flash`, then `gemini-3.5-flash`, `gemini-3.5-flash-lite`, and `gemini-3.1-flash-lite`, all with high thinking. Fallback is bounded to model availability/quota/transient provider failures. Only one successful validated plan is accepted and then frozen.
- **CPD-aware formats:** all eleven existing question types remain available, but Evaluating/Creating require genuinely strong higher-order formats. Subject-aware preferences keep Problem Solving natural for Mathematics and Essay/Constructed Response natural for language tasks without forcing one format everywhere.
- **Generation follows the frozen plan:** V2 question generation verifies plan entry ID, type, points/range, competency, CPD, TOS source mapping, task intent, and visual requirement before provider generation. Old auto type balancing/visual re-planning is bypassed for V2.
- **Progress-only generation UI:** while generation is active or resumed, the normal question editor/previews are hidden. Review begins only after planned questions and required visuals exist.
- **Point ranges flow through results and exports:** result entry, snapshots, item/option analysis, competency/CPD/curriculum summaries, remediation, assessment exports, PDF/DOCX report data, and XLSX workbook rows use learner-facing range labels.
- **Visual reliability preserved:** V2 master-plan validation retains Mathematics-only automatic required visuals, Off/Balanced/More policy rules, and the Balanced roughly-one-per-four ceiling.

### Migration / persistence

Migration `202608120028_assessment_generation_v2.sql` raises the project to **28 migrations**. It adds `point_start`, `point_end`, and `plan_entry_id` to `assessment_items` and introduces V2-only `save_assessment_document_v2` and `duplicate_assessment_document_v2` RPCs. The V2 save boundary validates the immutable master plan and exact `1…totalPoints` point coverage. Legacy persistence is preserved rather than weakened.

### Deployment order

1. Apply all existing migrations through `027`, then `202608120028_assessment_generation_v2.sql`.
2. Deploy new Edge Function `assessment-master-planner`.
3. Deploy changed `assessment-question-generator` and changed shared Edge modules from this same tree.
4. Deploy the frontend.
5. Run the full clean-install/type/unit/build, Deno, fresh+upgrade DB, two-teacher RLS/integration, Chromium/phone E2E, and assessment/results export inspection matrix before production promotion.

### Validation status

Passed in this sandbox: 214-file TS/TSX parse gate, isolated strict V2 domain/type checks, V2 static release contract, deterministic point/CPD/range behavior checks, visual-policy regression checks, 28-migration inventory, migration harness shell syntax, source relative-import audit, and official curriculum manifest integrity.

Blocked here: clean `npm ci`, repository-wide TypeScript/Vitest/Vite/audit gates, real Deno checks, Supabase/PostgreSQL fresh+upgrade/RLS tests, Chromium/phone E2E, and real rendered PDF/DOCX/print/XLSX inspection. Do not report those as passed. See `ASSESSMENT_GENERATION_V2_VALIDATION_REPORT_20260812.md`.

### Inherited limitation

The previous visual checkpoint still has the unresolved TikZJax runtime-CDN packaging limitation because the licensed/version-pinned runtime binaries/fonts could not be materialized in this sandbox. V2 preserves direct TikZ and its safety/reliability rules but does not claim the offline renderer dependency is resolved.

See `ASSESSMENT_GENERATION_V2_IMPLEMENTATION_MANIFEST_20260812.md` and `ASSESSMENT_GENERATION_V2_VALIDATION_REPORT_20260812.md`.

---

# GuroDesk handover — visual reliability hardening checkpoint

## 2026-08-12 — Visual reliability / TikZ / export / persistence checkpoint

This checkpoint implements the focused visual-reliability brief on top of `gurodesk-required-visual-full-20260811(2).zip` and stops before any new product phase.

Key changes:

- Automatic visual planning is Mathematics-gated, policy-controlled (`Off`, `Balanced`, `More visuals`), conservative about diagram dependence, capped at floor(N/4) in Balanced mode, and spread across the paper/competencies. Manual/existing visuals and explicit learner diagram dependencies are preserved.
- Direct TikZ remains the quality path. The Edge visual operation now runs a post-generation finished-diagram verifier and allows at most one semantic diagram-only correction while preserving the question, answer, TOS mapping, and cognitive mapping.
- TikZ node-label extraction is brace-aware; answer-leak comparison covers nested formatting/fractions and all required concise answer types at both client and Edge boundaries.
- TikZ source validation is bounded/allowlisted and rendered SVG caching uses a DOM element/attribute/style allowlist. Browser print uses sanitized cached SVG instead of the live iframe; DOCX waits for SVG; PDF waits for high-resolution PNG.
- A compact teacher visual-review gallery was added before finalization.
- Migration `202608120027_visual_checkpoint_concurrency_guard.sql` adds a narrow optimistic visual checkpoint RPC so delayed visual saves cannot overwrite newer teacher edits. Migration count is now **27**.
- `.github/workflows/ci.yml` and `.gitignore` were restored from current GitHub and their local Git-blob hashes match the fetched repository versions.

Important release limitation: the uploaded project did not contain the licensed TikZJax runtime binary/font assets and this execution environment could not materialize them from the pinned upstream source. The current iframe therefore still references `tikzjax.com` at runtime. Do **not** call the offline/CDN-removal P0 complete until a licensed commit-pinned local distribution is vendored and the full rendered/export fixture matrix is rerun.

Validation in this sandbox is also limited by package/network tooling: the 209-file TS/TSX syntax gate, pure changed-module typecheck, targeted planner/TikZ/client/Edge behavior checks, migration inventory/harness syntax, and hidden-file hashes passed. Clean npm install, project TypeScript checks, validators, Vitest, Vite build, npm audit, Deno, DB/RLS, Playwright, screenshots, and export inspections are not reported as passed. See `VISUAL_RELIABILITY_VALIDATION_REPORT_20260812.md`.

Deployment order: apply migration 027, deploy `assessment-question-generator` plus changed `_shared` modules from the same tree, then deploy the frontend. Run the complete CI/Supabase/browser/export matrix before production promotion.

See `VISUAL_RELIABILITY_IMPLEMENTATION_MANIFEST_20260812.md` and `VISUAL_RELIABILITY_VALIDATION_REPORT_20260812.md` for exact scope/results.

---

## 2026-08-11 — Complete official curriculum ingestion

Phase B is complete from the green Phase A commit `b2cc5c8cc392c17540de4162aa7fd76483566db7`.

- All 189 current national catalog entries are backed by 196 verified manifests and 6,181 detailed competencies from 129 pinned official DepEd PDFs. Revised K to 10 / MATATAG contributes 80 manifests and 4,277 competencies; Strengthened SHS Grade 11 contributes 94 and 1,552; Grade 12 contributes 22 and 352.
- The seven extra manifests are the intentional split of Grade 4–10 MAPEH into the separately published Music and Arts and Physical Education and Health guides.
- Every source records its official URL/landing page, file ID where applicable, file name, edition, pages, bytes, retrieval date, and SHA-256. Every competency records stable identity, source order, exact source page, verification status, and participates in a manifest payload hash. The 129 source PDFs are verification inputs and are not committed.
- K to 10 quarters/Kindergarten themes, Grade 11 quarters, and Grade 12's explicit one-term scope are preserved as source periods. No grading-calendar or pacing mapping is inferred.
- The Filipino source's published summary disagrees with five grades' detailed row tables. GuroDesk retains the detailed rows and records both totals under `verification.sourceConsistency`; it does not force or invent records.
- `supabase/seeds/official-curriculum-complete.sql` is a generated 196-pack, 6,181-competency idempotent seed in one transaction. It preserves legacy Grade 7 Mathematics identities, uses stable update/insert keys, and removes stale rows only within the imported official pack scope.
- No migration was added; migration count remains 26. Apply migrations 001–026, import the aggregate seed with stop-on-error enabled, rerun it on staging to confirm idempotency, and then deploy the frontend. Phase B changes no Edge Function.
- `npm run test:ci` passed all three TypeScript checks, 35 validator commands, 229 unit tests across 22 files, and the production Vite bundle with 2,048 modules transformed. All 129 local source hashes also passed. Docker and `psql` were unavailable, so database execution, authenticated integration, seed-idempotency, and Chromium E2E checks remain CI/staging-owned.

See `docs/OFFICIAL_CURRICULUM_IMPLEMENTATION_MANIFEST.md` for the source, extraction, integrity, known-source-variance, deployment, and verification record. The complete handoff archive is `gurodesk-assessment-curriculum-complete.zip`.

## 2026-08-11 — Canonical assessment paper and durable visual enrichment

Phase A of the 2026-08-11 continuation handoff is complete from `main` commit `46a912fb0ed0a8571c9820dec596f96ea32697d2`.

- `assessmentExportPresentation.ts` is now the renderer-neutral paper contract used by preview, browser print, PDF, and DOCX. It centrally owns official/school identity, metadata, instructions, section hierarchy, all eleven question-type response policies, annotations, visual sizing, and continuation labels.
- The canonical Test 4 regression fixture contains 20 items, 41 points, all eleven question types, and five visuals. PDF and LibreOffice-rendered DOCX output were visually inspected after fixing point-label overlap, collapsed response lines, matching-block pagination, and Word inter-run spacing.
- Question generation and visual enrichment are separate durable phases. Completed questions are checkpointed before the sequential visual pass. Helpful visual failure preserves the question; missing required visuals block finalization; provider boundaries pause the remaining batch.
- Persisted `_visualPlan` metadata binds visual status to a deterministic question/answer source hash. Save/load, duplication, bounded history, resume recovery, and visual-only regeneration preserve questions and invalidate stale visuals after material edits.
- The authenticated visual Edge operation compares browser prompt/answer data with the authoritative saved item before any provider request. GuroDesk continues to own all executable SVG/TikZ/export markup.
- No migration was added; migration count remains 26. Redeploy the frontend and `assessment-question-generator` from the same commit.
- `npm run test:ci` passed: all three TypeScript checks, 33 validators, 229 unit tests across 22 files, and the production bundle. Docker/`psql` were unavailable, so database, authenticated integration, and Chromium E2E execution remain CI-owned.

See `ASSESSMENT_EXPORT_VISUAL_IMPLEMENTATION_MANIFEST.md` for the full implementation and verification record. The Phase A source archive is `gurodesk-assessment-export-visual-stable.zip`. Phase B was built from this green checkpoint without fabricating or paraphrasing official competencies.

## Release boundary

This release preserves Phases 1–5.4 and completes:

1. **Phase 5.5 — Automated Integration, Migration, RLS, and Regression Testing**

**Stop here.** Do not begin class records, grading sheets, report cards, attendance, a student portal, a curriculum expansion, or another major teacher workflow without explicit authorization.

GitHub `Juvialski/Gurodesk` `main` at commit `022afc55dd0f43f964f5d56df5111fe3c1e2da5a` was verified as the implementation source. The attached ZIP was byte-for-byte identical to that checkout. All existing migrations 001–021 and production behavior were preserved.

The first attempted GitHub write for Phase 5.5 returned HTTP 403 (`Resource not accessible by integration`), so no further repository writes were attempted. The root-level Phase 5.5 ZIP is the handoff artifact; importing it onto `main` will trigger the included CI workflow.

## Phase 4.4 assessment architecture

The finalized TOS remains the allocation authority. Item number, source TOS/version, verified competency, cognitive category, and allocation range are immutable assessment-slot data. Question type and scoring are independent assessment attributes and cannot rewrite that allocation.

One shared `AssessmentItem` architecture now supports eleven discriminated, structured answer payloads:

- Multiple Choice
- True / False
- Short Answer
- Constructed Response
- Identification
- Fill in the Blank
- Numerical Answer
- Problem Solving / Show Your Solution
- Matching Type
- Multiple Select / Select All That Apply
- Essay / Extended Response

The extension points and validators live primarily in `src/types/assessment.ts`, `src/lib/assessmentValidation.ts`, and `src/lib/assessmentScoring.ts`. Objective answers, accepted terms, independent fill blanks, numerical value/tolerance/unit, problem subparts, matching groups/mappings, multiple-select sets, expected elements, and rubrics remain structured data. No answer key is reconstructed by Gemini.

### Item count and point count

Every TOS slot remains one assessment item. Every scored item has a positive `pointsPossible`; total possible points is derived from the item sum. It is not a separately authoritative total. Legacy records without explicit points normalize to one point.

Supported scoring structures include:

- editable type defaults and per-item points;
- optional target points with an explicit remaining/over-target delta and no silent redistribution;
- problem-solving subparts whose explicit point sum must equal the item total;
- per-blank fill scoring whose explicit point sum must equal the item total;
- matching per-response or group scoring with deterministic reconciliation;
- all-or-nothing Multiple Select with no negative marking;
- explicit rubric criteria for Essay/Constructed Response whose point sum must equal the item total; and
- bounded teacher-awarded partial credit from zero through `pointsPossible`.

`src/lib/assessmentDistribution.ts` handles Auto/Balanced, fixed counts, percentages, and manual per-item type assignment. Distribution reconciles deterministically to the immutable slot count; disabled types cannot be assigned or generated. Item percentages and point weights are labelled separately.

### Mobile editor and item lifecycle

`src/pages/AssessmentEditorPage.tsx` renders one active type-specific editor rather than every item editor. It provides Previous/Next, direct numbered navigation, completion state, immutable competency/cognitive badges, type and point controls, structured answer editors, notes, and simple QA states.

The editor includes mobile controls for choices, blanks, numerical tolerance/unit, subparts, matching columns/mappings/distractors/reordering/reuse, multiple-select correct sets, expected responses, key points, and rubrics. It also supports single-item Generate/Replace/Alternative/Check Accuracy actions, bounded version history with restore, lock/unlock, and Generate Missing behavior that skips completed, teacher-edited, accepted, and locked items unless the teacher explicitly targets them.

Material edits preserve a previous version and mark the item teacher-edited. Answer-sensitive edits require recheck without spending an immediate AI request. Locked items cannot be silently changed by batch generation, verification repair, or restore.

### Adaptive Gemini QA

`src/lib/assessmentGeneration.ts`, `src/lib/assessmentQa.ts`, `src/lib/assessmentRequestScheduler.ts`, and the authenticated `assessment-question-generator` Edge Function implement the adaptive flow:

1. Run deterministic structural, answer, scoring, allowed-type, and immutable-mapping validation.
2. Stop after generation for valid low-risk items.
3. Route higher-risk or explicitly requested items to independent verification, preferring the other Lite model.
4. Stop on verifier pass.
5. Repair only the affected item when verification fails, validate again, and stop at a conservative ceiling with teacher review if unresolved.

Default Gemini behavior remains `gemini-3.5-flash-lite` with high thinking and Lite-only automatic fallback to `gemini-3.1-flash-lite`. The scheduler uses a per-model queue, bounded concurrency, a default ten requests/minute safety target (configurable only up to twelve), cancellation, `Retry-After`/backoff handling, and finite retries. Successful items are persisted even if a later batch item fails or quota pauses generation. Local daily counts are explicitly approximate and never treated as Google quota authority.

The verifier receives only the completed question, immutable mapping context, points, structured proposed answer, and teacher-authorized context. Learner data is excluded. A failed repair never changes item number, competency, cognitive category, type, points, or source TOS mapping.

### Final review and exports

`src/lib/assessmentFinalReview.ts` separates blocking hard errors from teacher-overridable quality warnings. It checks slot coverage, duplicate numbers, immutable mapping, type payloads, points/component totals, answer-recheck states, matching integrity, exact/near duplicates, duplicate choices, suspicious answer patterns, notation/language warnings, and item/point distributions across types, competencies, and cognitive categories.

Student Copy, Teacher Copy, and Answer Key/Scoring Guide are produced from stored structured data. Student output omits answers, mappings, competency/cognitive metadata, AI/QA state, internal IDs, and technical provenance. Teacher/key output includes type-aware answers, points, solution guidance, per-match/per-blank detail, subparts, key points, and rubric criteria where applicable. Built-in Print, PDF, and DOCX paths are retained.

## Phase 5.4 results compatibility

Results now store and validate `earnedPoints` against the item's snapshotted `possiblePoints`. Main learner scores are derived as total earned points over total possible points; fully-correct item count is a separate statistic. Deterministically auto-scorable types use the saved structured answers. Problem Solving, Constructed Response, and Essay remain teacher-scored, with partial credit supported. Fill and Matching can earn component partial credit; Multiple Select follows its saved all-or-nothing policy.

`src/lib/itemAnalysis.ts` retains binary correctness facility for genuinely binary items and labels it separately. Multi-point/component or observed partial-credit work uses mean points and normalized point achievement; it is not misrepresented as binary facility. Competency and cognitive summaries expose item counts while using point-earned/point-possible denominators for score-based achievement, so a one-point item is not weighted like a ten-point essay.

Remediation defaults to point-weighted evidence for new plans and preserves the saved basis for legacy plans. Threshold denominators use valid possible points. Optional Gemini remediation remains aggregate-only: verified competency, cognitive categories, counts, and aggregate score distributions are allowed; learner names, IDs, local references, raw answers, per-learner scores, and histories are not sent.

Draft result entry remains local/debounced and batch-persisted rather than saving every keystroke or issuing one network request per cell. Existing one-point assessments, result sessions, item analysis, remediation plans, reports, demo records, and snapshots remain compatible.

## Phase 5.5 automated regression harness

Phase 5.5 adds no teacher-facing feature and no database migration. It converts the production regressions from Phases 5.0–5.4 into executable behavior gates:

- Vitest unit regressions cover error extraction, Render SPA fallback, assessment AI risk routing and one-item repair, malformed provider JSON, scheduler pacing/retry ceilings/429 handling, lock and replacement behavior, partial-credit totals, and Gemini Lite fallback boundaries.
- The database harness applies the real migrations 001–022 to a fresh database and separately upgrades a data-bearing schema from migration 014 through 022. It asserts final schema behavior, the migration 018 trigger/backfill, preserved IDs/data/points, migration 020 existing-assessment saves, and finalized-assessment immutability.
- Supabase integration tests use two real local Auth users and teacher JWTs for RLS, new/existing assessment RPC saves, duplicate/archive behavior, 40-item round trips, explicit PostgREST foreign-key relationships, tamper rejection, lock/unlock behavior, the required `1/1 + 3/5 + 8/10 = 12/16` result path, analysis, remediation, and cross-teacher denial across the major Phase 2–5.4 teacher-owned domains.
- Playwright covers authenticated dashboard access, finalized-TOS assessment creation, editor save/reload/list/reopen behavior, and representative deep-route refreshes.
- GitHub Actions runs the static/unit/build gate and a single disposable local Supabase stack for fresh/upgrade migration, integration, and Chromium E2E tests. `npm run test:release` provides the equivalent local release gate.

All networked test entry points reject the production project ref `hmeybakjxtzmiebtxonc` and non-loopback Supabase URLs. Gemini calls are mocked or aborted, so automated tests never consume a teacher key or provider quota. Full commands, fixture boundaries, and failure ownership are documented in `docs/TESTING.md` and `PHASE55_TESTING_MANIFEST.md`.

## Database changes and security review

Apply all migrations in filename order. New additive/corrective migrations are:

17. `supabase/migrations/202608090017_phase44_question_type_enum.sql`
18. `supabase/migrations/202608090018_phase44_assessment_scoring_qa.sql`
19. `supabase/migrations/202608090019_phase54_results_compatibility.sql`
20. `supabase/migrations/202608090020_fix_assessment_save_alias_ambiguity.sql`
21. `supabase/migrations/202608090021_phase55_explicit_data_api_grants.sql`
22. `supabase/migrations/202608090022_phase55_integration_guard_fixes.sql`

Migration 017 extends the database question-type enum. Migration 018 adds assessment settings, target points, points, QA/lifecycle metadata, bounded per-item history, strict typed payload validation, and owner-authoritative save/finalize rules. Migration 019 hardens multi-point result snapshots/outcomes, answer shapes, score bounds, batch save relationships, and compatibility defaults. Migration 020 corrects the existing-assessment save alias ambiguity.

The static adversarial review covered migrations 013–020, foreign-key ownership paths, grants, owner-only RLS, immutable finalized records, service-role-only AI audit inserts, private template Storage paths, and `SECURITY DEFINER` functions with explicit safe `search_path` and `auth.uid()` ownership derivation. Browser configuration contains only publishable Supabase values. A repository scan found no committed Gemini key, service-role key, database URL/password, access token, JWT, encryption secret, or private key value.

The Phase 5.5 local-stack gate now executes the previously manual fresh/upgrade migration and two-teacher RLS acceptance paths without using production credentials.

## Production deployment

The Vite frontend remains a Render Static Site; Supabase remains the backend. `render.yaml` uses `npm ci && npm run build`, publishes `dist`, and rewrites `/*` to `/index.html`. `public/_redirects` supplies the same SPA fallback for direct refreshes under lessons, TOS, assessments, results, analysis, and remediation routes.

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in Render browser variables. Supabase service-role material, database credentials, Gemini keys, credential-encryption keys, and privileged tokens must never be exposed through `VITE_*`.

Phone-friendly deployment and acceptance instructions are in:

- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/PRODUCTION_SMOKE_TEST.md`
- `docs/PHASE_5_4_SECURITY_REVIEW.md`
- `docs/PHASE_5_4_PRODUCTION_ACCEPTANCE.md`
- `docs/TESTING.md`
- `PHASE55_TESTING_MANIFEST.md`

## Validation result

On 2026-08-09, the retained local static gate passed:

- application, test, and E2E TypeScript checks;
- every existing project validator from Phases 1–5.4;
- 17 new Vitest regression tests across five files; and
- the production Vite bundle with 2,027 modules transformed successfully.

The Playwright runner also discovered all eight intended setup/browser tests. This workspace did not provide Docker or `psql`, so database, Supabase integration, and browser execution must run through the included GitHub Actions local-stack job after the ZIP is imported. A skipped live gate cannot report green. The only local build diagnostic was Vite's existing non-fatal large-chunk advisory; no validator was removed or weakened.

## Known limitations

- Deployed Auth redirects, Storage isolation, real Edge Function/BYOK behavior, and the production smoke checklist still require the staging/production projects.
- Android route-refresh, slow-network/reconnect, real provider 429/quota behavior, and physical PDF/DOCX/print inspection for every new question type require the production smoke test.
- The local Gemini request estimate counts GuroDesk-observed requests and cannot know provider-wide usage; an Edge Function's internal Lite fallback can add provider usage not visible as a separate browser invocation. Provider responses remain authoritative.
- Subjective responses are not automatically graded by AI. Teachers award final partial credit.
- Arbitrary repeating-question blocks in uploaded custom assessment DOCX masters and full custom result-analysis XLSX filling remain explicit future extension points, not claimed features.
- The production JavaScript bundle still triggers Vite's large-chunk advisory. It is safe to deploy but route-level code splitting is a later performance improvement.

## Release stop

Phase 6 universal curriculum is the current stopping point. Run the normal release gate and production smoke checks before beginning another document domain or major product phase.


## Phase 6 universal curriculum handover — 2026-08-10

The current source of truth extends the assessment-generation/visual checkpoint and Phase 6 national catalog with teacher-owned custom/hybrid curriculum support. Preserve migrations 025 and 026 and all related files. Migration 026 is a database-only hotfix for the Phase 6 publication RPC; it is not the abandoned Gemini model-discovery experiment.

Key invariants:
- `teacher_assignments.curriculum_source_kind` is `official|custom|hybrid`; custom/hybrid assignments pin `curriculum_version_id`.
- Official curriculum rows are shared/immutable (`owner_user_id is null`, `origin_kind=official`).
- Teacher-owned custom/hybrid versions are published only through `publish_custom_curriculum` after review.
- Raw curriculum uploads live in private `custom-curricula` Storage paths scoped by user/import ID.
- Hybrid bases must be official; inherited competencies retain `base_competency_id` and `provenance_kind=inherited`.
- `guard_assignment_curriculum_competency_link()` runs on both lesson-plan and TOS competency links so downstream documents cannot mix assignment curriculum sources/versions.
- Approved revisions supersede earlier teacher-owned versions; historical pinned documents remain readable.
- Curriculum catalog breadth is not equivalent to verified competency coverage; never synthesize official DepEd competency text from model memory.
- Custom curriculum analysis reuses the existing teacher BYOK model policy unchanged. No new provider model IDs or automatic model-discovery behavior were introduced by Phase 6.

Release gate: migrations 001–026, static/unit/build, fresh/upgrade DB assertions, two-teacher integration/RLS, and Chromium E2E must pass in GitHub Actions. The previously failing assessment-flow E2E was hardened by scoping the `final` status assertion to the TOS card created by that test; GitHub Actions remains the authority for confirming the fix.

Assessment generation production invariant (2026-08-10):
- Normal assessment generation/repair uses the production-proven raw Gemini `generateContent` boundary with `generationConfig.responseMimeType = "application/json"` only.
- Do **not** attach `responseFormat` or provider `responseSchema` to normal question generation. Both caused live provider regressions during this release cycle; exact 11-type answer/visual validation remains authoritative after JSON parsing in the server contract.
- The explicit verifier operation is separate and may keep its small fixed schema.
- `extractGeminiText()` must exclude any response part marked `thought: true` before joining final JSON text.
- Gemini Lite HIGH-thinking policy and the 3.5/3.1 Lite fallback remain unchanged; no routine extra provider call was added.
- CI uses a disposable local Supabase stack and does not itself deploy hosted Edge Functions. After an assessment-generator change, verify the production `assessment-question-generator` deploys from the same `main` commit as the frontend.

25. `supabase/migrations/202608100025_phase6_custom_hybrid_curricula.sql`
26. `supabase/migrations/202608100026_phase6_publish_curriculum_subject_id_hotfix.sql`

## Assessment generation provider regression hotfix — 2026-08-10

After the Phase 6 CI-green checkpoint, a provider-contract experiment reintroduced `generationConfig.responseFormat` for Gemini 3.5 Flash-Lite and production returned the previously known structured-request HTTP 400 failure. The current source restores the production-proven raw `generateContent` boundary: normal generation/repair use `responseMimeType: application/json` only, with no `responseFormat` and no provider schema. Exact 11-type answer/visual validation remains server-side. Do not reintroduce `responseFormat` into the raw assessment generation request. See `README_ASSESSMENT_JSON_MIME_RESTORE.md`.



## TikZ-first math visuals + generated-answer normalization — 2026-08-10

The assessment visual pipeline is now math-first without allowing model-supplied executable markup:
- Gemini returns only the bounded validated assessment visual data model; it must never return TikZ, SVG, HTML, JavaScript, raster data, or an executable formula string.
- GuroDesk deterministically translates a validated visual into TikZ in `src/lib/assessmentTikz.ts`. All model-supplied labels are TeX-escaped before compilation.
- Browser preview compiles that GuroDesk-authored TikZ in the sandboxed `AssessmentTikzDiagram` runtime. The existing deterministic React/SVG renderer remains the loading/offline/export fallback; print/PDF remain deterministic and do not depend on executing model code.
- Cartesian graphs are represented by `cartesianAxes` plus one or more `cartesianPlot` primitives. Plot data is sampled numeric `(x,y)` points bounded by a referenced axis; GuroDesk never evaluates a model-supplied function/formula string.
- Geometry TikZ uses restrained textbook line styling and opaque label backing to keep labels readable when model coordinates approach a segment or angle ray.
- Generated short-answer/identification/fill-in-the-blank accepted-answer arrays are normalized before acceptance. Equivalent capitalization and terminal-punctuation variants are deduplicated rather than rejecting an otherwise valid suggestion. Final stored assessment validation remains strict.

Regression guard: `scripts/check-assessment-math-visuals.mjs` runs automatically under `validate:all` because the validator harness executes every `check-*.mjs` script. Preserve this guard when extending visuals.

No database migration was added. Migration count remains 26.

## Assessment visual answer-leak + TikZ stability hotfix — 2026-08-10

Production testing of the TikZ-first visual build exposed two follow-up issues:
- Gemini could place the accepted answer/classification in a fill-in-the-blank prompt example and in `visual.altText`.
- TikZJax could briefly render an SVG, report ready, then replace/remove that transient node, leaving the editor blank after the deterministic SVG fallback had been unmounted.

Current invariants:
- AI-generated `visual.altText` is never trusted verbatim. After the visual DSL validates, GuroDesk replaces it with a neutral observational accessibility description derived from the safe primitives. It must not state the requested classification, accepted answer, solution, or conclusion.
- Generated fill-in-the-blank, short-answer, and identification prompts may not reveal their accepted answer. A parenthetical example containing the answer is removed deterministically; a remaining direct answer hint causes candidate rejection.
- `AssessmentTikzDiagram` keeps the deterministic SVG renderer mounted underneath the TikZ iframe at all times. TikZ readiness requires a stable compiled SVG after a short settling window. A transient/blank TikZJax render therefore cannot make the diagram disappear.
- The TikZ-first security model is unchanged: Gemini supplies structured visual data only; GuroDesk owns TikZ generation; no model-supplied executable TikZ/SVG/HTML/JS is allowed.

No database migration was added. Migration count remains 26.

## Assessment accept/export reliability hotfix — 2026-08-10

After the TikZ visual rollout, Chromium E2E exposed that the print route no longer contained the deterministic inline `svg.assessment-document-question-visual` expected by the export contract. The print/export document now intentionally uses `AssessmentSvgDiagram`; editor/suggestion visuals remain TikZ-first with SVG fallback.

Generation workflow was also simplified: individual `Accept` is now `Accept & lock`, and the editor offers one `Accept ready & lock (N)` action for batch-generated suggestions that passed deterministic QA and were not flagged for review. The bulk action saves once after approval. Flagged items remain manual-review items; generation itself never silently counts as teacher approval.

Invalid optional provider visuals are now dropped instead of failing the entire generated item. A prompt that refers to a missing dropped visual is deterministically flagged `missing-visual` / `needs_review`, keeping it out of the bulk-ready approval path.

No schema change. Migration count remains 26.

## Assessment one-action teacher verification hotfix — 2026-08-10

After production testing showed that per-item acceptance/verification/locking made a 40-item generated assessment impractical, the assessment editor was simplified.

- Primary draft action is now `Accept, verify & finalize all`.
- One explicit teacher click applies pending suggestions, runs deterministic structural QA, teacher-accepts and locks every structurally valid completed item, acknowledges non-blocking review warnings, saves, and finalizes when no structural errors remain.
- No routine per-item Gemini verification calls are added by this action.
- Persisted generated items can be teacher-approved after refresh even when their transient suggestion object is gone.
- Genuine broken answer structures remain blockers and are never silently approved.
- Final-review duplicate messages are grouped with item numbers instead of rendered as a wall of repeated lines.
- `gemini-assessment-contract.test.ts` was corrected to match the deliberate invalid-optional-visual degradation behavior.
- No database migration; migration count remains 26.

## Assessment unlock + legacy single-blank recovery hotfix — 2026-08-10

After the one-click assessment finalization workflow, production testing exposed two state-recovery issues:

- Explicitly unlocking a previously accepted item was only a local state toggle, so a later save/reload could restore the stale persisted lock. `AssessmentEditorPage` now saves lock/unlock immediately and uses the shared lifecycle helpers.
- Older generated fill-in-the-blank items could contain a visible `____` marker while their structured `answer.blanks` array was missing. For exactly one visible blank marker, GuroDesk now restores the newest valid single-blank answer from bounded item history; without prior answer data it creates an empty blank shell and requires teacher input. It never guesses answers from rationale text. Multi-blank prompts remain strict.
- Whole-assessment verification now leaves structurally blocked questions unlocked for immediate repair instead of leaving them trapped in a locked state.

Preserve this behavior in later assessment and curriculum work. Migration count remains 26; no database migration was required.

## Assessment grouped-section + locked-save hotfix — 2026-08-10

- Auto/Balanced question types are contiguous sections in fixed UI order; do not reintroduce round-robin/random slot assignment.
- Locked completed items must be skipped by generation and must round-trip byte/JSON-semantically unchanged during a full assessment save.
- Matching `reusableChoices=false` is canonicalized by omission; do not reinsert an explicit false during repository load.
- The Phase 4.4 validator checks `unlockAssessmentItem`, not the old ad-hoc `qaState: unlocking` marker.

## 2026-08-10 — Auto-prepare persisted-unlock root fix

- Fixed automatic blocker regeneration: AI-owned blocked rows are now persisted **unlocked before** the hosted assessment Edge Function is called. The previous local-only unlock caused the server to reject every regeneration as locked while the UI appeared to retry.
- Blocker-specific Final Review reasons are now sent to Gemini as mandatory automatic-repair requirements; recurring visual blockers escalate on later bounded passes to a self-contained non-visual replacement where appropriate.
- Non-provider repair failures are surfaced instead of swallowed.
- Automatic preparation uses at most 3 full QA/repair passes and never auto-overwrites teacher-authored/teacher-edited items.
- Fixed Source TOS header compression on tablet/narrow desktop widths by stacking context/progress/action regions.
- No migration, TOS mapping, scoring, results, curriculum, or Gemini JSON-MIME wire-contract change.


## Assessment visual split + Word-first export stabilization — 2026-08-10

Current assessment release invariants after the auto-prepare root fix:

- Normal `generate` / `repair` operations return only the typed question, structured answer, rationale/resources, and `visualRequirement` + `visualIntent`. They do **not** return diagram geometry.
- `assessment-question-generator` exposes a separate authenticated `visual` operation. Only when the finished question requests a helpful/required diagram does the browser make that second provider request. The validated question is first written to the resumable local generation checkpoint, so a refresh/quota interruption during visual work does not discard the paid-for question.
- The visual operation receives the immutable item context plus the finished learner prompt and structured answer, then returns only the existing bounded `AssessmentVisual` JSON DSL. Model-supplied TikZ, SVG, HTML, JavaScript, arbitrary formula/code strings, URLs, raster/base64 data, and executable content remain prohibited.
- GuroDesk remains the sole TikZ/SVG author: server/client visual validation runs before deterministic `assessmentVisualTikzSource()` / `assessmentVisualSvgMarkup()` rendering.
- Visual-only Final Review blockers use one dedicated visual-only automatic retry. The existing question text and structured answer are preserved. Mixed/non-visual blockers may still use the bounded full-question repair path.
- A provider boundary reached after a question succeeds (for example during its separate visual/verifier pass) preserves that successful question and pauses the remaining generation batch rather than burning more requests.
- Automatic distribution modes require contiguous question-type sections before finalization. Manual per-item mode remains the explicit escape hatch for a teacher-chosen custom order; no teacher-authored item is silently reordered.
- Assessment Word `.docx` is now the primary download action. Word content stays native/editable: administrative/school header, learner/test metadata table, grouped Part headings, native matching tables, type-specific response areas, and teacher/key annotations.
- Valid assessment diagrams are embedded in Word as deterministic SVG `ImageRun`s with a PNG compatibility fallback. The old `[Diagram: ...]` placeholder is no longer used for a valid visual. PDF remains available as a secondary deterministic path.
- Student export never trusts stored/model visual alt text: it derives neutral accessibility text from observable geometry only, and deterministic Final Review blocks learner-facing visual labels/alt text that reveal concise accepted answers.
- No database migration was added. Migration count remains 26. The modified hosted `assessment-question-generator` Edge Function must be deployed from the same release commit as the frontend.

CI baseline fixes included in this checkpoint:
- `tests/unit/assessment-auto-prepare.test.ts` gives the mocked generator an explicit `Promise<AssessmentItemSuggestion>` return type so literal `editable: true` is not widened to `boolean`.
- `tests/e2e/assessment-flow.spec.ts` scopes the Source TOS title assertion to the visible `.assessment-editor-context`, avoiding the hidden duplicate title locator that failed Chromium.

Static release guards cover the separated visual operation, one-retry visual-only repair ceiling, successful-question provider pause, contiguous-section finalization, Word SVG embedding, native Word matching/info tables, and Word-first preview action.


## Assessment generation stability hotfix — 2026-08-11

- Fixed stale failure UI: a successful retry now immediately removes that item from the visible batch-failure list.
- Bulk generation is sequential (`concurrency: 1`) to reduce mobile/network and BYOK pressure.
- `FunctionsFetchError` / `Failed to send a request to the Edge Function` is classified as retryable Edge transport failure; after its bounded scheduler retries are exhausted, the batch pauses instead of cascading the same failure across remaining items.
- The post-generation verifier/visual paths use the same service-boundary pause decision, preserving the already-generated question before stopping.
- Backward compatibility is restored for an older deployed assessment generator: legacy question responses that already contain a validated `visual` are accepted even without `visualRequirement`/`visualIntent`, and GuroDesk does not issue the newer second `visual` operation in that case.
- With the new generator contract, only `visualRequirement=required` triggers the automatic second visual request. `helpful` visuals are deferred so ordinary self-contained questions do not double provider traffic.
- Independent opposite-Lite verification is now automatic only for high-risk items; medium-risk items still receive deterministic QA without an extra Gemini request.
- CI fixes included: batch-regression callback returns `void`, and the Source TOS Playwright assertion targets the actually visible context/title rather than a hidden responsive duplicate.
- No migration was added.

## Major Simple-first UI/UX upgrade — 2026-08-11

- The application shell is task-oriented: desktop sidebar plus a phone bottom
  bar for Home, Create, Classes, Results, and More. Existing deep links and
  print/export routes remain valid.
- Home and Create use real workspace/repository state. They never synthesize
  activity metrics or bypass workflow prerequisites.
- Workspace context remembers only explicit assignment/section choices, is
  scoped by authenticated user, validates active ownership on each consumer,
  and never infers competency or grading-term/curriculum-period mappings.
- Assessment, TOS, Lesson Plan, Results, and Curriculum now default to guided
  Simple views while retaining the same records, repositories, and full
  Customize/Manage surfaces.
- Gemini setup is optional and feature-local. Manual classes, curriculum,
  documents, TOS, lessons, assessments, and results remain accessible without
  a Gemini key. Existing BYOK/server-only safeguards are unchanged.
- Automatic assessment preparation may generate, enrich, repair, and save a
  structurally checked **draft only**. AI suggestions remain `Needs review`.
  Only the explicit teacher action (`I reviewed — finalize test` in Simple or
  `Accept, verify & finalize all` in Customize) may accept, lock, and finalize.
- Settings hashes, phone/context dialog focus management, 44px mode controls,
  and Results roster-loading race protection were added after final audits.
- `npm run test:ci` passes with all 35 validators and 238 unit tests. Full
  browser/Supabase E2E remains to be run in an environment with Chromium and
  `E2E_SUPABASE_*` configured.
- No migration, Edge Function, official curriculum data, scoring, RLS, BYOK,
  or canonical assessment export contract changed. Deploy the frontend only.

See `docs/UI_UPGRADE_IMPLEMENTATION_MANIFEST_20260811.md` and
`UI_UPGRADE_VALIDATION_REPORT_20260811.md` for the complete scope and release
evidence.
## 2026-08-12 — Assessment Generation V2 Render TS2345 build hotfix

Render exposed a project-wide TypeScript error that the earlier isolated V2 validation did not catch: `src/lib/assessmentRepository.ts:704` treated the canonical master plan as `AssessmentMasterPlan | undefined` because the helper used the optional `settings.masterPlan` property type. The repository now imports and uses the concrete `AssessmentMasterPlan` type for the canonicalizer and `createAssessmentFromMasterPlan`. This is a type-contract-only hotfix; it does not change master-plan behavior, migrations, Edge payloads, CPD allocation, point ranges, or legacy assessment behavior. See `ASSESSMENT_GENERATION_V2_BUILD_HOTFIX_20260812.md`.

## 2026-08-12 — Create Assessment V2 UI wizard + migration 029 checkpoint guard fix

Create Assessment V2 received a presentation-only overhaul: a centered three-step Source → Setup → Formats wizard, compact format selectors, collapsed advanced planning guidance, simplified cognitive coverage summary, segmented visual policy controls, responsive/mobile styling, and a final setup summary. The existing generation/master-plan functions are unchanged.

GitHub CI run 44 exposed one remaining local Supabase integration failure in `save_assessment_item_visual_checkpoint`: `Assessment item writes must use the save RPC`. Migration `202608120029_visual_checkpoint_rpc_guard_fix.sql` replaces only that checkpoint RPC and sets `app.assessment_rpc=1` transaction-locally before the narrow assessment item/document update. Owner/stale-write/locked-item/RLS protections remain intact. Migration harness wording now covers 015-029.

## 2026-08-12 — Assessment V2 runtime + E2E hotfix

After the V2 wizard deployment, production immediately paused during master planning with Gemini HTTP 400. The master-planner Edge Function still sent a provider `responseSchema`; it now uses JSON MIME mode + HIGH thinking and retains strict local `validateProviderPlan()` validation and the existing 3.6 → 3.5 → 3.5 Lite → 3.1 Lite model order. No V2 allocation/CPD/persistence logic changed.

GitHub CI run 31562090079 subsequently proved static/type/unit/build, fresh/upgrade migrations and all 12 Supabase integration tests green. Its only failures were three Playwright assertions tied to the removed pre-V2 `New assessment`/`Create draft` UI and an ambiguous phone `Create` locator. E2E tests now follow the wizard, seed non-AI editor/export fixtures through the real guarded local save RPC, and scope phone navigation. See `ASSESSMENT_V2_RUNTIME_E2E_HOTFIX_20260812.md`.

## 2026-08-12 — V2 checkpoint finalization + remaining E2E fix

A production V2 generation run exposed an orchestration bug after the master-planner HTTP-400 fix: `AssessmentNewPage` persisted the pass-1 question from `onQuestionReady`, then tried to apply the verifier/QA result through the ordinary non-alternative path. The existing-content protection correctly rejected that second application. `applyCheckpointedAssessmentItemSuggestion` now permits only the exact same AI-owned, unlocked checkpoint to receive its final QA result; teacher edits and unrelated existing content remain protected. Pending selection in AssessmentNewPage now uses `hasExistingAssessmentContent()` so Retry/Resume generates only genuinely blank items.

Latest CI also had two stale E2E assertions only: the print visual class now belongs to the TikZ shell (nested deterministic SVG fallback), and the Assessments boundary copy is now `Finalized TOS → point plan → teacher review`. Tests were updated to the current production contracts; production UI was not bent back to old behavior. See `ASSESSMENT_V2_CHECKPOINT_GENERATION_AND_E2E_FIX_20260812.md`.
