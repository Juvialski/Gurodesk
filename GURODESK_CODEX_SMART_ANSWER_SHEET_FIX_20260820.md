# GURODESK CODEX REVIEW + FIX — SMART ANSWER SHEET
Date: 2026-08-20

Repository: Juvialski/Gurodesk

## NON-NEGOTIABLE WORKFLOW

1. FIRST inspect the CURRENT latest GitHub `main`.
2. Record the actual HEAD SHA before changing anything.
3. Read `/AGENTS.md`, `/GURODESK_AGENT_RULES.md`, and the relevant `.agents/skills/*` files before editing.
4. Preserve newer unrelated work.
5. This is a review/fix run, not a rewrite.
6. DO NOT push, commit, create PRs, or alter remote branches in this run. Leave the working tree ready for the user to review and manually push.
7. Do not weaken validators or tests to make CI green.
8. Protect existing assessment generation contracts, scoring/results, item analysis, remediation, TikZ/native visuals, curriculum manifests, historical snapshots, and Supabase production compatibility.
9. Run the full existing repo validation at the end, including `npm run test:ci`.
10. Test mobile UI at 360px, 390px, and 412px widths.

## CONTEXT

A new Smart Answer Sheet / OMR feature has been added.

The visible reported problem is that the Microsoft Word answer-sheet export is terrible: instead of real shadable bubbles, it displays text such as:

`( A ) ( B ) ( C ) ( D )`

That problem is confirmed in the current audited snapshot, but the review found several deeper integration and safety issues. Do not patch only the appearance. Review the full production flow so a printed answer sheet can actually be scanned, safely matched to a learner, reviewed, committed, and analyzed.

The previous audit was performed from an uploaded source snapshot because the GitHub connector could not see the repository at that moment. Therefore you MUST independently inspect the true latest `main` and verify each finding still applies before editing.

---

# P0 — FIX THE WORD ANSWER SHEET PROPERLY

## Confirmed cause

Inspect:

`src/lib/answerSheet/answerSheetDocxExport.ts`

The DOCX exporter currently constructs answer choices as Word text, including logic equivalent to:

- multiple choice / multiple select: `( A ) ( B ) ...`
- true/false: `( T ) ( F )`
- matching: `[ ____ ]`

It does not use the canonical answer-sheet geometry used by the browser/print renderer.

This is not just an aesthetic issue. A Smart Answer Sheet must have stable physical geometry for OMR.

## Required fix

Make DOCX export use the SAME canonical layout definition/geometry as the actual Smart Answer Sheet renderer.

The DOCX version must preserve:

- true empty circular bubbles suitable for pencil shading;
- centered choice labels;
- exact bubble diameter;
- exact row/column spacing;
- fiducial/corner registration markers;
- QR code;
- learner/assessment identification data;
- paper size;
- slip density / slips-per-page;
- cutting guides where applicable;
- fixed physical dimensions;
- no Word auto-fit that silently changes geometry.

Prefer a single-source-of-truth layout pipeline.

A good architecture is:

1. neutral layout/density policy;
2. `generateAnswerSheetLayout(...)`;
3. canonical renderer;
4. Browser Print and DOCX consume the same definition.

Do NOT maintain one coordinate system for the browser and another ad-hoc text layout for Word.

### Dependency-cycle warning

Current code places `resolveSlipsPerPage()` in the DOCX exporter while `layoutEngine.ts` imports it.

If the DOCX exporter is changed to import the layout engine, that can create an import cycle.

Move shared density selection to a neutral module such as:

`src/lib/answerSheet/layoutPolicy.ts`

Then have both layout engine and exporters import from it.

### DOCX rendering choice

Use a robust Word-compatible fixed-size graphic representation for each slip/page.

Possible approach:
- canonical SVG generated from the layout;
- embed SVG if the current `docx` package / Word compatibility is verified;
- otherwise rasterize to high-resolution PNG at a deterministic DPI while preserving exact physical dimensions in the DOCX.

Do NOT simulate bubbles using:
- parentheses;
- Unicode circle glyphs;
- Wingdings;
- border characters;
- font-dependent symbols.

The printed sheet must remain scanner-compatible.

---

# P0 — MAKE THE REAL SCANNER PATH ACTUALLY WORK

Inspect:

- `src/components/answerSheet/AnswerSheetScannerModal.tsx`
- `src/lib/omr/omrEngine.ts`

In the audited snapshot, the live UI calls `processAnswerSheetImage(...)` with expected assessment ID/version but without the layout definition or assessment blueprint needed by the OMR engine.

The engine then has a failure path equivalent to:

`Assessment blueprint or layout definition is required to decode answer regions.`

Existing unit tests can miss this because they provide richer test arguments than the production UI.

## Required fix

Create a production-safe adapter so the scanner always obtains the exact immutable layout used to generate the sheet.

Do not use unsafe casts or guess geometry from current editable assessment state.

The scan must derive geometry from:
- QR/layout metadata; and/or
- the saved immutable assessment/version snapshot;
- the exact paper/density specification used during generation.

Add an integration/component regression test exercising the SAME call path as `AnswerSheetScannerModal`.

---

# P0 — QR MUST ACTUALLY BE DECODED FROM THE PHOTO

The current system renders a QR on the sheet, but the audited scanner path does not appear to decode QR data from the uploaded/camera image.

`omrEngine.ts` accepts an already-decoded QR payload, but the modal does not supply one.

## Required fix

Add a local/offline QR decode step before OMR.

Requirements:
- no Gemini/API call just to decode QR;
- work with phone camera photos;
- browser-compatible;
- do not rely solely on an experimental browser API without fallback;
- validate checksum/version;
- reject mismatched assessment/version safely;
- pass decoded payload into the OMR engine.

Use a maintained lightweight QR decoder compatible with the existing stack if no suitable dependency already exists.

Add tests using a genuinely rendered QR-bearing answer sheet, not only synthetic bubble coordinates.

---

# P0 — QR/LAYOUT METADATA MUST IDENTIFY THE EXACT GEOMETRY

Inspect:

`src/lib/answerSheet/qrPayload.ts`

The audited v1 payload contains assessment/version/layout version/mode/optional learner, but it does not carry enough information to distinguish all print geometries.

Layout geometry changes with:
- paper size;
- slips per page / density;
- potentially layout schema/version.

If a Letter/Legal/Folio sheet or manually forced density is scanned as default A4/auto, OMR coordinates can be wrong.

## Required fix

Introduce a backward-compatible payload evolution, for example v2, containing enough compact metadata to reconstruct the exact geometry.

At minimum identify:
- assessment ID;
- assessment version;
- answer-sheet layout schema version;
- paper size;
- slips-per-page/density or an equivalent deterministic layout spec/hash;
- generic vs roster/personalized mode;
- learner ID only when appropriate;
- checksum.

Keep v1 decoding backward compatible.

For old v1 sheets where exact geometry cannot safely be inferred, do NOT silently guess. Ask the teacher for the missing layout selection or route to explicit review.

Update any hardcoded `v1` display text in the renderer.

---

# P0 — NEVER SILENTLY ASSIGN A GENERIC SHEET TO THE FIRST STUDENT

Inspect generic learner matching in:

- `AnswerSheetScannerModal.tsx`
- `AnswerSheetReviewModal.tsx`
- `src/lib/omr/learnerMatching.ts`

In the audited snapshot, a generic scan can fall back to the first learner not already scanned.

That can write a valid score to the WRONG learner.

## Required behavior

### Personalized sheet
If a validated learner ID is encoded in QR:
- auto-match that learner when it belongs to the current assignment/session;
- still surface mismatches/duplicates clearly.

### Generic sheet
Never guess learner identity.

Require explicit teacher selection/search before saving the scan.

There must be no fallback like:
`first unscanned learner`.

The review modal must not default to the first learner in the roster either.

Implement the roster search UI if state exists but is currently unused.

Add a regression test proving an unmapped generic scan cannot be committed.

---

# P0 — BLOCK BATCH COMMIT WHEN ITEMS NEED REVIEW

Inspect batch commit logic in `AnswerSheetScannerModal.tsx`.

The audited implementation can aggregate batch outcomes even when scans are:
- `NEEDS_REVIEW`;
- duplicate;
- unmapped;
- ambiguous.

## Required fix

The final commit must be blocked until every scan intended for commit is in a valid resolved state.

Provide clear mobile UI:
- Ready
- Needs learner
- Ambiguous mark
- Duplicate
- Manual scoring required
- Ready to commit

Do not silently drop/accept unresolved data.

---

# P0 — FIX DUPLICATE RESOLUTION SEMANTICS

Inspect:

- `AnswerSheetReviewModal.tsx`
- `AnswerSheetScannerModal.tsx`
- `src/lib/omr/duplicateSafety.ts`
- final batch/result commit adapter

The audited flow appears to have these problems:

1. `KEEP_CURRENT` and `REPLACE` can take effectively the same parent path.
2. The reviewed image fingerprint can be compared against itself.
3. A second different photo of the same learner inside the same batch may not be detected as a duplicate learner attempt.
4. Final aggregation can yield multiple conflicting rows for the same learner/item.

## Required fix

Implement deterministic semantics:

- `SKIP_NEW`
  - discard new scan.

- `KEEP_CURRENT`
  - retain already-saved/current authoritative outcome;
  - do not overwrite it with the new scan.

- `REPLACE_CURRENT`
  - explicitly replace prior authoritative outcomes with the reviewed new scan.

Duplicate detection should cover:
- identical image fingerprint;
- same personalized learner;
- same manually selected learner within the current batch;
- learner already having outcomes in the open result session, where applicable.

Exclude the current item when comparing fingerprints.

Before commit, normalize to one authoritative outcome per participant/item key.

Add tests for all duplicate actions.

---

# P1 — FIX MATCHING-ITEM OMR GEOMETRY

Inspect matching layout in:

`src/lib/answerSheet/layoutEngine.ts`

The audited code maps multiple matching prompts to the same Y coordinate, so prompt rows overlap.

## Required fix

Implement real variable-height matching geometry or a safe alternative.

Each matching prompt needs:
- its own distinct row/region;
- non-overlapping bubbles;
- deterministic coordinates;
- correct item bounds;
- OMR detector mapping to the correct subprompt.

If safe automatic OMR for matching cannot be completed without destabilizing the release, explicitly classify matching as teacher-reviewed/manual rather than pretending it is machine-readable.

Add a multi-prompt matching layout + scan regression test.

---

# P1 — VALIDATE PHYSICAL FIT FOR ALL DENSITIES

Current automatic/manual density logic can allow combinations that physically overflow the slip.

Examples to review:
- high item counts;
- 4-up sheets;
- 5/6-choice MCQs;
- matching groups.

## Required fix

Create a shared fit validator.

Rules:
- AUTO chooses the densest SAFE layout, not just a threshold by item count.
- impossible manual density options are disabled or rejected with a clear explanation.
- never generate an answer sheet with bubbles outside the legal/fiducial area.
- never allow bubbles/rows/QR/fiducials to overlap.

Test a matrix covering:
- paper: A4, Letter, Legal, Folio;
- density: 1, 2, 3, 4 slips/page where supported;
- item counts such as 20, 30, 40, 50, 100;
- multiple-choice with larger option counts;
- matching.

Assertions should verify coordinates/bounds, not only that rendering returns a string/blob.

---

# P1 — FIX THE NEW FEATURE UI: DO NOT USE TAILWIND CLASSES IN A NON-TAILWIND APP

Inspect:

- `AnswerSheetScannerModal.tsx`
- `AnswerSheetReviewModal.tsx`
- `ExternalExamModal.tsx`

The audited snapshot uses many Tailwind-style utilities such as:
- `flex`
- `items-center`
- `gap-*`
- `bg-neutral-*`
- `text-xs`
- `grid-cols-*`
- etc.

The project does not appear to have Tailwind configured.

This means much of the new feature is effectively unstyled.

## Required fix

Do NOT add Tailwind only for these three components.

Replace utility-class soup with semantic GuroDesk classes and add/merge styles in the existing assessment/workflow CSS system.

Requirements:
- consistent cards/forms/buttons with the rest of GuroDesk;
- no browser-default appearance;
- clear scanner status and review hierarchy;
- no horizontal overflow;
- 44px minimum touch targets where practical;
- test 360/390/412 px;
- preserve desktop behavior;
- support the app’s existing theme behavior.

Audit related new answer-sheet UI for the same issue.

---

# P1 — REMOVE OR FIX THE FAKE HANDWRITING TRANSCRIPTION PATH

Inspect handwriting transcription in:

`AnswerSheetReviewModal.tsx`

The audited handler passes a hardcoded/mock JPEG data URI instead of an actual crop from the scanned paper.

That makes the feature misleading/nonfunctional.

## Required fix

Do not ship a fake transcription button.

Preferred safe scope for this bugfix:
- essays/problem-solving/constructed work remain teacher-reviewed/manual;
- OMR scores only machine-readable objective regions;
- the UI clearly marks manual-score items;
- teacher completes those scores in the existing results workflow.

Only retain AI handwriting transcription if you wire a REAL rectified crop from the uploaded image, with explicit teacher review and existing privacy/BYOK rules.

Do not persist full learner photos unnecessarily.

Do not send learner names/PII to Gemini.

---

# P1 — COMPLETE THE EXTERNAL / BACKWARD-COMPATIBLE EXAM FLOW

Inspect:

- `ExternalExamModal.tsx`
- `src/lib/answerSheet/externalExamAdapter.ts`
- `AssessmentsPage.tsx`
- Result session assessment filtering
- answer-sheet navigation

The intended feature is:

Teachers can use an exam they created outside GuroDesk, establish the item/answer structure, generate a compatible Smart Answer Sheet, scan it, and feed the same Results + Item Analysis workflow.

In the audited snapshot this flow appears incomplete:

1. external assessment may be saved with no assignment/class;
2. creation redirects to the ordinary assessment print preview rather than the Smart Answer Sheet flow;
3. results/roster workflows require an assignment association;
4. personalized sheets cannot load a roster without assignment;
5. current external builder seems manual-only rather than supporting the planned upload/trace workflow.

## Required minimum fix

- teacher must select/attach the external exam to an active class/assignment before roster/results use;
- after creation, offer/navigate to Smart Answer Sheet generation;
- ensure it appears in the correct result-session assessment picker;
- personalized roster answer sheets work once assignment is linked;
- keep manual answer-key construction as a no-AI fallback.

## Upload/trace mode

Audit whether the intended uploaded-exam tracing flow exists elsewhere.

If not, implement it only if it can be done safely within the existing architecture:
- upload teacher-owned exam;
- extract/trace item numbers/types/answer-key information with teacher confirmation;
- NEVER invent an answer key;
- teacher must approve extracted structure before Smart Answer Sheet generation;
- use existing BYOK/privacy architecture;
- no unnecessary learner PII.

If this is too broad for the current stabilization run, leave a clearly documented follow-up rather than shipping a fake/incomplete button.

---

# P1 — DO NOT FABRICATE OFFICIAL COMPETENCIES FOR EXTERNAL EXAMS

Inspect:

`src/lib/answerSheet/externalExamAdapter.ts`

The audited snapshot creates a synthetic competency such as:
`EXT-01 / External Exam Assessment Item`
and can classify every item under a default cognitive level.

That can contaminate competency analysis/remediation and make generated reports look officially grounded when they are not.

## Required fix

External items without official mapping must be explicitly UNMAPPED/EXTERNAL.

Allowed behavior:
- item-level facility/discrimination/distractor analysis still works;
- raw learner scores still work;
- competency-level and official remediation analysis exclude unmapped items; OR
- require the teacher to map items to verified official competencies before competency/remediation views are enabled.

Do not invent DepEd competency codes/text.

Preserve historical saved assessment snapshots and existing real competency data.

Add regression tests.

---

# P2 — SCANNER ROBUSTNESS REVIEW

After P0/P1 works, review these without destabilizing working code:

1. Fiducial detection fallback:
   `cornerDetection.ts` may describe fallback behavior not actually implemented.

2. Orientation:
   four symmetric fiducials may not distinguish an upside-down sheet.
   Use QR position/orientation or another deterministic orientation strategy.

3. QR vs fiducial detection:
   ensure the QR does not get mistaken for a registration marker by simplistic dark-block detection.

4. Browser print page size:
   use explicit physical dimensions from the shared paper-size map if CSS `@page size: folio` is not reliable across target browsers.

5. Real-photo tolerance:
   test rotation, mild perspective, shadows, normal phone-camera blur, and reasonable print/camera scaling.

Do not increase false-confidence. When confidence is low, route to teacher review.

---

# REQUIRED ARCHITECTURE PRINCIPLES

## One canonical answer-sheet definition

Browser preview, browser print, PDF if applicable, DOCX, and scanner must all agree on:

- layout version;
- page size;
- density;
- slip coordinates;
- bubble coordinates;
- QR payload;
- fiducials;
- item/subitem identity.

No exporter-specific alternate OMR layout.

## Deterministic first, AI only where appropriate

The objective answer-sheet checker should primarily use:
- QR decoding;
- image rectification;
- deterministic OMR;
- confidence thresholds;
- teacher review.

Do not make Gemini a dependency for reading shaded circles.

Essays/problem-solving remain teacher-scored unless a real optional reviewed workflow is intentionally implemented.

## Privacy

- do not send roster names or learner PII to Gemini;
- keep scan images local/in-memory unless existing explicit storage rules require otherwise;
- do not introduce hidden cloud upload;
- preserve strict teacher ownership/RLS.

## Historical compatibility

- immutable assessment/result snapshots remain valid;
- new QR/layout version must read old supported sheets where safely possible;
- do not rewrite historical result data.

---

# TESTS THAT MUST BE ADDED/UPDATED

Do not rely only on isolated unit tests.

## 1. DOCX structure/rendering regression
Open generated `.docx` as a ZIP (PizZip is already used in this repo if still present) and verify:
- graphical answer sheet media/relationships exist;
- no `( A ) ( B )` text fallback;
- QR/fiducial content exists in the rendered graphic;
- physical size is deterministic.

## 2. Production scanner integration
Render a sheet using production renderer -> create/load an image fixture -> call the same adapter used by ScannerModal -> decode QR -> rectify -> read marked answers.

Do not manually inject the expected layout into the test in a way the UI never does.

## 3. Generic learner safety
Generic scan cannot save/commit until teacher selects learner.

## 4. Personalized learner match
Real QR payload selects the correct learner only within allowed roster/session scope.

## 5. Wrong assessment/version
Reject or route to explicit review; never attach to the active assessment silently.

## 6. Duplicate semantics
Cover:
- identical image;
- same learner, different image;
- KEEP_CURRENT;
- REPLACE_CURRENT;
- SKIP_NEW;
- duplicate in same batch;
- duplicate against already-entered session outcome.

## 7. Batch gate
Commit disabled while any item is unresolved.

## 8. Matching
Multiple matching prompts produce distinct geometry and distinct decoded outcomes, or are explicitly manual if that is the chosen safe behavior.

## 9. Fit matrix
Coordinates stay inside legal bounds across supported paper/density/item-count combinations.

## 10. External exam
- assigned external exam can generate Smart Answer Sheet;
- it can enter result session;
- unmapped competencies do not generate fake official remediation;
- manual answer-key workflow stays backward compatible.

## 11. UI
Add/update component/E2E coverage for:
- answer sheet print modal;
- scanner;
- review;
- external exam setup;
- 360 / 390 / 412 px layouts.

---

# EXISTING TEST GAP TO CORRECT

The previous audited tests were misleading in two important ways:

1. DOCX test mainly checked that a DOCX blob exists, not whether its answer bubbles are correct/scannable.
2. OMR unit tests supplied `layoutDefinition` / assessment data directly, while the live scanner UI did not.

Tests must validate the real production integration path.

---

# EXECUTION ORDER

## Phase A — Verify current main
- fetch latest `main`;
- record HEAD SHA;
- inspect changes introducing Smart Answer Sheet;
- verify every finding in this document against current code;
- mark any already-fixed item as such;
- do not regress newer work.

## Phase B — P0 correctness
Fix:
1. canonical DOCX layout/bubbles;
2. production scanner layout reconstruction;
3. real QR decode;
4. exact layout metadata/versioning;
5. generic learner safety;
6. unresolved batch gate;
7. duplicate semantics.

Run focused tests.

## Phase C — geometry + UI
Fix:
1. density fit validation;
2. matching OMR geometry or explicit safe manual behavior;
3. non-Tailwind semantic styling;
4. fake handwriting path.

Run focused + mobile tests.

## Phase D — external exam integration
Fix assignment/result/answer-sheet integration and competency grounding.
Implement upload/trace only if it can be completed safely and truthfully.

## Phase E — full regression
Run:
- typecheck;
- lint/static validators;
- existing unit/component/E2E suites;
- all answer-sheet/OMR tests;
- `npm run test:ci`.

Do not disable validators.

---

# FINAL CODEX REPORT FORMAT

Return:

1. CURRENT HEAD SHA inspected
2. Findings confirmed / already fixed / not applicable
3. Root causes
4. Files changed
5. Exact behavior changes
6. Tests added/updated
7. Commands run and exact pass/fail summary
8. Any remaining limitations
9. Any DB migration needed (prefer none unless truly necessary)
10. Whether any protected assessment/results/remediation behavior changed
11. Confirmation that NO remote push/commit/PR was performed

If a test cannot run, say exactly why. Never claim success without execution.

---

# ACCEPTANCE CRITERIA

This run is not complete until all of these are true:

- Word answer sheet has real shadable circles and professional layout.
- Word and browser/print answer sheets share canonical scanner geometry.
- Printed DOCX remains OMR-compatible.
- QR is actually decoded from a scan.
- scanner reconstructs the exact paper/layout used.
- generic scans never guess learner identity.
- personalized scans can safely resolve learner identity from QR.
- unresolved/duplicate scans cannot silently commit.
- duplicate choices have correct KEEP/REPLACE/SKIP semantics.
- machine-readable matching items do not overlap.
- impossible density/layout combinations cannot be generated.
- new answer-sheet UI is properly styled without relying on nonexistent Tailwind.
- fake handwriting transcription is removed or genuinely wired.
- external exams can participate in Smart Answer Sheet + Results once assigned.
- external exams do not fabricate official competency/remediation mappings.
- full repo CI passes.
- mobile layouts are checked at 360/390/412.
- no remote push is made; user manually pushes.
