# GURODESK AGENT RULES

Repository: Juvialski/Gurodesk

GitHub `main` is the source of truth.

## GitHub workflow
For ChatGPT, treat GitHub as READ-ONLY for GuroDesk.
Do not attempt pushes, commits, branch creation, PR writes, file writes, or retries for ChatGPT.

Antigravity is exempted from the read-only restriction and is allowed to stage, commit, and push directly when requested.
**CRITICAL MANDATE FOR ANTIGRAVITY**: Before pushing to GitHub, Antigravity MUST ALWAYS run and pass the full CI suite (`npm run test:ci`, encompassing `validate:schools`, `typecheck`, `typecheck:tests`, `typecheck:e2e`, `validate:edge-functions`, `validate:all`, `test:unit`, and `build:bundle`). Never push any commit to `main` without first verifying that all CI tests pass.

When the user says `pushed`, re-read current GitHub main, inspect the actual diff, and inspect CI.

## AI Studio workflow
AI Studio is an implementation workspace.
Assume it may not have Git history and cannot push for this workflow.

AI Studio handoffs must use actual root-relative files and must not depend on:
- git show
- git restore
- old commit SHAs
- Git history access

If a generated artifact is large, generate it deterministically from current project data and explicitly expose/download the actual generated file before the user manually pushes.

## Phone-first
Do not require the user to use VS Code, SSH, terminal, or manual source editing.

## Protected GuroDesk systems
Do not change unrelated:
- Gemini assessment generation contracts
- TikZ
- assessment scoring
- results / item analysis / remediation
- curriculum manifests
- historical snapshots

## GENERATED CURRICULUM BUNDLE — DO NOT EDIT
- `supabase/seeds/official-curriculum-complete.sql` is deterministic generated output and is intentionally untracked in Git.
- Agents must never manually create, edit, rewrite, truncate, format, or commit this file.
- Agents must never regenerate it during unrelated tasks.
- The canonical curriculum source of truth is `data/curriculum/official/*.json` (196 official manifests).
- The canonical deterministic generator is `scripts/generate-official-curriculum-bundle.mjs`.
- Validation must generate into OS temporary storage (`tmpdir`) and clean up afterward without leaving artifacts in the repository.
- Explicit bundle exports are allowed only for dedicated curriculum export or deployment tasks.
- Never infer or invent official DepEd curriculum content; all competencies and standards must be sourced from official DepEd documents.

## School identity
District is first-class.
Never infer District from municipality.
Verified District requires an explicit official DepEd School ID -> District mapping.
Otherwise allow teacher-entered manual/unverified District.

## Validation
Do not disable validators to make CI green.
For UI, test 360 / 390 / 412 px.
For DB changes, preserve production data and fresh/upgrade compatibility.
Do not claim a test passed if the environment could not actually run it.

## Workspace Skills
Consult and follow the specialized workspace skills in `.agents/skills/` when working on specific subsystems:
- **`deped-assessment-standards`** (`.agents/skills/deped-assessment-standards/SKILL.md`): Official DepEd bilingual directions, True/False format, blanks, and typography rules.
- **`assessment-export-qa`** (`.agents/skills/assessment-export-qa/SKILL.md`): 4-target verification (DOCX, PDF, Web Preview, Browser Print) and math normalizer safety.
- **`gemini-generation-standards`** (`.agents/skills/gemini-generation-standards/SKILL.md`): Edge function AI prompt contracts, 11 question types JSON schemas, anti-leak rules, and visual contracts.
- **`lesson-plan-standards`** (`.agents/skills/lesson-plan-standards/SKILL.md`): DepEd DLL/DLP structure (DO 42, s. 2016), multilingual terminology, and template exports.
- **`table-of-specifications-standards`** (`.agents/skills/table-of-specifications-standards/SKILL.md`): Cognitive taxonomy allocation (60-30-10 rule), Hamilton item distribution, and multi-format exports.
- **`student-results-and-remediation`** (`.agents/skills/student-results-and-remediation/SKILL.md`): Privacy boundaries, psychometric calculations (facility/discrimination index), and grounded remediation.
- **`curriculum-and-district-standards`** (`.agents/skills/curriculum-and-district-standards/SKILL.md`): 196 official curriculum manifests governance and School District reconciliation.


