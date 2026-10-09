-- Run only on the disposable local database. Entire fixture is rolled back.
begin;
insert into auth.users(id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'quota-sql@example.test');
do $$
declare before_midnight date; after_midnight date; admission jsonb; expired uuid; used integer;
begin
  before_midnight := ('2026-10-09 15:59:59+00'::timestamptz at time zone 'Asia/Manila')::date;
  after_midnight := ('2026-10-09 16:00:00+00'::timestamptz at time zone 'Asia/Manila')::date;
  assert before_midnight = '2026-10-09'::date and after_midnight = '2026-10-10'::date, 'Manila midnight boundary';
  -- A prior-day dispatched call cannot consume today's allowance.
  insert into gurodesk_ai_private.calls(user_id, request_id, ordinal, fingerprint, model, allowance_day, state, dispatched_at)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid(), 1, repeat('a',64), 'fixture', (clock_timestamp() at time zone 'Asia/Manila')::date - 1, 'dispatched', clock_timestamp() - interval '1 day');
  perform set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  assert (public.sponsored_ai_usage()->>'remaining')::integer = 20, 'Prior-day charge leaked into today';
  admission := public.reserve_sponsored_ai_call('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid(), 1, repeat('a',64), 'fixture');
  assert (admission->>'allowed')::boolean, 'Valid reservation rejected';
  expired := (admission->>'call_id')::uuid;
  update gurodesk_ai_private.calls set expires_at = clock_timestamp() - interval '1 second' where id = expired;
  assert public.dispatch_sponsored_ai_call(expired)->>'code' = 'reservation_expired', 'Expired reservation dispatched';
  assert (public.sponsored_ai_usage()->>'remaining')::integer = 20, 'Pre-dispatch expiry charged teacher';
  update gurodesk_ai_private.budget set daily_limit = 1, provider_blocked_until = null;
  admission := public.reserve_sponsored_ai_call('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid(), 1, repeat('a',64), 'fixture');
  assert (admission->>'allowed')::boolean, 'Global budget first call';
  expired := (admission->>'call_id')::uuid;
  assert (public.dispatch_sponsored_ai_call(expired)->>'allowed')::boolean, 'Valid dispatch denied';
  admission := public.reserve_sponsored_ai_call('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid(), 1, repeat('a',64), 'fixture');
  assert admission->>'code' = 'global_budget_exhausted', 'Global budget not enforced';
  perform public.finish_sponsored_ai_call(expired, 429);
  admission := public.reserve_sponsored_ai_call('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid(), 1, repeat('a',64), 'fixture');
  assert admission->>'code' = 'provider_quota_exhausted', 'Shared provider breaker not enforced';
  assert (public.sponsored_ai_usage()->>'remaining')::integer = 19, 'Provider failure refunded or blocked request charged';
  assert not has_function_privilege('anon','public.sponsored_ai_usage()','execute'), 'Anonymous usage read';
  assert not has_function_privilege('authenticated','public.reserve_sponsored_ai_call(uuid,uuid,integer,text,text)','execute'), 'Client can forge counts';
  assert not has_schema_privilege('authenticated','gurodesk_ai_private','usage'), 'Private ledger exposed';
  assert not has_table_privilege('authenticated','gurodesk_ai_private.calls','select,insert,update,delete'), 'Client ledger privilege';
  assert (select relrowsecurity from pg_class where oid='gurodesk_ai_private.calls'::regclass), 'Ledger RLS missing';
end $$;
rollback;
