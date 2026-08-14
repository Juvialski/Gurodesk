-- GuroDesk additive migration 042: restore guarded assessment draft saves.
--
-- Migration 041 added lesson quizzes, unit quizzes, performance tasks, and
-- rubric scoring, but its replacement save_assessment_document() body omitted
-- mature protections for persisted assessment item identity, locked-item edits,
-- and the immutable TOS blueprint used by standard assessments.
--
-- Do NOT rewrite migration 041: it may already be recorded in production.
-- Instead, patch the currently installed 041 multi-mode RPC in place so every
-- new mode/rubric behavior remains intact while the prior save invariants are
-- restored. The patch is fail-closed: it refuses to run if the expected 041
-- function shape is not present exactly once.

DO $migration$
DECLARE
  target_oid oid := to_regprocedure(
    'public.save_assessment_document(uuid,uuid,uuid,text,text,text,text,text,jsonb,jsonb,text)'
  );
  function_definition text;
  changed boolean := false;

  old_assignment_fragment text := $old_assignment$
if p_assignment_id is distinct from assessment_row.assignment_id then
      raise exception 'The assignment for an existing assessment cannot be changed';
    end if;
$old_assignment$;

  guarded_assignment_fragment text := $new_assignment$
if req_mode = 'standard'
       and (
         p_assignment_id is distinct from assessment_row.assignment_id
         or p_source_tos_document_id is distinct from assessment_row.source_tos_document_id
       ) then
      -- Preserve the mature standard-assessment compatibility contract used by
      -- the repository and integration tests. Non-TOS modes keep the newer
      -- assignment-only rule below.
      raise exception 'Assessment assignment and source cannot change';
    elsif p_assignment_id is distinct from assessment_row.assignment_id then
      raise exception 'The assignment for an existing assessment cannot be changed';
    end if;
$new_assignment$;

  delete_fragment text := E'delete from public.assessment_items\n  where assessment_document_id = saved.id;';

  guarded_delete_fragment text := $guard$
-- Assessment item save guard patch 042.
  if p_document_id is not null then
    -- Every persisted item-based assessment must use unique item UUIDs. Missing
    -- IDs are rejected here too because count(distinct null) does not increase.
    if (
      select count(distinct elem.value ->> 'id')
      from jsonb_array_elements(p_items) as elem(value)
    ) <> item_count then
      raise exception 'Assessment item UUIDs must be unique within a saved assessment';
    end if;

    -- Standard assessments are immutable projections of a finalized TOS
    -- blueprint. A client may edit question content, but it may not rewrite the
    -- persisted TOS row/competency/cognitive/allocation mapping or its matching
    -- snapshots. Lesson/unit modes intentionally do not use this TOS-only rule.
    if req_mode = 'standard' and exists (
      select 1
      from public.assessment_items existing_ai
      join lateral (
        select elem.value as item
        from jsonb_array_elements(p_items) as elem(value)
        where elem.value ->> 'id' = existing_ai.id::text
        limit 1
      ) incoming on true
      where existing_ai.assessment_document_id = saved.id
        and (
          incoming.item ->> 'itemNumber' is distinct from existing_ai.item_number::text
          or incoming.item -> 'mapping' ->> 'rowId' is distinct from existing_ai.tos_row_id::text
          or incoming.item -> 'mapping' ->> 'competencyId' is distinct from existing_ai.canonical_competency_id::text
          or incoming.item -> 'mapping' ->> 'cognitiveCategoryId' is distinct from existing_ai.cognitive_category_id
          or incoming.item -> 'mapping' ->> 'allocationItemStart' is distinct from existing_ai.allocation_item_start::text
          or incoming.item -> 'mapping' ->> 'allocationItemEnd' is distinct from existing_ai.allocation_item_end::text
          or incoming.item -> 'mapping' ->> 'allocationIndex' is distinct from existing_ai.allocation_index::text
          or incoming.item -> 'competencySnapshot' ->> 'id' is distinct from existing_ai.canonical_competency_id::text
          or incoming.item -> 'cognitiveCategorySnapshot' ->> 'id' is distinct from existing_ai.cognitive_category_id
          or incoming.item -> 'cognitiveCategorySnapshot' ->> 'label' is distinct from existing_ai.cognitive_category_label_snapshot
          or incoming.item -> 'cognitiveCategorySnapshot' ->> 'shortLabel' is distinct from existing_ai.cognitive_category_short_label_snapshot
        )
    ) then
      raise exception 'Assessment item mappings do not match the finalized TOS blueprint';
    end if;

    -- Locked items are immutable unless that exact persisted item is explicitly
    -- unlocked in the incoming payload. This is mode-agnostic and therefore
    -- also protects locked lesson-quiz and unit-quiz questions.
    for existing_item in
      select ai.*
      from public.assessment_items ai
      where ai.assessment_document_id = saved.id
        and ai.locked
      for update
    loop
      incoming_item := null;

      select elem.value
      into incoming_item
      from jsonb_array_elements(p_items) as elem(value)
      where elem.value ->> 'id' = existing_item.id::text
      limit 1;

      if incoming_item is null then
        raise exception 'Locked assessment item is missing from the save payload';
      end if;

      if coalesce((incoming_item ->> 'locked')::boolean, true)
         and (
           coalesce(incoming_item ->> 'prompt', '') is distinct from existing_item.prompt
           or coalesce(incoming_item -> 'answer', '{}'::jsonb) is distinct from existing_item.answer
           or coalesce(nullif(incoming_item ->> 'questionType', ''), 'multiple_choice')
                is distinct from existing_item.question_type::text
           or coalesce(
                nullif(incoming_item ->> 'pointsPossible', '')::numeric,
                nullif(incoming_item ->> 'points', '')::numeric,
                1
              ) is distinct from existing_item.points_possible
           or coalesce(incoming_item ->> 'rationale', '') is distinct from existing_item.rationale
           or coalesce(incoming_item ->> 'teacherNotes', '') is distinct from existing_item.teacher_notes
         ) then
        raise exception 'Locked assessment item cannot be changed until explicitly unlocked';
      end if;
    end loop;

    -- Existing item UUIDs remain stable at any item number that survives the
    -- save. This permits lesson/unit quizzes to grow or shrink at the end while
    -- preventing silent identity swaps for retained item positions. Standard
    -- assessments already have a fixed TOS-derived item count.
    if exists (
      select 1
      from public.assessment_items existing_ai
      where existing_ai.assessment_document_id = saved.id
        and exists (
          select 1
          from jsonb_array_elements(p_items) as incoming_number(value)
          where incoming_number.value ->> 'itemNumber' = existing_ai.item_number::text
        )
        and not exists (
          select 1
          from jsonb_array_elements(p_items) as incoming_value(value)
          where incoming_value.value ->> 'itemNumber' = existing_ai.item_number::text
            and incoming_value.value ->> 'id' = existing_ai.id::text
        )
    ) then
      raise exception 'Existing assessment item UUIDs are stable and cannot change on draft save';
    end if;
  end if;

  delete from public.assessment_items
  where assessment_document_id = saved.id;
$guard$;

  occurrence_count integer;
BEGIN
  if target_oid is null then
    raise exception 'Expected multi-mode save_assessment_document RPC was not found';
  end if;

  select pg_get_functiondef(target_oid)
  into function_definition;

  -- Restore the mature standard-assessment assignment/source error contract.
  -- Skip only when that exact repair is already present (idempotent replay).
  if position('Assessment assignment and source cannot change' in function_definition) = 0 then
    occurrence_count := (
      length(function_definition)
      - length(replace(function_definition, old_assignment_fragment, ''))
    ) / nullif(length(old_assignment_fragment), 0);

    if occurrence_count <> 1 then
      raise exception
        'Refusing migration 042: expected exactly one existing-assessment assignment guard, found %',
        occurrence_count;
    end if;

    function_definition := replace(
      function_definition,
      old_assignment_fragment,
      guarded_assignment_fragment
    );
    changed := true;
  end if;

  -- Restore immutable TOS mappings, locked-item protection, UUID uniqueness,
  -- and stable persisted item identity immediately before 041's synchronization
  -- delete/reinsert block. The surrounding 041 implementation is untouched.
  if position('Assessment item save guard patch 042' in function_definition) = 0 then
    occurrence_count := (
      length(function_definition)
      - length(replace(function_definition, delete_fragment, ''))
    ) / nullif(length(delete_fragment), 0);

    if occurrence_count <> 1 then
      raise exception
        'Refusing migration 042: expected exactly one assessment-item synchronization delete, found %',
        occurrence_count;
    end if;

    function_definition := replace(
      function_definition,
      delete_fragment,
      guarded_delete_fragment
    );
    changed := true;
  end if;

  if changed then
    execute function_definition;
    target_oid := to_regprocedure(
      'public.save_assessment_document(uuid,uuid,uuid,text,text,text,text,text,jsonb,jsonb,text)'
    );
  end if;

  -- Fail closed if any required invariant did not survive CREATE OR REPLACE.
  select pg_get_functiondef(target_oid)
  into function_definition;

  if position('Assessment assignment and source cannot change' in function_definition) = 0
     or position('Assessment item mappings do not match the finalized TOS blueprint' in function_definition) = 0
     or position('Locked assessment item cannot be changed until explicitly unlocked' in function_definition) = 0
     or position('Existing assessment item UUIDs are stable and cannot change on draft save' in function_definition) = 0 then
    raise exception 'Migration 042 could not verify the restored assessment save guards';
  end if;
END
$migration$;

-- Re-assert the intended execution surface without changing function ownership
-- or any service-role privileges already present on the RPC.
revoke all on function public.save_assessment_document(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text
) from public;
grant execute on function public.save_assessment_document(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, text
) to authenticated;
