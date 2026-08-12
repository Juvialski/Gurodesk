# GuroDesk production deployment (phone-friendly)

This checklist is written for a phone-only handoff.  It does not require VS Code, SSH, a local Git setup, or a terminal on the teacher's phone.

## 1. Upload or merge the final project

1. Download the complete GuroDesk ZIP from the handoff.
2. In GitHub's mobile web or GitHub Mobile, open `Juvialski/Gurodesk`.
3. Upload the ZIP contents at the repository root, or merge the prepared branch/PR.  Confirm that `package.json`, `src/`, `supabase/`, `render.yaml`, `public/_redirects`, and `docs/` are at the root rather than inside a nested wrapper folder.
4. Commit to `main` only after the review checklist and validation artifact pass.

## 2. Apply Supabase database changes

1. In Supabase Dashboard, open the project's database migration/deploy workflow connected to the GitHub `main` branch.
2. Confirm migrations are present, now ending with the automated `202608120030_seed_official_curriculum.sql`.
3. Review the generated migration preview. These migrations are additive/corrective; do not edit already-applied migrations in place.
4. Apply to your linked Supabase database. The new `202608120030_seed_official_curriculum.sql` migration automatically imports the complete national curriculum of 6,181 verified competencies (including Grade 7 Science, English, etc.) directly into your database.

## 3. Official curriculum pack automation

1. The complete 17 MB official curriculum seed (`supabase/seeds/official-curriculum-complete.sql`) is now bundled as an automated database migration. This ensures it deploys automatically and runs exactly once on remote databases without manual SQL paste or CLI commands.
2. The generated upserts are intentionally idempotent and can be re-run safely if needed.
3. Smoke-test Curriculum Navigator, official curriculum selection, and competency selection once migrations complete.
4. Do not hand-edit the 17 MB seed. Update the verified manifests and run `npm run curriculum:generate:bundle` if a reviewed source pack changes.

## 4. Deploy Edge Functions

1. Confirm every function listed in `supabase/config.toml` is enabled, including `assessment-question-generator`, `remediation-suggester`, and the Gemini/BYOK functions.
2. Use the Supabase GitHub integration to deploy the function source from `main`, or use the Dashboard's function deployment control.
3. Confirm each function requires an authenticated session.  Do not add a service-role key or Gemini key to browser environment variables.

## 5. Configure Render Static Site

1. In Render, choose **New → Static Site** and connect `Juvialski/Gurodesk`.
2. Select the `main` branch and enable automatic deploys after review.
3. Use:
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
4. Add the SPA rewrite `/*` → `/index.html` with action **Rewrite**.  `render.yaml` and `public/_redirects` are included as deploy-safe artifacts; verify the active Render service has the rewrite in its dashboard/Blueprint settings.
5. Save and deploy.  Render's static-site and rewrite references: [Static Sites](https://render.com/docs/static-sites) and [Redirects and Rewrites](https://render.com/docs/redirects-rewrites).

## 6. Add browser-safe environment variables

Set only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

These values identify the public Supabase client. Never set `VITE_SUPABASE_SERVICE_ROLE`, a database password, a Gemini API key, an encryption key, or a privileged token. Teachers enter their own Gemini key in GuroDesk Settings; the key is sent only to the authenticated Edge Function path.

## 7. Configure Supabase Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:

1. Set **Site URL** to the HTTPS Render production URL.
2. Add the exact production origin and the exact callback routes used by the app to **Redirect URLs**.
3. Configure signup verification and password-reset/update-password redirects for the production origin. A `redirectTo` value must exactly match an allowed Redirect URL; do not leave localhost-only entries as the only production option.
4. Keep localhost redirect URLs only for a separately controlled development project.

See Supabase's [redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

## 8. Deploy and verify

1. Open the Render URL in an Android browser.
2. Run the smoke test in `docs/PRODUCTION_SMOKE_TEST.md`.
3. Test a nested-route refresh such as `/results/<id>/analysis` and `/assessments/<id>`; both must return the application rather than a Render 404.
4. Test a slow connection and a provider 429 in staging. Confirm saved questions/results remain available and no blank page replaces the workflow.
5. Record the deployment commit, migration status, function status, and smoke-test date in the release record.

The Supabase [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration) can apply new migrations and deploy functions from `main` when production deployment is enabled. Auth URL settings remain Dashboard configuration and must be checked separately.
