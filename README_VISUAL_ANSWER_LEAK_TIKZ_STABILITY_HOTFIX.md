# Assessment visual answer-leak + TikZ stability hotfix

Date: 2026-08-10

This hotfix follows production testing of the TikZ-first assessment visual build.

## Fixed

1. **Answer leakage in learner prompts**
   - Fill-in-the-blank / identification / short-answer generations may not repeat an accepted answer in the learner prompt.
   - Parenthetical examples containing the accepted answer are removed deterministically.
   - Any remaining direct accepted-answer hint is rejected by the server contract.

2. **Answer leakage in visual alt text**
   - Gemini-provided alt text is no longer surfaced verbatim.
   - After visual validation, GuroDesk replaces it with a neutral observational description derived from the validated primitives.
   - Classification/solution wording such as `irregular non-convex pentagon` is therefore not exposed as accessibility text.

3. **TikZ diagram disappearing after a few seconds**
   - The deterministic SVG fallback stays mounted underneath the TikZ iframe permanently.
   - TikZJax must keep a usable compiled SVG stable through a short settling window before the runtime reports `ready`.
   - If the browser compiler later becomes blank/transient, the fallback remains visible underneath.

No database migration. The safe visual DSL and GuroDesk-owned TikZ translator are preserved.
