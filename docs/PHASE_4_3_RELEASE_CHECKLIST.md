# Phase 4.3 release checklist

## Database and functions

- Apply migrations `001` through `014` in order (`013` and `014` are the new assessment migrations for an existing Phase 4 database).
- Deploy `assessment-question-generator` with JWT verification enabled and the same server-only BYOK secrets as the existing authenticated functions.
- Confirm the Gemini credential tables still have no browser CRUD policies.
- Confirm assessment source, item, version, and AI-audit RLS prevents cross-teacher access.
- Confirm a draft TOS, another teacher's TOS, or a mismatched assignment cannot create an assessment.
- Confirm final assessments are immutable except for archiving/duplication.

## Automated validation

Run:

```bash
npm install
npm run curriculum:validate
npm run validate:phase2
npm run validate:phase3
npm run validate:byok
npm run validate:phase35
npm run validate:phase351
npm run validate:phase352
npm run validate:phase353
npm run validate:phase36
npm run validate:phase361
npm run validate:phase362
npm run validate:phase363
npm run validate:phase37
npm run validate:phase4
npm run validate:phase41
npm run validate:phase42
npm run validate:phase43
npm run typecheck
npm run build
```

Do not weaken an older validator to hide a regression. A superseded Phase 4 placeholder assertion may be replaced only by a stronger check that TOS arithmetic/mapping remains AI-free while the separately authorized assessment routes are present.

## Phone acceptance

- On an Android-size viewport, create an assessment only from a finalized TOS.
- Verify the navigator covers every number, direct navigation works, and Prev/Next remain synchronized.
- Change each supported question type and verify its answer editor/validation.
- Save, reopen, edit, duplicate, finalize, and archive.
- Verify final content is read-only and duplication creates a new draft without changing the fixed mapping.
- Generate one item, an alternative, and missing items; verify explicit acceptance, progress, cancellation, partial-success preservation, and no overwrite of accepted/manual content.
- Verify Filipino and configured language preferences reach generation while existing authored text is not unexpectedly translated.

## Export acceptance

- Print/download Student, Teacher, and Answer Key copies as PDF and DOCX.
- Confirm Student Copy contains no answers, competency/cognitive labels, AI metadata, IDs, technical provenance, or GuroDesk branding.
- Confirm Answer Key exactly matches stored structured answers without an AI request.
- Use very long prompts, choices, rationales, competency text, and notes; verify no clipping, overlap, omission, or disappearing page content.
- Confirm authored Filipino/multilingual questions remain unchanged and only configured headings/labels vary.

## Stop boundary

Confirm no screen, table, Edge Function, or export implements learner scores, grading calculations, difficulty/discrimination statistics, distractor analysis, mastery analytics, learner-level recommendations, or remediation derived from results.
