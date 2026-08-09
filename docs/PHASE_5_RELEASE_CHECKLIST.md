# Phase 5.0–5.3 release checklist

Use this checklist from a phone through AI Studio and then against a staging Supabase project. It supplements `docs/VALIDATION.md`; it does not replace the earlier Phase 1–4.3 validators.

## Local release gate

- [ ] `npm install` completes with the checked-in lockfile.
- [ ] All existing curriculum, Phase 2, Phase 3, Phase 3.5–3.7, and Phase 4.0–4.3 validators pass unchanged.
- [ ] `npm run validate:phase50` passes roster, result-session, snapshot, privacy, and ownership checks.
- [ ] `npm run validate:phase51` passes all encoding, scoring, omitted/partial-point, import-preview, and batch-persistence checks.
- [ ] `npm run validate:phase52` passes deterministic item, option, facility, item-rest, competency, cognitive, curriculum-period, class, and learner analysis checks.
- [ ] `npm run validate:phase53` passes remediation, privacy, pagination, report-mode, and seven-sheet workbook checks.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes without treating a non-fatal chunk advisory as a failure.
- [ ] No browser bundle or committed file contains a Gemini key, service-role key, encrypted credential material, or private key.

## Static privacy and security review

- [ ] Learner records require only an internal UUID, teacher owner, assignment/section, display name, optional local reference, and active state.
- [ ] No LRN, birth date, home address, phone/email, guardian, health/disability, socioeconomic, password, or unrelated field is mandatory.
- [ ] Learner/result/remediation/template tables use strict teacher-owned RLS.
- [ ] Security-definer functions derive ownership from `auth.uid()`, verify all related assignment/assessment/result owners, use safe `search_path`, and do not trust client owner IDs.
- [ ] Teacher A cannot read, mutate, reference, or export Teacher B's learners, responses, scores, assessments, result sessions, remediation plans, or templates.
- [ ] No learner name, learner UUID, local learner reference, complete answer sheet, or individual raw response history is passed to Gemini.
- [ ] Optional remediation context contains only verified/aggregate competency evidence and allowlisted teacher constraints; suggestions require teacher review/edit/accept.

## Staging database and Edge Functions

- [ ] Apply migrations `202608080015_phase50_results_foundation.sql` and `202608080016_phase53_remediation.sql` after the existing `001`–`014` sequence.
- [ ] Deploy `remediation-suggester` with authenticated JWT verification and existing server-only BYOK/credential-encryption configuration.
- [ ] Run cross-teacher RLS smoke tests for roster, result session, outcomes, remediation, and exports/templates.
- [ ] Confirm foreign keys, owner-scoped indexes, bounded transactional batch replacement, and no per-answer network write loop.
- [ ] Confirm draft delete behavior removes safe dependents and finalized learner history is archived/deactivated rather than orphaned.
- [ ] Confirm the school/division's approved privacy notice, access, retention, archival, and deletion policy is available; GuroDesk does not invent a statutory period.

## Phone acceptance at approximately 360–430px

### Roster and session setup

- [ ] Add, rename, deactivate/reactivate, and safely remove a learner.
- [ ] Preview a CSV/XLSX import, map name/reference columns, reject empty rows, surface duplicates, correct, and confirm; never upload the workbook to Gemini.
- [ ] Start a result session only from a finalized assessment owned by the current teacher and assignment/section.
- [ ] Verify assessment title, administration date, item count, possible points, section, original item numbers, verified competency, cognitive category, and curriculum period remain visible/traceable.

### Encoding and analysis

- [ ] Use answer-sheet mode with large mobile answer targets and Next learner navigation.
- [ ] Use item mode with direct item navigation and class response entry.
- [ ] Use score-only mode and confirm the explicit “no full item analysis” state.
- [ ] Test MCQ, True/False, conservative short-answer exact/normalized matching, constructed-response teacher points/feedback, partial points, omitted answers, and a class-sized 40 × 50 draft.
- [ ] Close/reopen the draft and verify responses are retained without one request per answer.
- [ ] Verify raw totals, possible totals, percentages, missing responses, average, median, high, low, distribution, missed items, competency, cognitive, and curriculum-period summaries.
- [ ] Test fewer than 10 usable observations and zero-variance item/rest scores; confirm explicit insufficient-data states, not fake precision.
- [ ] Confirm no public rank list, diagnosis, ability label, or learner-shaming language appears.

### Remediation

- [ ] Generate neutral signals with a teacher-selected threshold and comparison basis.
- [ ] Select whole-class or specific participant scope only within the current teacher-owned session.
- [ ] Toggle target competencies without accidental select-all/deselect-all behavior.
- [ ] Edit activity, target, schedule/date, follow-up evidence/check, notes, threshold, scope, and teacher override.
- [ ] Save/reload the plan; archive or delete only a permitted draft/status.
- [ ] Request optional Gemini suggestions only after reviewing the privacy disclosure; confirm no identity/raw answers are included, and verify suggestions are never auto-applied.

## Reports and output QA

- [ ] Open all four modes: Assessment Results Summary, Item Analysis, Competency Performance, Remediation Plan.
- [ ] Print and inspect long tables at phone and desktop widths; verify page breaks preserve headers and rows.
- [ ] Export PDF and DOCX; verify no GuroDesk branding, prompt, model/AI metadata, technical audit data, internal IDs, or accidental learner names in non-authorized modes.
- [ ] Export the combined XLSX and verify complete deterministic values in `Summary`, `Learner Scores`, `Item Analysis`, `Option Analysis`, `Competency Analysis`, `Cognitive Analysis`, and `Remediation`.
- [ ] Verify learner names appear only in teacher-authorized result output/worksheet.
- [ ] Do not claim custom result/item-analysis XLSX template upload/mapping/storage/fill; the feature is architecture-only pending a later phase.

## Sign-off boundary

- [ ] Record any staging or device-specific defect instead of weakening an earlier validator.
- [ ] Confirm Phase 5.0–5.3 is the completed scope and package the project root ZIP without `node_modules` or `dist`.
- [ ] Next recommendation: **Phase 5.4 Production Acceptance & Deployment Validation**.

## Local release evidence (2026-08-09)

- Automated curriculum, Phase 2–5.3, TypeScript, and production-build gates passed in one retained run.
- A 40-learner × 50-item fixture passed rendered PDF/DOCX pagination inspection and complete seven-sheet XLSX checks.
- Static source/report scans found no committed credential values, learner IDs in exports, product branding, or AI metadata.
- Staging migration/RLS/Edge checks and real Android/iOS acceptance remain intentionally unchecked for Phase 5.4.
- [ ] Require explicit authorization before beginning the full grading/class-record system, report cards, awards/ranking, portals, or AI grading.
