# Phase 6 phone-first merge instructions

Use `gurodesk-phase6-national-curriculum.zip` as a complete root-level replacement project in AI Studio.

1. Upload/extract the ZIP at the existing GuroDesk project root.
2. Do not ask AI Studio to rewrite or simplify the supplied implementation.
3. Push the resulting project to `Juvialski/Gurodesk` `main`.
4. Let the existing GitHub Actions release workflow run.
5. Require both jobs to be green before treating the deployment as accepted.
6. Let the existing Supabase GitHub integration and Render Static Site deployment follow `main` as already configured.

No Phase 6 database migration is expected.

After deployment, smoke-test:

- My Classes: switch among elementary, JHS, Grade 11, and Grade 12 and verify grade-aware learning-area groups.
- Curriculum: browse/search the national catalog and open official source links.
- Grade 7 Mathematics: verify the existing 52-competency navigator still loads and can feed TOS/assessment flows.
- A catalog-only subject such as Grade 9 Science: verify GuroDesk clearly reports that the official curriculum family is catalogued but does not invent competencies when a verified pack is absent.
- Grade 12: verify pilot/new-guide and non-pilot legacy transition choices remain visibly distinct.

If GitHub CI fails, use the first failing job/step as the source of truth and do not bypass or weaken the release gate.
