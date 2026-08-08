# GuroDesk 0.5.0 implementation manifest

- Authoritative base: uploaded Phase 3.7 full-project ZIP, confirmed identical to GitHub main at `9c882baea7948b4d6138daae91b6d5407464d21e` before implementation.
- Scope delivered: verified curriculum to TOS only.
- Migration: `supabase/migrations/202608080012_phase4_tos_builder.sql`.
- Validation: `npm run validate:phase4` includes real XLSX round-trip verification; every retained Phase 2–3.7 validator and production build remain required.
- Assessment questions, test papers, answer keys, results, item analysis, and remediation are not implemented.

See `docs/PHASE_4_TOS_BUILDER.md` for architecture, invariants, export behavior, and explicit XLSX limitations.
