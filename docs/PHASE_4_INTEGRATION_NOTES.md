# Phase 4 integration notes

Phase 4 is wired into the existing application without replacing the Phase 2 curriculum resolver, Phase 3 lesson workflow, Phase 3.6 exports, or Phase 3.7 DOCX template engine.

- `/tos`, `/tos/new`, `/tos/:id`, and `/tos/:id/print` are live routes.
- Settings manages DOCX lesson templates and XLSX TOS templates independently.
- `tos-template-analyzer` requires an authenticated JWT and the existing server-side BYOK secrets.
- `npm run validate:phase4` is additive; every earlier validation command remains required.
- The assessment route remains an explicit future-phase placeholder.
