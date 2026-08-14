-- GuroDesk migration 044: repair standard assessment snapshot insertion.
--
-- Why this exists:
-- Migration 043 restored the strict migration-037 metadata guard, which requires
-- source_tos_content_snapshot to equal assessment_canonical_tos_snapshot(...).
-- The current multi-mode save_assessment_document() from migrations 041/042
-- still inserts the raw TOS structured_content into BOTH the canonical and raw
-- snapshot columns. Because canonicalized TOS snapshots differ from raw TOS
-- content, every new standard assessment is rejected before its items are saved.
--
-- Keep the strict guard unchanged. Instead, prepare the two trusted snapshot
-- columns from the validated TOS document immediately before the metadata guard
-- runs. PostgreSQL fires same-event triggers in name order, so the 00-prefixed
-- trigger runs before assessment_metadata_guard.
--
-- This is intentionally limited to INSERT + standard mode. Existing assessment
-- snapshots remain immutable and lesson/unit/performance-task provenance is not
-- touched.

create or replace function public.prepare_standard_assessment_snapshots()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_row public.documents%rowtype;
begin
  if coalesce(nullif(new.mode, ''), 'standard') <> 'standard' then
    return new;
  end if;

  if new.source_tos_document_id is null then
    return new;
  end if;

  select *
  into source_row
  from public.documents d
  where d.id = new.source_tos_document_id
    and d.document_type = 'tos'
    and d.status in ('final', 'archived');

  -- Leave invalid/missing sources untouched so the existing strict metadata
  -- guard remains the authority that rejects them.
  if source_row.id is null then
    return new;
  end if;

  new.source_tos_raw_content_snapshot := source_row.structured_content;
  new.source_tos_content_snapshot := public.assessment_canonical_tos_snapshot(source_row.id);

  return new;
end;
$$;

revoke all on function public.prepare_standard_assessment_snapshots() from public;

drop trigger if exists assessment_metadata_00_prepare_standard_snapshots
  on public.assessment_documents;

create trigger assessment_metadata_00_prepare_standard_snapshots
before insert on public.assessment_documents
for each row
execute function public.prepare_standard_assessment_snapshots();
