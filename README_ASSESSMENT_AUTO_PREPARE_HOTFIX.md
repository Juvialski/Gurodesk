# Assessment one-click auto-prepare hotfix

The assessment editor now treats **Generate & prepare paper** as a bounded preparation workflow rather than a one-shot generation command.

- Generates remaining empty slots.
- Re-runs deterministic final-paper QA.
- Regenerates only AI-owned items with structural blockers (including previously accepted AI items).
- Never silently overwrites manual or teacher-edited questions.
- Uses at most two normal QA/repair rounds from the editor (library hard-cap: three).
- Stops immediately at provider authentication/quota/rate-limit/configuration boundaries and preserves saved work.
- Automatically accepts, locks, acknowledges non-blocking warnings, and finalizes when structural QA passes.
- Leaves only genuinely unresolved/manual blockers for teacher attention.

The Phase 4.3 isolated export validator was also updated for the new assessment math/presentation helper imports.

No migration, RLS, TOS, scoring, results, curriculum, or Gemini wire-contract changes.
