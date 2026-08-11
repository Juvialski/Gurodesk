# Official curriculum implementation manifest

Date: 2026-08-11

Starting checkpoint: Phase A commit `b2cc5c8cc392c17540de4162aa7fd76483566db7`

This checkpoint completes Phase B of the 2026-08-11 handoff: current national catalog coverage is backed by detailed, source-pinned official curriculum manifests and one deployment-ready Supabase seed. Phase A assessment export and visual-enrichment behavior is preserved.

## Delivered coverage

| Program | Catalog entries | Manifests | Official PDFs | Competencies |
| --- | ---: | ---: | ---: | ---: |
| Revised K to 10 / MATATAG | 73 | 80 | 13 | 4,277 |
| Strengthened SHS Grade 11 | 94 | 94 | 94 | 1,552 |
| Strengthened SHS Grade 12 | 22 | 22 | 22 | 352 |
| **Total** | **189** | **196** | **129** | **6,181** |

The 196-to-189 difference is deliberate. Seven Grade 4–10 MAPEH catalog entries each map to two detailed manifests because DepEd publishes separate Music and Arts and Physical Education and Health guides.

All current catalog entries in `src/data/curriculumCatalog.ts` are now marked verified. The catalog snapshot and coverage validator prove that every entry maps to at least one detailed manifest and every manifest maps to one of the 129 pinned sources.

## Official source provenance

The reviewed source set consists of 74,537,724 bytes across 129 PDFs acquired from official Department of Education pages and file links:

- Revised K to 10 / MATATAG program page: `https://www.deped.gov.ph/matatagcurriculumk147/`
- Reviewed MATATAG repository: `https://bukidnon.deped.gov.ph/matatag-curriculum/`
- Strengthened SHS program page: `https://www.deped.gov.ph/strengthened-shs-program/`
- Strengthened SHS learning-resource portal: `https://sites.google.com/deped.gov.ph/deped-lrportal/senior-high-school/strengthened-shs-program-you-are-herecurrentstrengthened-shs-program`

`data/curriculum/sources/official-source-register.json` pins each source file's official URL, landing page, Drive file ID where applicable, file name, edition, page count, byte size, retrieval date, and SHA-256 digest. Source PDFs are not committed. `npm run curriculum:verify:sources -- <source-root>` compares a reviewed local source set with all pinned byte sizes and hashes.

## Manifest and extraction guarantees

Every `data/curriculum/official/*.json` file uses schema version 2 and contains:

- deterministic manifest, domain, period, and competency ordering;
- stable competency record IDs;
- curriculum version and school-year applicability;
- exact source identity and file digest;
- source page provenance for every period, competency, and extracted performance standard;
- verification status for every competency; and
- a SHA-256 digest of the deployable competency payload.

The Python builder reads table structure and explicit grade/quarter/theme/term markers. It normalizes whitespace and repairs only visually verified PDF extraction artifacts, including duplicated text layers, letter-spaced embedded-font output, and malformed fraction/superscript glyph mappings in the mathematics PDF. It does not invent or paraphrase missing competency text.

Grade 12 source documents explicitly cover one term. They remain one-term manifests; no quarter or school-grading-term mapping is inferred. K to 10 quarters, Kindergarten themes, and Grade 11 quarters likewise remain curriculum-source periods separate from GuroDesk's grading calendar and pacing layers.

## Recorded source inconsistency

The Filipino guide's published summary table disagrees with the detailed source rows for these quarter totals:

| Grade | Detailed rows retained | Published summary |
| --- | --- | --- |
| 2 | 24, 24, 23, 24 | 24, 24, 23, 23 |
| 3 | 21, 21, 21, 21 | 21, 21, 21, 22 |
| 5 | 20, 20, 21, 21 | 20, 20, 20, 20 |
| 6 | 19, 19, 19, 18 | 19, 19, 19, 19 |
| 7 | 7, 7, 7, 5 | 7, 7, 7, 7 |

The detailed table is the competency-level source of truth. Each affected manifest records both sets under `verification.sourceConsistency`; GuroDesk does not fabricate, discard, or duplicate rows to force agreement with the summary.

## SQL deployment behavior

`supabase/seeds/official-curriculum-complete.sql` is generated from all 196 manifests and carries their aggregate payload hash. It has exactly one transaction and 6,181 stable update/insert pairs. It:

- upserts source, curriculum-version, applicability, subject, period, and domain identities;
- preserves the original Grade 7 Mathematics database identities created by migration 003;
- updates competencies by curriculum subject, source document, source period, and stable sort position;
- inserts missing competencies;
- removes stale competency and domain rows only within the imported official pack scope; and
- never deletes source-document, curriculum-version, or curriculum-subject identities.

No database migration is added; the migration count remains 26. Apply all migrations before this seed. Import it on staging first and rerun it to prove idempotency before production use.

## Files of note

- `data/curriculum/official/*.json`
- `data/curriculum/sources/catalog-snapshot.json`
- `data/curriculum/sources/official-source-register.json`
- `data/curriculum/sources/official-pack-index.json`
- `scripts/curriculum/build_official_manifests.py`
- `scripts/curriculum/export-official-catalog.mjs`
- `scripts/validate-curriculum.mjs`
- `scripts/validate-official-curriculum-coverage.mjs`
- `scripts/verify-official-curriculum-sources.mjs`
- `scripts/generate-curriculum-sql.mjs`
- `scripts/generate-official-curriculum-bundle.mjs`
- `scripts/check-official-curriculum-bundle.mjs`
- `supabase/seeds/official-curriculum-complete.sql`

The former one-off `data/curriculum/matatag-grade7-mathematics.json` and matching standalone seed are superseded by the complete official pack. The aggregate seed includes an explicit compatibility path for existing Grade 7 Mathematics rows.

## Verification result

The curriculum-specific gates passed on 2026-08-11:

- 196 manifest schemas and 6,181 record/payload integrity checks;
- complete 189 catalog → 196 manifest → 129 source → 6,181 competency coverage;
- all 129 source PDF byte-size and SHA-256 checks;
- extraction-artifact scan across all 6,181 competency texts; and
- one-transaction SQL bundle check with 6,181 stable upserts.

The CI-equivalent `npm run test:ci` command passed all three TypeScript checks, 35 validator commands, 229 unit tests across 22 files, and the production Vite build with 2,048 modules transformed. The only build diagnostic was the pre-existing non-fatal large-chunk advisory.

Docker and `psql` are unavailable in this workspace, so disposable Supabase fresh/upgrade migration execution, authenticated integration tests, seed idempotency against PostgreSQL, and Chromium E2E execution remain CI/staging-owned and must not be reported as locally passed.

## Deployment order

1. Deploy or merge this exact source checkpoint.
2. Apply existing migrations 001–026; there is no migration 027 in this change.
3. Import `supabase/seeds/official-curriculum-complete.sql` with stop-on-error enabled.
4. Rerun the seed on staging to confirm idempotency.
5. Deploy the frontend from the same commit. Phase B changes no Edge Function.
6. Smoke-test Curriculum Navigator, assignment curriculum selection, competency selection, lesson/TOS creation, and the Phase A assessment/export flow.
