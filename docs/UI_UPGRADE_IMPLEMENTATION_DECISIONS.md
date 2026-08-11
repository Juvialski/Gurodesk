# GuroDesk UI upgrade implementation decisions

Date: 2026-08-11

Source checkpoint SHA-256:
`54e048d76a1ce0f1d3666b3a328026327994b97915823c69726a2a67c1174c69`

This note records the code-alignment adjustments made while implementing the
major UI/UX plan. The existing assessment, curriculum, scoring, export,
repository, and security contracts remain authoritative.

## Adjustments to the plan

1. **AI setup is feature-local, not an application gate.** A teacher can open
   GuroDesk, manage classes, browse curriculum, edit records, and use manual
   workflows without first configuring Gemini. AI-assisted actions may still
   require setup and must continue to use the existing BYOK boundary.

2. **Simple and advanced views are two presentations of the same record.** No
   duplicate lesson, TOS, assessment, or result model is introduced. Switching
   views cannot save, finalize, regenerate, or otherwise mutate a record by
   itself.

3. **Remembered workspace context is advisory and local.** A stored assignment
   or section is reused only while it remains available to the signed-in
   teacher. It must never invent a curriculum-period/grading-term relationship
   or silently choose a competency.

4. **Existing routes remain valid.** The task-oriented navigation adds clearer
   entry points and aliases without breaking saved deep links, print routes, or
   document URLs.

5. **Prerequisites stay visible.** Create shortcuts may lead into an existing
   guarded workflow, but they do not bypass requirements such as a finalized
   TOS, verified curriculum selection, active roster, or teacher review.

6. **Home favors honest actions over synthetic metrics.** It may show real
   profile, assignment, or repository-backed state; it must not fabricate
   recent work, completion counts, or attention items merely to fill the page.

7. **No database phase is required for this upgrade.** The UI uses migrations
   001 through 026 unchanged. Cross-device UI preferences can be considered in
   a later, separately authorized change.

8. **Assessment preparation stops at a teacher-reviewable draft.** Automatic
   generation, visual enrichment, and bounded structural repair may prepare and
   save questions, but they cannot mark AI suggestions teacher-accepted, lock
   them, or finalize the assessment. Finalization remains behind the explicit
   `I reviewed — finalize test` / `Accept, verify & finalize all` action.

9. **Remembered workspace context is user-scoped.** Local context keys include
   the authenticated user ID so switching accounts on one device cannot restore
   another teacher's assignment or section.

10. **Partial and omitted result semantics remain unchanged.** The existing
    Phase 5 contract deliberately supports omitted responses and partial
    encoding. The UI upgrade improves roster-loading race protection but does
    not redefine scoring, outcome completeness, or final-result validation.

## Preservation boundary

The upgrade must not create a second assessment document contract, visual
pipeline, allocation engine, scoring model, curriculum copy, or export layout.
Official source text and historical result snapshots remain immutable, and no
RLS or provider-key boundary is weakened.
