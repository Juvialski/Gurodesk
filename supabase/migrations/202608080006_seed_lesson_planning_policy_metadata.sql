-- GuroDesk Phase 3 policy metadata only.
-- These rows register verified official sources; executable policy rules remain in reviewed application code.

insert into public.source_documents (
  id, source_type, title, issuance_code, source_url, published_on, verification_status
) values
(
  '01600000-0000-4000-8000-000000002026',
  'deped_order',
  'Guidelines on Lesson Planning and Learning Design',
  'DO 016, s. 2026',
  'https://www.deped.gov.ph/wp-content/uploads/DO_s2026_016r.pdf',
  '2026-06-04',
  'verified'
),
(
  '00300000-0000-4000-8000-000000002026',
  'deped_order',
  'Foundational Guidelines on Artificial Intelligence (AI) in Basic Education',
  'DO 003, s. 2026',
  'https://www.deped.gov.ph/wp-content/uploads/DO_s2026_003r.pdf',
  '2026-02-20',
  'verified'
)
on conflict (id) do update set
  title = excluded.title,
  issuance_code = excluded.issuance_code,
  source_url = excluded.source_url,
  published_on = excluded.published_on,
  verification_status = excluded.verification_status,
  updated_at = timezone('utc', now());

insert into public.policy_documents (
  id, source_document_id, policy_category, school_year_from, status
) values
(
  '01610000-0000-4000-8000-000000002026',
  '01600000-0000-4000-8000-000000002026',
  'lesson_planning',
  '2026-2027',
  'active'
),
(
  '00310000-0000-4000-8000-000000002026',
  '00300000-0000-4000-8000-000000002026',
  'artificial_intelligence',
  '2025-2026',
  'active'
)
on conflict (id) do update set
  source_document_id = excluded.source_document_id,
  policy_category = excluded.policy_category,
  school_year_from = excluded.school_year_from,
  status = excluded.status,
  updated_at = timezone('utc', now());
