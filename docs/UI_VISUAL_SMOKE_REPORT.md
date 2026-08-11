# GuroDesk UI visual/accessibility smoke report

Date: 2026-08-11 (Asia/Manila)

Scope: read-only audit of the UI upgrade against the aligned UI plan and
`docs/UI_UPGRADE_IMPLEMENTATION_DECISIONS.md`. No source, test, package, or
script files were changed. No AI/provider or Supabase operation was invoked.

## Execution limits

The requested browser pass could not run in this environment:

- `@playwright/test` is installed, but `chromium.launch()` failed because the
  expected executable is missing at
  `/root/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`.
  No browser was installed.
- A local Vite start was attempted. Vite failed before listening because this
  sandbox reports `uv_interface_addresses returned Unknown system error 1`.
  Therefore there are no screenshots and no runtime console/network trace.

The rest of this report is a static DOM/CSS/source smoke review. Items marked
“static pass” still need a real Chromium run before release sign-off.

## Checks

| Check | Result | Static evidence / limitation |
| --- | --- | --- |
| Auth → sample workspace | Static pass | `AuthPage` exposes **Open sample teacher workspace** and `AppContext.enterDemo(true)` seeds a labelled local sample teacher workspace. |
| Task-centric Home | Static pass | `DashboardPage` has Create, Lesson Plan, TOS, Test / Quiz, Enter Results, Continue working, Needs attention, and Classes sections; no backend/RLS metrics are shown. |
| Phone bottom navigation | Static pass | `ResponsiveNavigation` renders five items: Home, Create, Classes, Results, More. The responsive CSS shows it below 780px with safe-area padding. |
| More sheet | Static pass with accessibility follow-up | Backdrop, close button, Documents, Curriculum, Templates & TOS, Settings, Help, Advanced diagnostics, and Sign out are present. Overlay keyboard/focus behavior was not executable-tested; see defects. |
| `/create` cards | Static pass | `CreateHubPage` renders Lesson Plan, TOS, Test / Quiz, and Remediation Plan cards with explicit descriptions and guarded destinations. Remediation intentionally enters Results first so a completed result can be chosen. |
| Workspace context picker | Static pass with accessibility follow-up | Assignment, section, optional grading term, and optional curriculum period are separate controls; no competency or period/term mapping is inferred. Mobile popover CSS is present. |
| Classes add flow | Static pass | Grade and learning-area selects, repeatable section chips/Enter/Add behavior, official curriculum verification, and Change curriculum type are implemented in `ClassesPage`. |
| Settings categories/hash entry | Partial | Five categories and inbound `#ai-assistance`, `#advanced`, `#teaching`, `#documents`, and `#profile` mapping are implemented. Clicking a category changes only React state/local storage; it does not update the URL hash (see defect). |
| Curriculum default vs Manage | Static pass | `CurriculumPage` has My curriculum and Manage curriculum views, scopes default browsing to an assignment, and keeps catalog/private/hybrid tools behind Manage. Preference persistence is local. |
| Results setup | Static pass | Simple setup offers finalized assessment, class/section, all active learners selected by default, Choose learners, Enter answers, Enter by question, Enter scores only, and Start entering results. |
| TOS Simple / Customize | Static pass | `TosEditorPage` uses `SimpleAdvancedToggle`; simple mode explicitly selects covered competencies and test size, while Customize exposes the existing editor. |
| Lesson Plan Simple / Customize | Static pass | `LessonPlanEditorPage` uses the shared toggle; simple mode requires an explicitly selected verified competency and exposes timing/language plus reviewable draft. |
| Assessment Simple / Customize | Static pass | `AssessmentEditorPage` and `AssessmentSimpleView` use the shared toggle and preserve the advanced editor. Simple mode translates progress/status, keeps the canonical preview/export route, and exposes technical details. |
| Critical horizontal overflow | Static pass, runtime unverified | Global shell uses `min-width: 0`/`minmax(0, …)`; tables, curriculum period tabs, competency lists, and results lists have explicit overflow handling. Long-content and all four requested widths were not measurable without a browser. |
| Touch targets | Static pass with one exception | UI foundation raises common buttons/inputs/icon buttons to 48px and mobile nav/actions are 44–58px. The shared Simple/Customize buttons remain 42px high. |
| Visible headings | Static pass | Pages use visible `h1` headers and workflow `h2`/`h3` headings; major sections have labelled headings or aria labels. |
| Runtime console errors | Not run | Requires the missing browser/local server. Static TypeScript and unit checks below passed. |

## Verification commands

Passed:

- `npm run typecheck`
- `npm run typecheck:tests`
- `npm run typecheck:e2e`
- `npm run test:unit` — 24 files, 235 tests passed
- `npm run build` — Vite build completed

The production build emits a non-blocking warning for the main JavaScript
chunk (`2,628.29 kB`, `748.03 kB` gzip) exceeding Vite’s 500 kB guidance.

## Actionable defects

### Important

1. **Settings category navigation can disagree with the URL.** `SettingsPage`
   reads a hash before local preference, but category buttons do not write a
   hash. For example, opening `/settings#ai-assistance`, clicking Profile, and
   refreshing reopens AI assistance because the stale hash wins. Update the
   hash when a category is selected (or clear it) and keep browser navigation
   coherent.

2. **Overlay semantics/focus management are incomplete.** The More sheet is a
   plain `<section>` with `aria-label`, not a modal dialog, and does not trap or
   restore focus. `WorkspaceContextPicker` has `role="dialog"` but no
   `aria-modal`, visible-heading association, or focus return/trap. Keyboard and
   screen-reader users can tab into the page behind an open overlay. Add modal
   semantics and a small focus-management routine for both overlays.

### Minor

1. **Simple / Customize controls are below the shared touch token.** The
   foundation defines `--touch-size: 48px`, but
   `.simple-advanced-toggle button` later overrides it to `min-height: 42px`.
   Raise these two mode buttons to the token (or explicitly document the
   exception).

2. **Main bundle is large for a phone-first app.** The successful build’s main
   chunk is 2.63 MB minified (748 KB gzip). Consider route-level lazy loading
   for document/export and advanced editor modules before slow-network mobile
   acceptance. This is not a correctness blocker.

## Release disposition

No blocker was identified by the static review, and the type/unit/build gates
passed. Visual sign-off remains pending a Chromium run at 320×568, 390×844,
768×1024, and 1366×768 (including console-error capture, overflow measurement,
and touch/focus inspection) in an environment with a browser binary and a
working local Vite listener.

## Post-audit resolution

The primary implementation pass resolved every actionable UI finding before
the final checkpoint:

- Settings category clicks now write canonical hashes with replace navigation,
  so refresh and browser history no longer restore a stale category.
- The phone More sheet now has modal dialog semantics, Escape handling, a focus
  trap, body-scroll locking, initial focus, and focus restoration. The workspace
  context dialog now associates its visible heading, manages focus/Escape, and
  becomes modal with a backdrop and focus trap on phone widths.
- Shared Simple / Customize controls now meet the 44px minimum target.
- The code audit additionally caused automatic assessment preparation to stop
  at a saved draft, with explicit teacher review required before finalization;
  AI suggestions are no longer translated as ready before acceptance.
- Remembered workspace context is scoped by authenticated user, and Results
  clears/disables learner selection while a changed roster is loading.

TypeScript, validators, focused unit tests, and the full CI command were rerun
after these resolutions. Browser-based visual sign-off remains pending for the
environmental reasons above; the large main-bundle warning remains non-blocking.
