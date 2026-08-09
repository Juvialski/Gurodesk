# GuroDesk production smoke test

Run this short checklist on an Android phone after the automated CI workflow is green. Use teacher-owned smoke-test data and remove it afterward.

## Environment and auth

- [ ] Open the deployed Render URL, sign in, refresh, sign out, and sign in again.
- [ ] Confirm Supabase verification/reset redirects return to the deployed app without a blank page.
- [ ] Refresh one nested assessment route and one nested results route; both must remain in the SPA.

## One real BYOK check

- [ ] Connect the teacher's own Gemini key in Settings and run one low-risk assessment suggestion.
- [ ] Confirm the suggestion is editable, the saved draft survives refresh, and no learner identity is sent.
- [ ] Remove or rotate the smoke-test key if it was created only for acceptance.

## Critical production round trip

- [ ] Create/finalize one TOS, create an assessment from it, edit one item, save, refresh, and reopen it from All Assessments.
- [ ] Create a small roster/result session, record objective and partial-credit points, and confirm the displayed total equals earned-point sum.
- [ ] Open analysis/remediation and confirm the point denominators match the saved assessment snapshot.

## Physical output and mobile behavior

- [ ] Download one student assessment and one results export; inspect pagination, Unicode/Filipino text, and absence of internal/AI metadata.
- [ ] Confirm the assessment navigator, learner picker, Save controls, and downloads work without horizontal overflow.

Do not repeat migration, RLS, PostgREST, malformed-response, 429, or deep-route matrix testing manually; those belong to the automated Phase 5.5 harness.
