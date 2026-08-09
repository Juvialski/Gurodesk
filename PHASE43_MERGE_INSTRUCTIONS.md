# Phase 4.3 merge instructions

This package is a complete GuroDesk project rooted at the ZIP top level. It preserves the uploaded Phase 4 implementation and all earlier work.

1. Back up the current project.
2. Replace it with the ZIP contents at the project root; do not add a second wrapper folder.
3. Run `npm install`, all validation commands in `docs/PHASE_4_3_RELEASE_CHECKLIST.md`, and `npm run build`.
4. Apply migrations `001` through `014` in filename order. On an existing Phase 4 deployment, apply only new migrations `013` and `014`.
5. Deploy the authenticated `assessment-question-generator` Edge Function alongside the existing functions, using the same server-side BYOK encryption/service-role environment.
6. Keep every Storage bucket private and do not introduce a browser Gemini key or Supabase service-role variable.

Built-in assessment Print/PDF/DOCX exports work independently of custom templates. Exact repeating-question support for uploaded assessment DOCX masters is intentionally not claimed in this release.
