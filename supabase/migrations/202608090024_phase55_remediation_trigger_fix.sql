-- Phase 5.5 corrective migration 024.
--
-- The Phase 5.3 remediation child trigger is shared by both
-- remediation_plan_targets and remediation_plan_participants. The original
-- function referenced NEW.result_session_id inside a boolean expression even
-- when firing for remediation_plan_targets, which has no such column. PostgreSQL
-- can resolve that field access before boolean short-circuiting and raises:
--   record "new" has no field "result_session_id"
--
-- Keep the shared trigger architecture and ownership/RPC guards, but read the
-- participant-only field only inside the participant-table branch.

create or replace function public.guard_remediation_child_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_owner uuid;
  plan_state text;
  plan_session_id uuid;
  child_session_id uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'Authenticated owner is required';
  end if;

  select rp.user_id, rp.review_state, rp.result_session_id
    into plan_owner, plan_state, plan_session_id
  from public.remediation_plans rp
  where rp.id = new.remediation_plan_id;

  if plan_owner is null
     or plan_owner is distinct from new.user_id
     or plan_state = 'archived' then
    raise exception 'Remediation child row must belong to its active plan owner';
  end if;

  if coalesce(current_setting('app.remediation_rpc', true), '') <> '1' then
    raise exception 'Remediation child rows must be written through the remediation RPC';
  end if;

  if tg_table_name = 'remediation_plan_participants' then
    child_session_id := nullif(to_jsonb(new) ->> 'result_session_id', '')::uuid;
    if child_session_id is distinct from plan_session_id then
      raise exception 'Remediation participant must belong to the plan result session';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.remediation_plan_id is distinct from old.remediation_plan_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Remediation child identity is immutable';
  end if;

  return new;
end;
$$;

-- Triggers already point to public.guard_remediation_child_owner(); CREATE OR
-- REPLACE keeps those trigger bindings intact. Revoke direct function execution
-- because it is a trigger implementation detail, not a client RPC.
revoke all on function public.guard_remediation_child_owner() from public, anon, authenticated;
