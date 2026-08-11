# Official curriculum data

GuroDesk ships 196 verified, source-pinned curriculum manifests covering all 189 current entries in the national catalog:

| Family | Catalog entries | Manifests | Source PDFs | Competencies |
| --- | ---: | ---: | ---: | ---: |
| Revised K to 10 / MATATAG | 73 | 80 | 13 | 4,277 |
| Strengthened SHS Grade 11 | 94 | 94 | 94 | 1,552 |
| Strengthened SHS Grade 12 | 22 | 22 | 22 | 352 |
| **Total** | **189** | **196** | **129** | **6,181** |

The seven extra K to 10 manifests are intentional: each Grade 4–10 MAPEH catalog entry maps to separate official Music and Arts and Physical Education and Health guides.

## Layout and trust boundary

- `official/*.json` contains schema-version-2 deployable manifests. Every competency has stable record identity, source sequence, source page, verification status, and a manifest-level payload hash.
- `sources/catalog-snapshot.json` is the deterministic snapshot of `src/data/curriculumCatalog.ts` used to prove catalog coverage.
- `sources/official-source-register.json` pins source URL, official landing page, Drive file ID where applicable, file name, edition, page count, byte size, retrieval date, and SHA-256 digest for all 129 PDFs.
- `sources/official-pack-index.json` records the catalog-to-manifest-to-source mapping.

Source PDFs are deliberately not committed. A manifest is executable only after its source bytes and structured payload pass the validators. Never create, complete, translate, or paraphrase official competency text from model memory.

## Rebuild and verify

The extractor requires Python 3.11+ and `pdfplumber`. With the reviewed source PDFs and acquisition indexes available locally:

```bash
npm run curriculum:catalog:snapshot
python scripts/curriculum/build_official_manifests.py \
  --source-root /path/to/official-curriculum \
  --k10-metadata /path/to/matatag-files.json \
  --sshs-index /path/to/sshs-files.tsv \
  --write
npm run curriculum:validate
npm run curriculum:verify:sources -- /path/to/official-curriculum
npm run curriculum:generate:bundle
npm run curriculum:check:bundle
```

The generated deployment artifact is `supabase/seeds/official-curriculum-complete.sql`. It is one idempotent transaction: identities are upserted, existing competency rows are updated by subject/source/period/sort position, missing rows are inserted, and stale rows for the same source pack are removed. The aggregate manifest hash embedded in the bundle prevents a stale seed from passing validation.

## Source-faithful period handling

- Official K to 10 guide quarters and Kindergarten themes remain source periods. They are not rewritten to match a school calendar.
- Grade 11 source quarter labels remain quarters.
- Grade 12 guides explicitly describe one term; GuroDesk stores one term and does not infer quarter or grading-term mappings.
- School-year grading periods and instructional pacing remain separate database layers.

The Filipino guide's published count summary conflicts with its detailed competency tables for Grades 2, 3, 5, 6, and 7. The detailed source rows are retained. Each affected manifest records the published and extracted counts under `verification.sourceConsistency`; no total is silently forced to agree.

## Deployment

No schema migration is required for this pack. Apply all existing migrations first, then import the generated seed before teachers begin referencing the official competency IDs:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/seeds/official-curriculum-complete.sql
```

Run the seed on staging first, rerun it once to confirm idempotency, then execute the curriculum navigator and competency-selection smoke checks.
