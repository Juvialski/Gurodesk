# Validation — Phase 2

## Curriculum manifest

Run:

```bash
npm run curriculum:validate
```

Expected Grade 7 Mathematics result:

```text
52 verified competencies, 4 periods, 3 domains
```

The validator checks, among other things:

- manifest is explicitly verified
- source is an HTTPS `deped.gov.ph` URL
- curriculum version exists
- periods are valid and unique
- domains referenced by competencies exist
- every competency has a source page
- competency ordering is contiguous within each period
- duplicate competency rows are rejected
- applicability data is present

## Deterministic SQL generation

Run:

```bash
npm run curriculum:generate:g7math
```

Then compare the generated seed with `supabase/migrations/202608080003_seed_g7_mathematics.sql` before changing the migration. Generated SQL should come from the reviewed manifest, never from manual edits to a production seed.

## Security checks

Review that:

- curriculum-applicability and calendar tables have RLS enabled
- normal authenticated users only receive SELECT policies on official knowledge
- curriculum child records remain hidden when their parent curriculum version is draft
- competency reads require `verification_status = verified`
- teacher-owned data remains scoped by `(select auth.uid())`
- browser environment variables contain no Gemini secret or Supabase service-role key

## UI checks

In demo mode:

1. open the Grade 7 Mathematics assignment
2. verify 52 competencies
3. verify four curriculum-quarter tabs
4. verify Term 1 / Term 2 / Term 3 appears only as school-calendar context
5. search a competency and clear the search
6. switch quarters
7. open the official source link
8. switch to Grade 8 Mathematics and confirm the app shows unavailable coverage instead of invented records
9. repeat at a phone viewport

## Build-environment note

The packaging sandbox uses a private npm mirror that currently returns 404 for `@supabase/supabase-js`. Because dependency installation fails before compilation, final `npm install && npm run build` must also be run in AI Studio or a normal public-npm environment. This is an environment limitation, not a reason to remove Supabase from the project.
