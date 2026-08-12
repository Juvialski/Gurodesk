# Required Visual + Persistence Hotfix

This hotfix builds on the direct Gemini TikZ architecture already in GuroDesk.

Key changes:
- Reserves a small set of visual questions before Gemini writes question stems.
- Reserved visual questions must depend on the diagram; at least one essential given belongs only in the diagram.
- Text-only generated items are explicitly suppressed from later cosmetic/helpful visual enrichment.
- Required-visual items receive an independent verifier pass even when ordinary risk is low.
- Gemini still creates TikZ in a separate visual-only provider call.
- Each generated visual result is persisted to Supabase before the next visual request, preventing Preview -> Back from losing generated TikZ.
- Finalized/archived assessments are not re-planned when reopened.
- Required visual states block finalization until the diagram is ready.
- Assessments is permanently available in desktop navigation and in the mobile More menu.
- Updates the obsolete AI-boundary regression that still expected Gemini to be forbidden from returning TikZ.

No database migration is required. The assessment-question-generator Edge Function is changed and should redeploy through the existing Supabase GitHub integration after the files reach `main`.
