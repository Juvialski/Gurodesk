# Phase 6 universal curriculum — phone-first merge instructions

Use the supplied full root-level ZIP as the complete current GuroDesk project.

1. Replace the AI Studio project contents with the ZIP contents exactly.
2. Do not ask AI Studio to rewrite, simplify, or regenerate the implementation.
3. Push to `Juvialski/Gurodesk` `main`.
4. Allow the existing GitHub Actions release workflow to run migrations 001–025 against its disposable local Supabase stack.
5. Require both the static/unit/build job and the local-Supabase integration/E2E job to be green before accepting deployment.
6. Let the configured Supabase/Render integrations deploy only after the green release gate.

After deployment smoke-test:
- Confirm the previously failing `assessment-flow.spec.ts` Chromium E2E now passes with multiple finalized TOS cards present.
- Generate one complex assessment question rather than a batch first and confirm the existing BYOK model selection still works.
- Curriculum → create one manual private curriculum, add one competency, approve it, and attach it to a class.
- Reopen Curriculum Navigator and confirm the private competency appears.
- Create/save a lesson plan and TOS from that private assignment.
- Create a hybrid from a verified official assignment and confirm inherited + school-enrichment competencies are visible without changing the official base.

If CI fails, use the first failing GitHub step/artifact as source of truth. Local validation details are in `PHASE6_UNIVERSAL_VALIDATION_REPORT.txt`. Do not weaken RLS, migration, or E2E assertions to force a green run.
