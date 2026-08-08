# Phase 3.6 / 3.6.1 - Document Export Engine

## Goal

Make finalized teacher work usable outside the app. Lesson plans render to:

- printable in-app preview
- browser print
- downloadable PDF
- editable Microsoft Word `.docx`

The same export model is intended to be reused by Phase 4 TOS, tests, answer keys, rubrics, and later reports.

## Default lesson-plan template

Stored template ID: `gurodesk_ilaw_standard` (kept for database compatibility).

Visible template label: **ILAW Standard**.

Phase 3.6.1 intentionally keeps the submitted/printed document plain. The printable output contains the teacher's lesson-plan content and signatories only. It does not print GuroDesk branding, AI-use details, tool disclaimers, or curriculum-source provenance. Internal audit/provenance data remains available inside the application and database where needed.

The default document order is:

1. Lesson details
2. **I. Intentions**
   - Learning Competency and Curriculum Standards
   - Learning Objectives
   - Learner Context
3. **L. Learning Experience**
   - Pre-Lesson
   - Lesson Flow
   - Learning Resources
   - Opportunities for Integration and Contextualization
   - Inclusion and Accommodations
   - Learning Continuity / Home-Based Alternative
4. **A. Assessing Learning**
   - Formative Assessment
   - Evidence of Learning
5. **W. Ways Forward**
   - Extended Learning Opportunities
   - Next Steps / Intervention
   - Reflection
6. Signatures

## Export architecture

```text
saved structured lesson
+ teacher profile
+ teacher_export_preferences
        |
        v
LessonPlanExportModel
   |       |        |
 HTML    DOCX      PDF
preview  docx lib  jsPDF
```

PDF/DOCX bytes are generated in the teacher's browser and downloaded locally. GuroDesk does not upload generated file bytes back to Supabase in this phase.

## Export settings

`teacher_export_preferences` stores:

- paper size: A4 / Letter / Legal
- default template ID
- Prepared by name/title
- Reviewed by name/title
- Noted by name/title

Two older database flags for AI/provenance inclusion remain only for schema compatibility. Phase 3.6.1 ignores them for printable lesson-plan exports.

## Future template support

The template ID is stored even though this phase ships with one visible template. Later additions may include school/division-specific layouts after verification.

Do not automatically embed seals/logos without explicit authorization and a separate asset policy.

## Migration

`202608080009_phase36_export_preferences.sql`

No new migration is required for Phase 3.6.1 because the cleanup is purely an export-rendering change.

## Validation

```bash
npm run validate:phase36
npm run validate:phase361
```
