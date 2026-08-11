# Phase 6 — National curriculum coverage

As of 2026-08-11, GuroDesk's current national catalog and verified competency coverage are complete for the reviewed official source set.

`src/data/curriculumCatalog.ts` contains 189 school-year-aware current offerings. `data/curriculum/official/` contains 196 source-pinned manifests with 6,181 competencies from 129 official PDFs. The manifest count is higher because every Grade 4–10 MAPEH catalog entry is backed by separate Music and Arts and Physical Education and Health source packs.

| Program | Current catalog entries | Verified manifests | Competencies |
| --- | ---: | ---: | ---: |
| Revised K to 10 / MATATAG | 73 | 80 | 4,277 |
| Strengthened SHS Grade 11 | 94 | 94 | 1,552 |
| Strengthened SHS Grade 12 | 22 | 22 | 352 |
| **Total** | **189** | **196** | **6,181** |

Catalog availability and detailed competency verification remain separate concepts in the architecture. A future catalog entry must not become available to competency-grounded lesson plans, TOS records, or assessments until its detailed manifest passes source, schema, coverage, and payload-integrity checks.

The resolver continues to support multiple applicable curriculum versions for a grade and school year so full, pilot, transitional, and legacy records can coexist. Curriculum source quarters/themes/terms are retained exactly as source periods; school grading calendars and pacing mappings remain independent.

## Verification pipeline

```bash
npm run curriculum:validate
npm run curriculum:verify:sources -- /path/to/official-curriculum
npm run curriculum:generate:bundle
npm run curriculum:check:bundle
```

The source register is `data/curriculum/sources/official-source-register.json`. The complete transactional deployment seed is `supabase/seeds/official-curriculum-complete.sql`.

Do not synthesize, paraphrase, translate, or infer official competencies. New or revised source packs must be rebuilt from reviewed source bytes and must preserve page-level provenance.
