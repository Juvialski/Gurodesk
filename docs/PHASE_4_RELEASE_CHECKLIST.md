# Phase 4 release checklist

- Apply migrations `001` through `012` in order.
- Deploy the authenticated `tos-template-analyzer` Edge Function using the existing server-side BYOK secrets.
- Confirm the `document-templates` bucket remains private and its teacher-owned path policies pass.
- Run `npm run validate:phase4`, every retained Phase 2–3.7 validator, and `npm run build`.
- On an Android-size viewport, create, save, reopen, edit, duplicate, and finalize a TOS.
- Verify equal, instructional-time, manual-percentage, decimal, and manual item-count allocations reconcile exactly.
- Verify print/PDF and built-in XLSX output; open the XLSX in Excel or LibreOffice and confirm formulas recalculate, the first eight rows stay frozen, and print settings remain landscape.
- In Supabase mode, upload a disposable XLSX copy, correct mappings manually, export, and confirm the stored master hash/file is unchanged.
- Audit any document-template rows that predate Phase 4 before validating the migration's rollout-safe `NOT VALID` pair/path/hash constraints globally.
- Confirm assessment-question/test-paper generation remains unavailable.
