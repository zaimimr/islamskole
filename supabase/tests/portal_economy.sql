begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(12);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, raw_app_meta_data)
values
  ('ec000000-0000-0000-0000-0000000000a1', 'zz-ec-parent-a@zztest.local', '{"role":"member"}'),
  ('ec000000-0000-0000-0000-0000000000a2', 'zz-ec-parent-b@zztest.local', '{"role":"member"}'),
  ('ec000000-0000-0000-0000-0000000000a3', 'zz-ec-stranger@zztest.local', '{"role":"member"}');

update public.school_years set is_active = false where is_active;

insert into public.school_years (id, label, starts_on, ends_on, is_active)
values (
  'ec000000-0000-0000-0000-000000000001',
  'ZZTEST EC aktiv',
  (now() at time zone 'Europe/Oslo')::date - 60,
  (now() at time zone 'Europe/Oslo')::date + 200,
  true
);

insert into public.families (id, display_name, origin)
values
  ('ec000000-0000-0000-0000-0000000000f1', 'ZZTEST Familie A', 'test'),
  ('ec000000-0000-0000-0000-0000000000f2', 'ZZTEST Familie B', 'test');

insert into public.guardians (id, first_name, last_name, email)
values
  ('ec000000-0000-0000-0000-000000000061', 'ZZTEST', 'Forelder A', 'zz-ec-parent-a@zztest.local'),
  ('ec000000-0000-0000-0000-000000000062', 'ZZTEST', 'Forelder B', 'zz-ec-parent-b@zztest.local');

insert into public.family_guardians (family_id, guardian_id, is_primary_contact)
values
  ('ec000000-0000-0000-0000-0000000000f1', 'ec000000-0000-0000-0000-000000000061', true),
  ('ec000000-0000-0000-0000-0000000000f2', 'ec000000-0000-0000-0000-000000000062', true);

insert into public.students (id, family_id, child_first_name, child_last_name)
values
  ('ec000000-0000-0000-0000-000000000051', 'ec000000-0000-0000-0000-0000000000f1', 'ZZTEST', 'Barn A1'),
  ('ec000000-0000-0000-0000-000000000052', 'ec000000-0000-0000-0000-0000000000f1', 'ZZTEST', 'Barn A2'),
  ('ec000000-0000-0000-0000-000000000053', 'ec000000-0000-0000-0000-0000000000f2', 'ZZTEST', 'Barn B1');

insert into public.student_fees (student_id, school_year_id, amount)
values
  ('ec000000-0000-0000-0000-000000000051', 'ec000000-0000-0000-0000-000000000001', 500000),
  ('ec000000-0000-0000-0000-000000000052', 'ec000000-0000-0000-0000-000000000001', 400000),
  ('ec000000-0000-0000-0000-000000000053', 'ec000000-0000-0000-0000-000000000001', 300000);

insert into public.payments (
  id, school_year_id, reference, amount, status, method, authorized_amount, captured_amount, refunded_amount, paid_at
) values
  ('ec000000-0000-0000-0000-0000000000b1', 'ec000000-0000-0000-0000-000000000001', 'zztest-ec-paid-a', 300000, 'fanget', 'vipps', 300000, 300000, 0, now()),
  ('ec000000-0000-0000-0000-0000000000b2', 'ec000000-0000-0000-0000-000000000001', 'zztest-ec-paid-b', 100000, 'fanget', 'vipps', 100000, 100000, 0, now());

insert into public.payments (id, school_year_id, student_id, reference, amount, status, method)
values ('ec000000-0000-0000-0000-0000000000b3', 'ec000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000051', 'zztest-ec-open-a', 200000, 'opprettet', 'vipps');

select public.replace_payment_allocations(
  'ec000000-0000-0000-0000-0000000000b1',
  jsonb_build_array(jsonb_build_object('student_id', 'ec000000-0000-0000-0000-000000000051', 'amount', 300000))
);
select public.replace_payment_allocations(
  'ec000000-0000-0000-0000-0000000000b2',
  jsonb_build_array(jsonb_build_object('student_id', 'ec000000-0000-0000-0000-000000000053', 'amount', 100000))
);

insert into public.payment_plans (id, family_id, school_year_id, plan_type, created_by)
values ('ec000000-0000-0000-0000-0000000000e1', 'ec000000-0000-0000-0000-0000000000f1', 'ec000000-0000-0000-0000-000000000001', 'semester', 'zztest');

insert into public.installments (plan_id, student_id, school_year_id, due_date, amount, status)
values
  ('ec000000-0000-0000-0000-0000000000e1', 'ec000000-0000-0000-0000-000000000051', 'ec000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/Oslo')::date + 30, 100000, 'planlagt'),
  ('ec000000-0000-0000-0000-0000000000e1', 'ec000000-0000-0000-0000-000000000052', 'ec000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/Oslo')::date + 30, 200000, 'planlagt'),
  ('ec000000-0000-0000-0000-0000000000e1', 'ec000000-0000-0000-0000-000000000052', 'ec000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/Oslo')::date + 90, 200000, 'planlagt');

select set_config('request.jwt.claims', '{"sub":"ec000000-0000-0000-0000-0000000000a1","email":"zz-ec-parent-a@zztest.local","role":"authenticated"}', true);
set local role authenticated;

create temporary table economy_a on commit drop as
select public.portal_my_economy() as data;

select is(
  (select jsonb_array_length(data) from economy_a),
  1,
  'parent sees exactly one family'
);

select is(
  (select data -> 0 ->> 'family_id' from economy_a),
  'ec000000-0000-0000-0000-0000000000f1',
  'parent sees their own family'
);

select is(
  (select (data -> 0 ->> 'total_remaining')::integer from economy_a),
  600000,
  'total remaining matches the balances'
);

select is(
  (select (child ->> 'remaining')::integer from economy_a, jsonb_array_elements(data -> 0 -> 'children') child
   where child ->> 'student_id' = 'ec000000-0000-0000-0000-000000000051'),
  200000,
  'child remaining matches student_balances'
);

select is(
  (select (child ->> 'paid')::integer from economy_a, jsonb_array_elements(data -> 0 -> 'children') child
   where child ->> 'student_id' = 'ec000000-0000-0000-0000-000000000051'),
  300000,
  'child paid matches student_balances'
);

select is(
  (select jsonb_array_length(data -> 0 -> 'children') from economy_a),
  2,
  'only own children are listed'
);

select is(
  (select jsonb_agg(payment ->> 'id') from economy_a, jsonb_array_elements(data -> 0 -> 'payments') payment),
  '["ec000000-0000-0000-0000-0000000000b1"]'::jsonb,
  'only own paid payments are listed, open and foreign ones are hidden'
);

select is(
  (select data -> 0 -> 'payments' -> 0 -> 'children' from economy_a),
  jsonb_build_array(jsonb_build_object('name', 'ZZTEST Barn A1', 'amount', 300000)),
  'payment shows the split per child'
);

select is(
  (select data -> 0 -> 'installments' -> 0 ->> 'amount' from economy_a),
  '300000',
  'next installment sums siblings due the same day'
);

select set_config('request.jwt.claims', '{"sub":"ec000000-0000-0000-0000-0000000000a2","email":"zz-ec-parent-b@zztest.local","role":"authenticated"}', true);

select is(
  (select jsonb_agg(child ->> 'student_id') from jsonb_array_elements(public.portal_my_economy() -> 0 -> 'children') child),
  '["ec000000-0000-0000-0000-000000000053"]'::jsonb,
  'other parent sees only their own child'
);

select set_config('request.jwt.claims', '{"sub":"ec000000-0000-0000-0000-0000000000a3","email":"zz-ec-stranger@zztest.local","role":"authenticated"}', true);

select is(
  public.portal_my_economy(),
  '[]'::jsonb,
  'user without a family sees nothing'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.portal_my_economy() $$,
  '42501',
  null,
  'anon cannot call portal_my_economy'
);

select * from finish();

rollback;
