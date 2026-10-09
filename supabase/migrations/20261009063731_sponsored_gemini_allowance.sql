-- Additive, server-owned provider accounting. No production data is rewritten.
create schema if not exists gurodesk_ai_private;
revoke all on schema gurodesk_ai_private from public, anon, authenticated;
grant usage on schema gurodesk_ai_private to service_role;

create table gurodesk_ai_private.budget (
  singleton boolean primary key default true check (singleton),
  daily_limit integer not null default 2000 check (daily_limit between 1 and 100000),
  minute_limit integer not null default 120 check (minute_limit between 1 and 10000),
  provider_blocked_until timestamptz,
  enabled boolean not null default true
);
insert into gurodesk_ai_private.budget(singleton) values (true);
create table gurodesk_ai_private.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  ordinal integer not null check (ordinal between 1 and 100),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  model text not null check (length(model) between 1 and 100),
  allowance_day date not null,
  state text not null default 'reserved' check (state in ('reserved', 'dispatched', 'cancelled')),
  reserved_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '2 minutes'),
  dispatched_at timestamptz,
  completed_at timestamptz,
  http_status integer check (http_status between 100 and 599),
  outcome text not null default 'pending' check (outcome in ('pending', 'response', 'network_unknown')),
  unique (user_id, request_id, ordinal)
);
create index sponsored_calls_day on gurodesk_ai_private.calls(allowance_day, state);
create index sponsored_calls_user_day on gurodesk_ai_private.calls(user_id, allowance_day, state);
create index sponsored_calls_rate on gurodesk_ai_private.calls(reserved_at);
alter table gurodesk_ai_private.budget enable row level security;
alter table gurodesk_ai_private.calls enable row level security;
revoke all on gurodesk_ai_private.budget, gurodesk_ai_private.calls from public, anon, authenticated;
grant select, insert, update on gurodesk_ai_private.budget, gurodesk_ai_private.calls to service_role;

-- The service role is the only caller; user IDs come from Edge auth.getUser(), never request bodies.
create function public.reserve_sponsored_ai_call(p_user_id uuid, p_request_id uuid, p_ordinal integer, p_fingerprint text, p_model text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  config gurodesk_ai_private.budget%rowtype;
  prior gurodesk_ai_private.calls%rowtype;
  call_id uuid;
  now_at timestamptz := clock_timestamp();
  day_at date := (now_at at time zone 'Asia/Manila')::date;
  teacher_calls integer;
  global_calls integer;
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Service role required' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'Authenticated teacher required' using errcode = '42501'; end if;
  if p_request_id is null or p_ordinal is null or p_ordinal not between 1 and 100 or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_model is null or length(p_model) not between 1 and 100 then raise exception 'Invalid accounting request' using errcode = '22023'; end if;
  -- One short global row lock serializes admission across functions/tabs/users.
  select * into config from gurodesk_ai_private.budget where singleton for update;
  if not config.enabled then return jsonb_build_object('allowed', false, 'code', 'global_budget_exhausted'); end if;
  select * into prior from gurodesk_ai_private.calls where user_id = p_user_id and request_id = p_request_id and ordinal = p_ordinal;
  if found then return jsonb_build_object('allowed', false, 'code', case when prior.fingerprint = p_fingerprint then 'duplicate' else 'idempotency_conflict' end); end if;
  if config.provider_blocked_until > now_at then return jsonb_build_object('allowed', false, 'code', 'provider_quota_exhausted'); end if;
  select count(*), count(*) filter (where user_id = p_user_id) into global_calls, teacher_calls
    from gurodesk_ai_private.calls where allowance_day = day_at and (state = 'dispatched' or (state = 'reserved' and expires_at > now_at));
  if teacher_calls >= 20 then return jsonb_build_object('allowed', false, 'code', 'allowance_exhausted'); end if;
  if global_calls >= config.daily_limit then return jsonb_build_object('allowed', false, 'code', 'global_budget_exhausted'); end if;
  if (select count(*) from gurodesk_ai_private.calls where reserved_at > now_at - interval '1 minute') >= config.minute_limit
    or (select count(*) from gurodesk_ai_private.calls where user_id = p_user_id and reserved_at > now_at - interval '1 minute') >= 20 then
    return jsonb_build_object('allowed', false, 'code', 'rate_limited');
  end if;
  insert into gurodesk_ai_private.calls(user_id, request_id, ordinal, fingerprint, model, allowance_day, reserved_at, expires_at)
    values(p_user_id, p_request_id, p_ordinal, p_fingerprint, p_model, day_at, now_at, now_at + interval '2 minutes') returning id into call_id;
  return jsonb_build_object('allowed', true, 'call_id', call_id, 'remaining', 19 - teacher_calls);
end $$;

create function public.dispatch_sponsored_ai_call(p_call_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare call gurodesk_ai_private.calls%rowtype; now_at timestamptz := clock_timestamp();
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Service role required' using errcode = '42501'; end if;
  -- Same lock order as reserve; expired admission cannot race with a new reservation.
  perform 1 from gurodesk_ai_private.budget where singleton for update;
  select * into call from gurodesk_ai_private.calls where id = p_call_id for update;
  if not found or call.state <> 'reserved' then return jsonb_build_object('allowed', false, 'code', 'duplicate'); end if;
  if call.expires_at <= now_at or call.allowance_day <> (now_at at time zone 'Asia/Manila')::date then
    update gurodesk_ai_private.calls set state = 'cancelled', completed_at = now_at where id = p_call_id;
    return jsonb_build_object('allowed', false, 'code', 'reservation_expired');
  end if;
  if exists (select 1 from gurodesk_ai_private.budget where singleton and (not enabled or provider_blocked_until > now_at)) then
    update gurodesk_ai_private.calls set state = 'cancelled', completed_at = now_at where id = p_call_id;
    return jsonb_build_object('allowed', false, 'code', 'provider_quota_exhausted');
  end if;
  update gurodesk_ai_private.calls set state = 'dispatched', dispatched_at = now_at where id = p_call_id;
  return jsonb_build_object('allowed', true);
end $$;

create function public.finish_sponsored_ai_call(p_call_id uuid, p_http_status integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Service role required' using errcode = '42501'; end if;
  -- Do not refund dispatched errors, safety blocks, malformed outputs, or uncertain network failures.
  if p_http_status = 429 then
    update gurodesk_ai_private.budget set provider_blocked_until = greatest(coalesce(provider_blocked_until, clock_timestamp()), clock_timestamp() + interval '1 minute') where singleton;
  end if;
  update gurodesk_ai_private.calls set completed_at = clock_timestamp(), http_status = p_http_status,
    outcome = case when p_http_status is null then 'network_unknown' else 'response' end
    where id = p_call_id and state = 'dispatched' and completed_at is null;
  return jsonb_build_object('recorded', found);
end $$;

create function public.cancel_sponsored_ai_call(p_call_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Service role required' using errcode = '42501'; end if;
  update gurodesk_ai_private.calls set state = 'cancelled', completed_at = clock_timestamp() where id = p_call_id and state = 'reserved';
  return jsonb_build_object('cancelled', found);
end $$;

-- A narrowly scoped owner-only read; no user can change or provide an allowance-day/counter.
create function public.sponsored_ai_usage()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare teacher uuid := auth.uid(); now_at timestamptz := clock_timestamp(); used integer; day_at date;
begin
  if teacher is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  day_at := (now_at at time zone 'Asia/Manila')::date;
  select count(*) into used from gurodesk_ai_private.calls where user_id = teacher and allowance_day = day_at
    and (state = 'dispatched' or (state = 'reserved' and expires_at > now_at));
  return jsonb_build_object('day', day_at, 'limit', 20, 'remaining', greatest(0, 20 - used),
    'resetsAt', ((day_at + 1)::timestamp at time zone 'Asia/Manila'));
end $$;
revoke all on function public.reserve_sponsored_ai_call(uuid,uuid,integer,text,text), public.dispatch_sponsored_ai_call(uuid), public.finish_sponsored_ai_call(uuid,integer), public.cancel_sponsored_ai_call(uuid), public.sponsored_ai_usage() from public, anon, authenticated;
grant execute on function public.reserve_sponsored_ai_call(uuid,uuid,integer,text,text), public.dispatch_sponsored_ai_call(uuid), public.finish_sponsored_ai_call(uuid,integer), public.cancel_sponsored_ai_call(uuid) to service_role;
grant execute on function public.sponsored_ai_usage() to authenticated;
