begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(14);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, raw_app_meta_data)
values
  ('e7000000-0000-0000-0000-0000000000a1', 'zz-rec-admin@zztest.local', '{"role":"admin"}'),
  ('e7000000-0000-0000-0000-0000000000a2', 'zz-rec-member@zztest.local', '{"role":"member"}');

insert into public.students (id, child_first_name, child_last_name)
values ('e7000000-0000-0000-0000-000000000051', 'ZZTEST', 'Avstemming');

insert into public.payments (id, student_id, reference, amount, status, method, authorized_amount, captured_amount)
values ('e7000000-0000-0000-0000-0000000000b1', 'e7000000-0000-0000-0000-000000000051', 'zztest-rec-1', 50000, 'fanget', 'vipps', 50000, 50000);

insert into public.sadaqa_gifts (id, amount, received_on, method)
values ('e7000000-0000-0000-0000-0000000000c1', 20000, '2026-09-05', 'vipps');

insert into public.import_batches (id, source, kind, account, created_by)
values ('e7000000-0000-0000-0000-0000000000d1', 'vipps', 'fil', '60206', 'zztest');

insert into public.external_transactions (id, source, account, external_id, booked_on, amount, import_batch_id)
values
  ('e7000000-0000-0000-0000-0000000000e1', 'vipps', '60206', 'psp:zz1:capture', '2026-09-05', 20000, 'e7000000-0000-0000-0000-0000000000d1'),
  ('e7000000-0000-0000-0000-0000000000e2', 'vipps', '610090', 'psp:zz2:capture', '2026-09-06', 50000, 'e7000000-0000-0000-0000-0000000000d1'),
  ('e7000000-0000-0000-0000-0000000000e3', 'dnb', '12345678901', 'dnb:zz3', '2026-09-06', 50000, null);

select throws_ok(
  $$ insert into public.external_transactions (source, account, external_id, booked_on, amount)
     values ('vipps', '60206', 'psp:zz1:capture', '2026-09-05', 20000) $$,
  '23505',
  null,
  'the same external id cannot be imported twice for one account'
);

select lives_ok(
  $$ insert into public.external_transactions (source, account, external_id, booked_on, amount)
     values ('vipps', '610090', 'psp:zz1:capture', '2026-09-05', 20000) $$,
  'the same external id is allowed on another account'
);

select throws_ok(
  $$ update public.external_transactions set status = 'sadaqa' where id = 'e7000000-0000-0000-0000-0000000000e1' $$,
  '23514',
  null,
  'sadaqa status needs a gift'
);

select throws_ok(
  $$ update public.external_transactions set status = 'ignorert' where id = 'e7000000-0000-0000-0000-0000000000e1' $$,
  '23514',
  null,
  'ignoring needs a reason'
);

select throws_ok(
  $$ update public.external_transactions set matched_payment_id = 'e7000000-0000-0000-0000-0000000000b1' where id = 'e7000000-0000-0000-0000-0000000000e2' $$,
  '23514',
  null,
  'an open transaction cannot point at a payment'
);

select throws_ok(
  $$ insert into public.external_transactions (source, account, external_id, booked_on, amount)
     values ('vipps', '60206', 'psp:zz-zero:capture', '2026-09-05', 0) $$,
  '23514',
  null,
  'zero amounts are refused'
);

select set_config('request.jwt.claims', '{"sub":"e7000000-0000-0000-0000-0000000000a2","email":"zz-rec-member@zztest.local","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.external_transactions),
  0::bigint,
  'a non-admin sees no transactions'
);

select is(
  (select count(*) from public.import_batches),
  0::bigint,
  'a non-admin sees no import batches'
);

select throws_ok(
  $$ insert into public.external_transactions (source, account, external_id, booked_on, amount)
     values ('vipps', '60206', 'psp:zz-member:capture', '2026-09-05', 100) $$,
  '42501',
  null,
  'a non-admin cannot insert transactions'
);

select set_config('request.jwt.claims', '{"sub":"e7000000-0000-0000-0000-0000000000a1","email":"zz-rec-admin@zztest.local","role":"authenticated"}', true);

select is(
  (select count(*) from public.external_transactions where account in ('60206', '610090', '12345678901') and external_id like '%zz%'),
  4::bigint,
  'an admin sees the transactions'
);

select lives_ok(
  $$ update public.external_transactions
     set status = 'sadaqa', sadaqa_gift_id = 'e7000000-0000-0000-0000-0000000000c1', mapped_at = now(), mapped_by = 'zztest'
     where id = 'e7000000-0000-0000-0000-0000000000e1' $$,
  'an admin can map a transaction to a sadaqa gift'
);

select lives_ok(
  $$ update public.external_transactions
     set status = 'matchet', matched_payment_id = 'e7000000-0000-0000-0000-0000000000b1', mapped_at = now()
     where id = 'e7000000-0000-0000-0000-0000000000e2' $$,
  'an admin can link a transaction to a payment'
);

select throws_ok(
  $$ update public.external_transactions
     set status = 'matchet', matched_payment_id = 'e7000000-0000-0000-0000-0000000000b1', mapped_at = now()
     where id = 'e7000000-0000-0000-0000-0000000000e3' $$,
  '23505',
  null,
  'one payment cannot be linked to two transactions'
);

reset role;
set local role anon;

select throws_ok(
  $$ select count(*) from public.external_transactions $$,
  '42501',
  null,
  'anon cannot read transactions'
);

select * from finish();

rollback;
