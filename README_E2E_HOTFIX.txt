GuroDesk Phase 5.5 E2E hotfix

Root cause:
The Playwright helper attempted to finalize a new TOS without first selecting
the required School grading term. Production validation correctly prevented
finalization, so the helper timed out waiting for "Ready to finalize".

Fix:
- Select the first available School grading term explicitly.
- Verify its aria-pressed state.
- Wait for the actual Finalize TOS button to become enabled instead of relying
  on exact validation copy.

No production application logic, database migration, RLS policy, or UI behavior
is changed by this hotfix.
