# GuroDesk production smoke test

Run this checklist on an Android phone in a clean browser session. Use teacher-owned test data only.

## Auth

- [ ] Sign up and complete verification redirect.
- [ ] Log in, set the teacher's own Gemini BYOK key, log out, and log in again.
- [ ] Confirm the session persists on refresh and expires cleanly without a blank screen.

## Curriculum and lessons

- [ ] Verified competency loading succeeds.
- [ ] Create and reopen a lesson plan.
- [ ] Request an AI suggestion using the teacher key; verify only teacher-authorized context is used.
- [ ] Export lesson PDF and DOCX; check Filipino/Unicode text and pagination.

## TOS

- [ ] Create and finalize a TOS.
- [ ] Confirm item allocation and cognitive mappings remain unchanged.
- [ ] Export PDF/XLSX and the configured teacher template path.

## Assessment and QA

- [ ] Create an assessment from finalized TOS.
- [ ] Configure allowed types and points; confirm `Items` and `Total points` are separate.
- [ ] Generate a mixed-format test and edit one question inside the app.
- [ ] Replace one question only; try Generate Alternative and Check Accuracy.
- [ ] Lock an accepted item, verify bulk actions skip it, then restore a previous item version.
- [ ] Enter Identification, Fill in the Blank, Numerical, Problem Solving, Matching, Multiple Select, Constructed Response, and Essay items.
- [ ] Record objective answers and teacher partial credit such as 3/5; confirm no subjective answer is AI-scored.
- [ ] Run Final Test Review and resolve hard errors; review or consciously override warnings.
- [ ] Download Student Copy, Teacher Copy, and Answer Key/Scoring Guide. Confirm student output hides answers, TOS IDs, QA state, model names, and internal metadata.

## Results and analysis

- [ ] Load a teacher-owned roster and create a result session.
- [ ] Enter objective responses, fill/matching partial credit, and subjective teacher points in batched draft saves.
- [ ] Confirm the main score shows points (for example `47 / 60`), while fully-correct item count is separate.
- [ ] Open item analysis and confirm one-point binary facility is labeled separately from normalized point achievement.
- [ ] Open competency/cognitive analysis and confirm both item counts and point denominators are visible.
- [ ] Open remediation; confirm the default evidence basis is point-weighted and the denominator is explained.
- [ ] Request optional remediation suggestions; confirm no learner names, IDs, raw answers, or per-learner histories are sent.
- [ ] Export results PDF, DOCX, XLSX, and print preview; check long text, partial points, Unicode, and no AI/internal metadata.

## Mobile and deployment

- [ ] Refresh `/lessons/...`, `/tos/...`, `/assessments/...`, `/results/...`, `/results/.../analysis`, and `/results/.../remediation` directly.
- [ ] Use phone navigation, item navigator, learner picker, and export/download controls without horizontal overflow.
- [ ] Simulate failed save, offline/reconnect, malformed AI response, quota/429, and cancelled generation in staging; verify work is preserved.
