# Phase 4 integration notes

> Historical integration checkpoint: Phases 4.1–4.3 now build on this TOS foundation. Follow `CODEX_HANDOVER.md` and the Phase 4.1–4.3 documents for the current release boundary.

Phase 4 is wired into the existing application without replacing the Phase 2 curriculum resolver, Phase 3 lesson workflow, Phase 3.6 exports, or Phase 3.7 DOCX template engine.

- `/tos`, `/tos/new`, `/tos/:id`, and `/tos/:id/print` are live routes.
- Settings manages DOCX lesson templates and XLSX TOS templates independently.
- `tos-template-analyzer` requires an authenticated JWT and the existing server-side BYOK secrets.
- `npm run validate:phase4` is additive; every earlier validation command remains required.
- At this historical Phase 4 checkpoint, the assessment route was a future-phase placeholder. It is live in the current Phase 4.3 release.
