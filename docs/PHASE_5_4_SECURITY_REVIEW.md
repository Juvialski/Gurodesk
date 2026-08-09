# Phase 5.4 security and privacy review

## Static findings

- Browser configuration is limited to `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No service-role key, database password, Gemini key, encryption key, or privileged token belongs in `VITE_*` variables.
- Migrations 001–016 use owner-scoped RLS for teacher data. Result tables 015 and remediation tables 016 use owner columns, composite foreign keys, and authenticated select policies; browser writes go through security-definer RPCs. Migrations 017–018 extend the assessment enum/scoring contracts, and 019 keeps the result owner/RLS paths while adding bounded typed-answer, immutable-reference, and deterministic scoring guards.
- Security-definer result/remediation/assessment functions set `search_path = ''` and derive ownership from `auth.uid()`. Result participant/outcome child paths include owner/session foreign-key checks.
- Phase 4.4 enum and assessment scoring migrations are separated before this migration so PostgreSQL does not parse a function against an uncommitted enum value.
- Result answer payloads are bounded typed JSON objects. Deterministic numeric, fill, matching, and all-or-nothing multiple-select scoring never executes generated JavaScript or `eval`.
- Student-facing exports omit learner IDs, competency IDs, cognitive labels, AI provenance, verification state, request counters, and internal IDs. Teacher reports include points and partial-credit values from stored structured outcomes.
- `remediationAi.ts` constructs an allow-listed aggregate request. It does not accept or spread a result session, answer sheet, learner name, or per-learner history.
- The private `document-templates` Storage bucket scopes select/upload/update/delete to the authenticated teacher's UUID folder; no learner/result file bucket or public result URL is introduced.

## Static checks still required in staging

- Run adversarial RLS tests with two authenticated teacher accounts. Verify that Teacher A cannot select or mutate Teacher B's profiles, assignments, lesson/TOS/assessment documents, assessment AI audits, templates, rosters, learners, result sessions, outcomes, analyses, or remediation plans.
- Verify every deployed security-definer function and trigger on the live schema has the expected owner checks, `search_path = ''`, and no accidental `PUBLIC` execute grant. Confirm Storage buckets and object policies separately; static SQL cannot prove dashboard bucket configuration.
- Test Auth redirect allow-lists, Edge Function JWT enforcement, BYOK encryption/key lifecycle, rate-limit behavior, and provider error handling in a staging project.
- Run the repository secret scan against commit history and deployment logs. A publishable Supabase key is expected; any service-role key, `AIza` Gemini key, database URL/password, JWT access token, or encryption secret is a release blocker.
- Inspect network requests while using remediation AI and result exports to confirm learner names and raw answers never leave the browser except where an explicitly authorized teacher workflow requires them.

## Accepted compatibility assumptions

- Existing result snapshots with `pointsPossible` absent use the legacy `points` value, then a one-point default. The application derives total possible points from item rows and rejects mismatched snapshots before final save.
- Migration 019 is additive and depends on the Phase 4.4 enum/scoring migrations. It does not rewrite migrations 015/016 or alter historical rows.
