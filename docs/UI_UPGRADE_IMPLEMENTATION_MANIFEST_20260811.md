# GuroDesk major UI/UX upgrade — implementation manifest

Date: 2026-08-11 (Asia/Manila)

Source checkpoint SHA-256:
`54e048d76a1ce0f1d3666b3a328026327994b97915823c69726a2a67c1174c69`

## Outcome

The aligned UI plan is implemented as a frontend-only upgrade. GuroDesk now
uses a task-oriented responsive shell, phone bottom navigation, a shared
teacher workspace context, and Simple-first guided workflows while retaining
the existing expert editors and canonical domain services.

The most important plan correction is that Gemini setup is feature-local. A
teacher can use manual/non-AI workflows without configuring Gemini; AI actions
continue through the existing teacher-owned BYOK boundary.

## Implemented scope

| Area | Delivered behavior |
| --- | --- |
| Shell and navigation | Desktop sidebar; phone Home, Create, Classes, Results, More bar; task routes and preserved deep links; focus-managed More dialog. |
| Home and Create | Time-appropriate greeting, real repository-backed recent work, honest attention states, and Lesson/TOS/Test/Remediation entry cards. |
| Workspace context | Explicit active assignment and section selection, optional real term/period options, no fabricated IDs or inferred mappings, user-scoped local persistence. |
| Assessment | Simple default, compact outline/editor, translated statuses and progress, helpful/required visual semantics, shared existing preparation orchestration, Customize access to the complete editor. |
| Assessment safety | Automatic preparation saves a structurally checked draft only. AI suggestions remain “Needs review”; explicit teacher confirmation is required to accept, lock, and finalize. |
| TOS | Guided competency/test-size flow, separate school grading term and curriculum period, existing deterministic allocation, full Customize editor. |
| Lesson planning | Guided competency, period, duration, and language flow; optional existing Quick Draft; full ILAW editor retained. |
| Results | Guided assessment/class/learner/mode setup, all active learners selected by default, score-only limitations stated, stale-roster race prevented. |
| Curriculum and Classes | My Curriculum default, management tools behind Manage, repeatable section entry, official curriculum default, custom/hybrid choices under an explicit change action. |
| Settings and onboarding | Five settings categories with coherent deep-link hashes; four-step onboarding; optional AI setup with “Set up later.” |
| Accessibility | 44px-or-larger shared mode controls, visible focus, reduced-motion support, modal focus handling, phone-safe overlays, labelled landmarks and dialogs. |

## Preservation boundary verified

- Supabase migrations remain exactly 001–026; no migration was added or changed.
- Supabase Edge Functions, official curriculum manifests/seeds, `package.json`,
  and `package-lock.json` are unchanged.
- Existing assessment generation, export presentation, result scoring/repository,
  RLS, and BYOK implementation files remain authoritative.
- Canonical preview/print/PDF/DOCX routes and saved deep links remain available.
- Official coverage remains 189 catalog entries, 196 manifests, 129 pinned
  sources, and 6,181 verified competencies.
- Partial/omitted Results behavior is intentionally preserved; this UI phase
  does not change Phase 5 scoring or final-result semantics.

## Validation

Passed after all audit fixes:

- `npm run test:ci`
  - application, unit-test, and E2E TypeScript checks
  - all 35 existing static validators
  - 25 unit-test files / 238 unit tests
  - production Vite build
- focused assessment-status, curriculum-display, and workspace-context tests
- byte comparisons for migrations, Edge Functions, curriculum data,
  package manifests, assessment export/generation services, and Results
  repository against the supplied checkpoint
- clean ZIP integrity and root-layout checks

The build retains a non-blocking Vite warning for the main JavaScript chunk.
Route-level code splitting is a sensible later performance phase, but it is not
mixed into this behavior-preserving UI release.

Browser-driven Supabase E2E and final screenshot QA were not executable in this
sandbox: the required `E2E_SUPABASE_*` environment and Chromium binary were not
available, and the local listener was blocked by the sandbox network-interface
error. A 390×844 phone Playwright project and navigation regression spec are
included for the next browser-capable run.

## Deployment note

Deploy the frontend checkpoint through the existing application pipeline. No
database migration, seed replay, or Edge Function deployment is introduced by
this UI upgrade. The deployment environment must still match the supplied
checkpoint's existing migrations, official curriculum seed, and assessment
generator contract.
