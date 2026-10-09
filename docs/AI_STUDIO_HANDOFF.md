# Apply this replacement ZIP without Git history

This archive contains actual replacement/addition files with repository-root-relative paths. Extract it into a review copy of your existing GuroDesk AI Studio project, keeping `src/`, `supabase/`, `tests/`, `scripts/`, and the other root paths intact. Do not replace newer unrelated work blindly. `handoff/manifest.json` lists every replacement with its SHA-256 and byte size, and records deletion instructions.

Remove the obsolete **`src/components/AiKeyPromptModal.tsx`** file. The updated AppShell uses an informational allowance status instead. No other file deletion is required.

Keep the destination’s existing `src/lib/supabase.ts` and authorized browser-safe Supabase configuration. That file was not changed and is intentionally absent from this archive so no API key is included. No `.env`, `.git`, dependency directory, production password, provider key, or generated curriculum bundle is supplied.

Install from the replacement npm lockfile. Run `npm run test:ci` and `npm run test:e2e:demo`; the latter launches only isolated headless Chromium. The local validated package passed **646 unit tests, all 42 retained validators, type/source checks, build, and seven demo/mobile E2E cases**. The full npm dependency audit reported zero vulnerabilities. Do not interpret those results as hosted/database/provider/device verification.

Read `docs/LOCAL_RECOVERY_HANDOFF.md`, `docs/SPONSORED_GEMINI.md`, `docs/MAIL_MERGE.md`, and `docs/SCHOOL_DIRECTORY_RECOVERY.md` before publishing. Database migration/RLS/concurrency/integration/authenticated E2E/Edge Runtime checks were blocked because Docker was stopped. Production SQL still failed with `28P01`; its migration history and school coverage remain unverified.

The two additive migrations must be reconciled and tested before production application. All eleven configured Edge Functions must be deployed together after the schema is ready, including handwriting/performance functions missing from the previous deployed list. Configure `GURODESK_SPONSORED_GEMINI_KEY` privately through Supabase Secrets; preserve existing BYOK encryption material. **This archive does not authorize or perform production deployment.**

The merge workflow is functional for profile/manual fields and repeating Word/Excel records. Automatic binding to every saved document category, general structural mapping for no-placeholder templates outside lesson/TOS, nested repeats, workbook row insertion/formula shifting, native Excel previews, and hosted vector PDF conversion remain unfinished. Physical OMR/camera alignment and actual teacher-document/Office rendering still require review.

Pre-existing feature-tour source changes were left untouched in the local repository and are not part of this ZIP. The full replacement `src/styles.css` retains their existing styles in addition to this task's styles. Existing tests and scoring/assessment/curriculum contracts remain intact. Do not regenerate curriculum datasets as part of applying this archive.
