# Phase 6 — National curriculum coverage

As of 2026-08-13, GuroDesk's current national catalog and verified competency coverage are complete for the reviewed official source set. Exact-source content and performance standards are complete for 175 of the 196 manifests.

`src/data/curriculumCatalog.ts` contains 189 school-year-aware current offerings. `data/curriculum/official/` contains 196 source-pinned manifests with 6,181 competencies and 2,838 content/performance standards from 129 official PDFs. The manifest count is higher because every Grade 4–10 MAPEH catalog entry is backed by separate Music and Arts and Physical Education and Health source packs.

| Program | Current catalog entries | Verified manifests | Competencies | Exact-source standards | Standards-complete manifests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Revised K to 10 / MATATAG | 73 | 80 | 4,277 | 1,950 | 59 |
| Strengthened SHS Grade 11 | 94 | 94 | 1,552 | 717 | 94 |
| Strengthened SHS Grade 12 | 22 | 22 | 352 | 171 | 22 |
| **Total** | **189** | **196** | **6,181** | **2,838** | **175** |

The remaining 21 standards manifests are Grade 4–10 Araling Panlipunan, Music and Arts, and Physical Education and Health (seven grades for each registered PDF). The public files currently obtainable for those three guides do not match the byte sizes and SHA-256 hashes already pinned in the official source register; the registered SharePoint downloads also reject access. Those manifests intentionally retain their verified competencies without invented or substituted standards until the exact registered bytes can be recovered and reviewed.

Catalog availability and detailed competency verification remain separate concepts in the architecture. A future catalog entry must not become available to competency-grounded lesson plans, TOS records, or assessments until its detailed manifest passes source, schema, coverage, and payload-integrity checks.

The resolver continues to support multiple applicable curriculum versions for a grade and school year so full, pilot, transitional, and legacy records can coexist. Curriculum source quarters/themes/terms are retained exactly as source periods; school grading calendars and pacing mappings remain independent.

## Verification pipeline

```bash
npm run curriculum:validate
npm run curriculum:verify:sources -- /path/to/official-curriculum
npm run curriculum:generate:standards-migration
npm run curriculum:check:standards-migration
npm run curriculum:generate:bundle
npm run curriculum:check:bundle
```

The source register is `data/curriculum/sources/official-source-register.json`. Exact standards transcriptions are retained as reviewable sidecars in `data/curriculum/sources/verified-standards/`. The additive deployment migration is `supabase/migrations/202608130038_verified_curriculum_standards_expansion.sql`; it inserts standards only and does not rewrite competencies or historical TOS/assessment snapshots. The complete transactional deployment seed is `supabase/seeds/official-curriculum-complete.sql`.

Do not synthesize, paraphrase, translate, or infer official competencies. New or revised source packs must be rebuilt from reviewed source bytes and must preserve page-level provenance.
