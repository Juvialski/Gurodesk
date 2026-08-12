-- Visual checkpoint RPC guard hotfix.
--
-- Migration 027 introduced the narrow optimistic checkpoint RPC but omitted
-- the transaction-local app.assessment_rpc flag required by the existing
-- assessment_items/documents write guards. Replacing the function here keeps
-- already-applied databases upgrade-safe without weakening direct-write RLS.

-- Visual reliability release: narrow, optimistic visual checkpoint persistence.
-- Updates only the reserved visual keys inside assessment_items.answer so a
-- delayed visual save can never overwrite newer teacher edits elsewhere.

create or replace function public.save_assessment_item_visual_checkpoint(
  p_document_id uuid,
  p_item_id uuid,
  p_expected_question_type text,
  p_expected_prompt text,
  p_expected_answer jsonb,
  p_visual jsonb default null,
  p_visual_plan jsonb default '{}'::jsonb
)
returns public.assessment_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  document_row public.documents%rowtype;
  item_row public.assessment_items%rowtype;
  base_answer jsonb;
  next_answer jsonb;
  item_mirror jsonb;
  plan_requirement text;
  plan_status text;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if p_document_id is null or p_item_id is null then raise exception 'Assessment document and item are required'; end if;
  if jsonb_typeof(coalesce(p_expected_answer, '{}'::jsonb)) is distinct from 'object' then raise exception 'Expected assessment answer must be an object'; end if;
  if jsonb_typeof(coalesce(p_visual_plan, '{}'::jsonb)) is distinct from 'object' then raise exception 'Visual plan must be an object'; end if;
  if p_visual is not null and jsonb_typeof(p_visual) is distinct from 'object' then raise exception 'Visual payload must be an object'; end if;
  if octet_length(coalesce(p_visual::text, '')) > 1024 * 1024 or octet_length(coalesce(p_visual_plan::text, '')) > 16384 then raise exception 'Visual checkpoint payload is too large'; end if;

  -- This narrow security-definer RPC is an authorized assessment write path.
  -- The assessment item/document triggers intentionally reject writes unless
  -- the transaction-local save guard is enabled, just like the full save RPC.
  perform set_config('app.assessment_rpc', '1', true);

  select * into document_row
  from public.documents d
  where d.id = p_document_id
    and d.user_id = owner_id
    and d.document_type = 'assessment'
  for update;
  if document_row.id is null then raise exception 'Assessment document not found'; end if;
  if document_row.status <> 'draft' then raise exception 'Only draft assessments can receive visual checkpoints'; end if;

  select * into item_row
  from public.assessment_items ai
  where ai.assessment_document_id = p_document_id
    and ai.id = p_item_id
  for update;
  if item_row.id is null then raise exception 'Assessment item not found'; end if;
  if item_row.locked then raise exception 'Locked assessment items cannot receive a visual checkpoint'; end if;

  base_answer := coalesce(item_row.answer, '{}'::jsonb) - '_visual' - '_visualPlan';
  if item_row.question_type::text is distinct from coalesce(p_expected_question_type, '')
     or coalesce(item_row.prompt, '') is distinct from coalesce(p_expected_prompt, '')
     or base_answer is distinct from (coalesce(p_expected_answer, '{}'::jsonb) - '_visual' - '_visualPlan') then
    raise exception 'Assessment item changed elsewhere; stale visual checkpoint rejected';
  end if;

  plan_requirement := coalesce(p_visual_plan ->> 'requirement', 'none');
  plan_status := coalesce(p_visual_plan ->> 'status', case when p_visual is null then 'failed' else 'succeeded' end);
  if plan_requirement not in ('none', 'helpful', 'required') then raise exception 'Unsupported visual requirement'; end if;
  if plan_status not in ('not_required', 'pending', 'running', 'succeeded', 'failed', 'stale') then raise exception 'Unsupported visual status'; end if;
  if char_length(coalesce(p_visual_plan ->> 'intent', '')) > 500
     or char_length(coalesce(p_visual_plan ->> 'error', '')) > 600
     or char_length(coalesce(p_visual_plan ->> 'sourceHash', '')) > 80
     or char_length(coalesce(p_visual_plan ->> 'updatedAt', '')) > 80 then
    raise exception 'Visual plan text exceeds supported bounds';
  end if;

  next_answer := base_answer || jsonb_build_object('_visualPlan', p_visual_plan);
  if p_visual is not null then next_answer := next_answer || jsonb_build_object('_visual', p_visual); end if;

  update public.assessment_items ai
  set answer = next_answer
  where ai.id = item_row.id
  returning * into item_row;

  -- Keep the canonical document mirror synchronized from current relational
  -- rows. Rebuilding only the items array from database state means a delayed
  -- visual checkpoint cannot overwrite newer title/settings/teacher edits,
  -- while duplication and reopen paths still see the persisted diagram.
  select coalesce(jsonb_agg(public.assessment_item_mirror(ai) order by ai.item_number), '[]'::jsonb)
    into item_mirror
  from public.assessment_items ai
  where ai.assessment_document_id = p_document_id;

  update public.documents d
  set structured_content = jsonb_set(coalesce(d.structured_content, '{}'::jsonb), '{items}', item_mirror, true)
  where d.id = p_document_id;

  return item_row;
end;
$$;

revoke all on function public.save_assessment_item_visual_checkpoint(uuid, uuid, text, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_assessment_item_visual_checkpoint(uuid, uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
