# Phase 5.4 phone-friendly merge instructions

1. Download the complete Phase 5.4 ZIP supplied with the handoff.
2. Open `Juvialski/Gurodesk` in GitHub Mobile or the GitHub mobile website.
3. Put the ZIP contents directly at the repository root. Do not create a wrapper folder and do not upload `node_modules` or `dist`.
4. Confirm the root contains `package.json`, `package-lock.json`, `src`, `supabase`, `scripts`, `docs`, `render.yaml`, and this handover.
5. Review the changed files in `PHASE44_IMPLEMENTATION_MANIFEST.md` and `PHASE54_IMPLEMENTATION_MANIFEST.md` without replacing them with older GitHub Phase 5.3 copies.
6. Commit/merge to `main` only after the CI validation and staging checks pass.
7. Apply Supabase migrations in filename order through `202608090019_phase54_results_compatibility.sql`; never paste migration `019` ahead of `017`/`018`.
8. Deploy all authenticated functions in `supabase/config.toml`.
9. Configure Render and Supabase Auth using `docs/PRODUCTION_DEPLOYMENT.md`.
10. Complete `docs/PRODUCTION_SMOKE_TEST.md` on an Android phone before production sign-off.

GitHub connector writes previously returned HTTP 403, so this ZIP is the complete merge artifact. These steps require no VS Code, SSH, terminal, or local Git configuration on the teacher’s phone.

