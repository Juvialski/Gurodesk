# Phase 3.7 — Teacher-owned custom document templates

## Goal

GuroDesk should not force a school to abandon the ILAW/DLP Word format it already uses. A teacher can upload the existing `.docx` master once, map GuroDesk fields to that document, and reuse the exact master for future lesson exports.

## Workflow

1. Settings → Custom templates → upload `.docx` (max 10 MB).
2. Browser parses `word/document.xml` locally and extracts paragraph/table-cell destinations.
3. Optional **one-time** Gemini analysis receives the extracted text structure only — never the raw DOCX bytes.
4. Gemini suggests semantic mappings such as `teacherName`, `competency`, `learningObjectives`, and `lessonFlow` to existing element IDs.
5. Teacher reviews/corrects every mapping with an in-app mobile-safe picker.
6. Original DOCX is uploaded unchanged to the private Supabase Storage bucket `document-templates`.
7. Metadata + deterministic mapping are stored in `document_templates` behind teacher-owned RLS.
8. Future lesson export downloads a copy of the original master, inserts current lesson values into mapped destinations, and downloads the result. **No Gemini call is made during normal export.**

## Formatting preservation

GuroDesk edits only mapped Word paragraph/cell text in a copy of `word/document.xml`. It does not rebuild the document from scratch. The original tables, borders, widths, margins, headers/footers, embedded images, paragraph styles, section settings, and other package parts remain in the master ZIP.

For a destination that already contains a label such as `Teacher: ______`, the mapping can use **Keep label** (`append_after_label`) so only the placeholder/value portion is replaced. Otherwise the destination uses **Replace cell**.

## Output

- **Word:** generated directly from a copy of the teacher's original DOCX; this is the canonical custom-template output.
- **Print preview:** the filled DOCX is rendered in-browser with `docx-preview`.
- **PDF:** the rendered Word pages are captured into a printable PDF. Complex Word pagination can differ slightly between browser rendering and Microsoft Word, so the generated DOCX remains the authoritative exact-template file.

## Storage and security

Migration `202608080011_phase37_custom_document_templates.sql` creates:

- `public.document_templates`
- private Storage bucket `document-templates`
- teacher-owned metadata RLS
- Storage policies scoped to paths beginning with the authenticated teacher UUID

Maximum stored template size is 10 MB.

## TOS/XLSX handoff

The schema already supports:

- `document_type`: `lesson_plan` or `tos`
- `file_type`: `docx` or `xlsx`

Phase 3.7 activates DOCX lesson templates. Phase 4 should reuse the same library and semantic-mapping model for teacher-uploaded XLSX TOS templates while preserving workbook cell styles, merged cells, formulas, row heights, column widths, and print settings.
