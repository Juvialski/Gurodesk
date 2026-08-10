# Phase 6 — National curriculum coverage

Phase 6 separates **catalog coverage** from **verified competency coverage**.

`src/data/curriculumCatalog.ts` is the school-year-aware catalog used by onboarding, My Classes, and Curriculum Navigator. It can identify an official or transitional curriculum offering without claiming that GuroDesk has transcribed every competency from that source.

Only detailed manifests that pass the existing source/provenance validator may drive competency-grounded lesson plans, TOS records, and assessments. The bundled Grade 7 Mathematics manifest remains the currently verified detailed pack. Catalog-only subjects remain visible but unavailable for competency-grounded workflows until a reviewed pack is imported.

The resolver supports multiple applicable curriculum versions for a grade/year so full, pilot, transitional, and legacy records can coexist without globally taking the first applicability row.

Verified manifest pipeline:

```bash
npm run curriculum:validate
npm run curriculum:generate:all
```

The batch generator ignores any curriculum JSON that is not explicitly marked verified.
