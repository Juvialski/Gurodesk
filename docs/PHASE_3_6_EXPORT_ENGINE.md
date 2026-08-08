# Phase 3.6 - Document Export Engine

## Goal

Make finalized GuroDesk work usable outside the app. Lesson plans now have a reusable document model that renders to:

- printable in-app preview
- browser print
- downloadable PDF
- editable Microsoft Word `.docx`

The same export settings/model layer is intended to be reused by Phase 4 TOS, tests, answer keys, rubrics, and later reports.

## First template

`gurodesk_ilaw_standard`

This is a clean ILAW-oriented GuroDesk layout based on the structured lesson data already stored in `documents.structured_content`. It is deliberately labelled as a GuroDesk template rather than claiming to be an official DepEd-issued form.

It does not embed the DepEd seal/logo and includes an independent-tool footer.

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
- include AI-use declaration
- include verified curriculum source provenance

School, region, division, teacher name, and position continue to come from the teacher profile unless overridden for signatory purposes.

## Future template support

The template ID is stored even though Phase 3.6 ships with one template. This allows later additions such as:

- school-specific layouts
- division-approved layouts
- subject-specific layouts
- administrator-managed templates

Do not automatically copy logos/seals from an uploaded template without explicit authorization and a separate asset policy.

## Migration

`202608080009_phase36_export_preferences.sql`

RLS permits each authenticated teacher to read/insert/update only their own export preferences.

## Validation

```bash
npm run validate:phase36
```
