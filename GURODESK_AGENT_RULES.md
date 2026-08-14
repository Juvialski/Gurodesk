# GURODESK AGENT RULES

Repository: Juvialski/Gurodesk

GitHub `main` is the source of truth.

## GitHub workflow
For ChatGPT, treat GitHub as READ-ONLY for GuroDesk.
Do not attempt pushes, commits, branch creation, PR writes, file writes, or retries.
The user manually pushes.

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
