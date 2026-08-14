-- GuroDesk document-version snapshot metadata compatibility.
--
-- Migration 202608140041_assessment_provenance_and_rubric_scoring.sql stores
-- immutable assessment-version metadata in public.document_versions:
-- title, status, and created_by.
--
-- The original Phase 1 table predates those metadata fields. Add them
-- additively before migration 040/041 so:
--   * existing historical rows and structured_content remain untouched;
--   * migration 041 can write its intended richer version snapshot;
--   * production upgrade and fresh/CI migration paths share the same schema.
--
-- Existing rows deliberately remain NULL for the new fields. Backfilling from
-- today's public.documents row could falsely rewrite historical title/status
-- meaning.

alter table public.document_versions
  add column if not exists title text,
  add column if not exists status text,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

comment on column public.document_versions.title is
  'Optional title captured at version creation time; legacy versions remain NULL.';
comment on column public.document_versions.status is
  'Optional document status captured at version creation time; legacy versions remain NULL.';
comment on column public.document_versions.created_by is
  'Optional author captured at version creation time; legacy versions remain NULL.';
