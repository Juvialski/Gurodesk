# Reusable teacher document merging

Open **Documents → Fill your template** (`/documents/merge`). `/paperwork` now leads to the implemented Documents workspace.

The workflow uploads a macro-free DOCX/XLSX master, inspects its merge fields locally, suggests teacher/school field sources, permits manual source/value corrections, saves master/mappings to the existing private template infrastructure, generates a completed file, previews it, and downloads an editable replacement. Upload/save operations never overwrite the master; saved masters have a hash check on reload. Filled report/learner values are not saved inside template metadata.

## Fields and blocks

Scalars use `{{school_name}}`, `{{teacher_name}}`, `{{district}}`, `{{grade_level}}`, or other named fields. Snake-case teacher identity fields are suggested automatically. Review the assignment-derived defaults when teaching more than one class. Numeric formats are selectable; real numeric Excel cells are used for numeric values so formulas can consume them. Identifiers remain text and retain leading zeros.

DOCX placeholders may span text runs. Formatting outside the placeholder is retained, and the replacement inherits the starting run's formatting. Word table rows or sibling paragraphs between `{{#questions}}` and `{{/questions}}` repeat for each manually entered record. Options can be a multiline text field. Blocks may also be named competencies, learners, results, or other structurally compatible record groups. Nested blocks are explicitly refused; up to 500 records and 1 MB of merge input are supported.

XLSX opening and closing markers occupy separate rows. Put record placeholders in each **existing** styled data row between them. Filling never inserts or shifts workbook rows. When records exceed the master’s capacity, export is refused with the required capacity; expand the master in Excel and re-upload it. Unmapped formulas stay intact, recalculation is requested on opening, and sheets/styles/merges/widths/heights/named ranges/print areas/page setup remain in place. This avoids guessing how to shift formulas or cross-sheet references.

The existing lesson/DLL/DLP DOCX and TOS XLSX structural-mapping workflows remain available under Settings → Documents for masters without placeholders. Legacy Word paragraph filling now retains run nodes, properties, drawings, math, bookmarks, and section properties. Header/footer identity placeholders are also filled. Existing subject-specific export/scoring contracts are preserved.

## Preview and PDF

Word preview renders the generated DOCX with `docx-preview`; it is a browser approximation rather than certification by Microsoft Word. Excel preview is explicitly a **data preview**. The downloaded workbook retains the master’s layout; Excel/LibreOffice performs actual formula recalculation and print layout.

The current Render deployment is a static frontend and has no native Office converter. The new workflow does not create a screenshot PDF or claim exact Office pagination. Download DOCX/XLSX and use Word/Excel/LibreOffice’s PDF export for faithful output. Existing legacy raster PDF paths elsewhere have not been replaced or certified as vector exports.

## Safety and limits

Archives are limited to 10 MB compressed, 50 MB expanded, 3,000 parts, and 4 MB per XML part. Metadata checks are followed by bounded streaming decompression of actual content, including protection when advertised expanded sizes are false. Macros, active controls, OLE embeddings, XML entities/DOCTYPEs, unsafe paths, broken internal relationships, and external linked document content are refused. Strict/unsupported OOXML is refused rather than mixing incompatible XML namespaces; save a standard copy in Word/Excel first. Normal web/mail hyperlinks may remain. Validation also runs when saving/loading/exporting, not just when choosing a filename.

Student output rejects answer/solution/rubric/scoring data fields. Student master documents must themselves contain no printed sample answers; a generic merger cannot reliably identify arbitrary answer text already printed in an uploaded master. Existing assessment Student Copy continues to use its dedicated answer-free export model.

## Remaining integration work

The reusable merge route currently accepts manually entered record data and profile/assignment scalar mappings. Automatic binding to every saved assessment/result/lesson model, arbitrary no-placeholder structural mapping for all categories, nested option/competency loops, native workbook layout preview, row insertion with cross-sheet formula/range rewriting, and hosted vector PDF conversion remain future work. This is a functional merge workflow, not completion of every planned universal-document adapter.

Realistic synthetic teacher-layout fixtures exercise mixed runs, headings, logos, header/footer identity, tables, signature text, superscript/subscript, repeating questions/options, workbook formulas/styles/merges/print areas and secondary sheets. A headless phone test exercises upload → mappings → repetition → preview → editable download. Actual teacher master files and Microsoft Office rendering were not available for certification.
