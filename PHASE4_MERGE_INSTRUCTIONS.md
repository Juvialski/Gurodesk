# Phase 4 merge instructions

> Historical Phase 4-only merge note. For the complete current project, use the delivered root-level Phase 4.3 ZIP and follow `CODEX_HANDOVER.md`.

This package is a complete GuroDesk project rooted at the ZIP top level. It is based on the Phase 3.7 source and preserves all existing curriculum, ILAW, BYOK, multilingual, export, DOCX-template, migration, and validation work.

1. Back up the current project.
2. Replace the project with the contents of the Phase 4 ZIP; do not place the ZIP's contents inside another `gurodesk-*` folder.
3. Run `npm install` and `npm run build`.
4. Run all validation commands listed in `docs/PHASE_4_TOS_BUILDER.md`.
5. Apply Supabase migration `202608080012_phase4_tos_builder.sql` after migrations `001` through `011`.
6. Deploy the authenticated `tos-template-analyzer` Edge Function with the same BYOK encryption/service-role secrets already used by the existing functions.
7. Keep the `document-templates` Storage bucket private.

Do not replace this project with an older GitHub checkout after merging. Do not implement assessment-question/test generation as part of this merge.
