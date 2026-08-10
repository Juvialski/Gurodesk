# Verified curriculum manifests

This directory contains **competency-level curriculum manifests only**.

A file belongs here only when:

1. the source is an official `deped.gov.ph` document;
2. competency text and source-page provenance have been reviewed;
3. `verification.status` is `verified`;
4. `npm run curriculum:validate` passes.

The broader national offering catalog lives in `src/data/curriculumCatalog.ts`. Cataloguing an official guide is not the same as transcribing it into this directory.

Never create a manifest from model memory or an unofficial curriculum summary.
