# GuroDesk Phase 6 — National Curriculum Coverage Foundation

Date: 2026-08-10

## Source of truth

Phase 6 is based on the uploaded `gurodesk-generation-visual-final.zip`, which contains the assessment generation/visual work completed after GitHub `main` commit `b30cd6084b011523b717c2242e1525d0486e5449`.

The Phase 6 work preserves that checkpoint and does not roll back its Gemini generation, safe geometry/SVG, persistence, assessment, results, security, or testing changes.

## Implemented

### National curriculum catalog

- Added `src/data/curriculumCatalog.ts` with school-year-aware catalog entries for Kindergarten through Grade 12.
- Current SY 2026-2027 contains at least one source-grounded catalog offering for every grade level.
- Revised K to 10 rollout is modeled by grade and school year:
  - Phase 1: Kindergarten, Grades 1, 4, 7 — rollout from SY 2024-2025.
  - Phase 2: Grades 2, 3, 5, 8 — rollout from SY 2025-2026.
  - Phase 3: Grades 6, 9, 10 — rollout from SY 2026-2027.
- Historical pre-rollout selections are retained as `transitional` legacy catalog records instead of silently remapping them.
- Strengthened SHS Grade 11 catalogs current Core, Academic elective, and TechPro elective offerings.
- Grade 12 keeps the separately published Strengthened SHS pilot/new-guide offerings distinct from the current non-pilot legacy transition.

Catalog status is explicit:

- `verified_competencies`
- `official_guide_catalogued`
- `official_family_catalogued`
- `transitional`

Only `verified_competencies` means an exact competency pack may drive lesson/TOS/assessment workflows.

Current catalog statistics at implementation time:

- 245 total catalog entries
- 73 Revised K to 10 entries
- 55 historical K to 10 transition entries
- 116 Strengthened SHS catalog entries
- 1 fully verified competency pack: Grade 7 Mathematics

### Teacher setup and curriculum UI

- Onboarding learning areas are now derived from grade + school year rather than a generic static list.
- My Classes uses the same grade-aware catalog.
- Assignment setup shows whether the selected curriculum has a verified pack, is catalogued only, or is transitional.
- Assignment creation is blocked when there is no source-catalogued selection for that grade/year.
- Curriculum Navigator now includes a searchable national curriculum catalog even before the teacher creates an assignment.
- Each catalog entry links to its registered official DepEd source and explains its coverage state.

### Curriculum resolver hardening

`loadCurriculumNavigator()` now:

- resolves the selected assignment against the national catalog and aliases;
- considers all applicable `full`, `pilot`, `transitional`, and `legacy` curriculum versions for the selected school year/grade;
- matches the version that actually contains the selected subject instead of globally taking the first applicability row;
- prefers the catalog's curriculum code when multiple versions contain the same/aliased subject;
- continues to load only `verification_status = verified` competency rows;
- returns `available: false` for a catalogued subject with zero verified competency rows;
- preserves the exact Grade 7 Mathematics bundled-manifest fallback.

This is required for future coexistence of revised, pilot, and legacy curricula without silent cross-version selection.

### Verified-pack import pipeline

- Added `data/curriculum/README.md` with source-integrity requirements.
- Added `scripts/generate-all-curriculum-sql.mjs` to batch-generate SQL only for manifests explicitly marked verified.
- Added `npm run curriculum:generate:all`.
- Existing Grade 7 Mathematics still validates at 52 exact reviewed competencies, 4 guide periods, and 3 domains.

### Validation and documentation

- Added `tests/unit/curriculum-catalog.test.ts`.
- Added `src/lib/curriculumResolution.ts` plus `tests/unit/curriculum-resolution.test.ts` so concurrent pilot/legacy/full version selection is a pure deterministic unit rather than untestable repository branching.
- Added `scripts/check-phase6-curriculum.mjs`; it is automatically included by the existing validator discovery runner.
- Added `docs/PHASE_6_CURRICULUM_COVERAGE.md`.
- Extended `docs/DEPED_SOURCE_REGISTER.md` with Phase 6 source/provenance decisions.
- Updated `README.md` and `CODEX_HANDOVER.md`.

## Database changes

None.

The national catalog is application metadata. Exact source-verified packs continue to use the normalized Phase 2 curriculum tables and existing RLS/read architecture.

## Validation performed in this environment

Passed:

- Phase 6 static validator.
- TypeScript syntax transpilation with diagnostics for every Phase 6 changed TS/TSX/test file.
- Existing curriculum manifest validator.
- Batch curriculum SQL generator.
- Runtime catalog assertions across Kindergarten–Grade 12, rollout transitions, aliases, SHS offerings, and source host allowlisting.
- Existing validators from BYOK through Phase 3.7 before the environment reached validators requiring local npm packages.

Dependency installation could not complete because the execution environment's internal npm mirror returns 404 for `yallist@3.1.1`. Therefore the full post-Phase-6 `npm run test:ci` / Vite bundle was not rerun here.

The incoming Work checkpoint reported its pre-Phase-6 gate as green (25 validators, 172 unit tests, TypeScript/tests/E2E compilation, and Vite build). GitHub Actions remains the authoritative post-import release gate for the Phase 6 changes.

## Source integrity / deliberate limitation

**Do not claim that all 245 catalog entries already contain exact competency text.**

The catalog makes official curriculum offerings discoverable and version-aware. Exact competency packs remain source-gated. Grade 7 Mathematics is currently the bundled verified pack. Future packs must be transcribed/reviewed from official DepEd materials with provenance before changing their status to `verified_competencies`.

This limitation is deliberate: GuroDesk must never use model memory or synthetic text as an official DepEd competency database.
