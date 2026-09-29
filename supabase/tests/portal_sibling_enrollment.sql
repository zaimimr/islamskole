begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(10);

insert into public.school_years (id, label, fee, enrollment_fee)
values ('71000000-0000-0000-0000-000000000001', '2098/2099', 3000, 500);

insert into public.families (id, display_name, address, postal_code, city, origin)
values
  ('71000000-0000-0000-0000-00000000f001', 'Familie Test', 'Gamlevei 2', '1300', 'Sandvika', 'manual'),
  ('71000000-0000-0000-0000-00000000f002', 'Enslig Test', 'Solo 1', '1337', 'Sandvika', 'manual');

insert into public.guardians (id, first_name, last_name, email, phone)
values
  ('71000000-0000-0000-0000-00000000a001', 'Karim', 'Test', 'karim@test.local', '90000001'),
  ('71000000-0000-0000-0000-00000000a002', 'Amina', 'Test', 'amina@test.local', '90000002'),
  ('71000000-0000-0000-0000-00000000a003', 'Solo', 'Test', 'solo@test.local', '90000003');

insert into public.family_guardians (family_id, guardian_id, relationship_label, is_primary_contact, is_billing_contact, sort_order)
values
  ('71000000-0000-0000-0000-00000000f001', '71000000-0000-0000-0000-00000000a001', 'far', true, true, 0),
  ('71000000-0000-0000-0000-00000000f001', '71000000-0000-0000-0000-00000000a002', 'mor', false, false, 1),
  ('71000000-0000-0000-0000-00000000f002', '71000000-0000-0000-0000-00000000a003', 'foresatt', true, true, 0);

select throws_ok(
  $$select public.create_portal_sibling_enrollment(
    '71000000-0000-0000-0000-00000000f001', null, '71000000-0000-0000-0000-000000000001',
    'isk-sibling-denied', 50000, 'Innmelding', 'Gamlevei 2', '1300', 'Sandvika',
    '{"child_first_name":"Noor","child_last_name":"Test","child_birth_date":"2019-02-02","child_gender":"jente","terms_accepted":true}'::jsonb
  )$$,
  '42501',
  null,
  'only service_role can create sibling enrollments'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temporary table sibling_result as
select public.create_portal_sibling_enrollment(
  '71000000-0000-0000-0000-00000000f001',
  '71000000-0000-0000-0000-00000000a002',
  '71000000-0000-0000-0000-000000000001',
  'isk-sibling-test',
  50000,
  'Innmelding 2098/2099 - 1 barn',
  'Gamlevei 2',
  '1300',
  'Sandvika',
  '{"child_first_name":"Noor","child_last_name":"Test","child_birth_date":"2019-02-02","child_gender":"jente","desired_class":"Nivå 1","terms_accepted":true}'::jsonb
) as result;

select is(
  (select a.family_id from public.student_applications a join sibling_result r on a.id = (r.result ->> 'application_id')::uuid),
  '71000000-0000-0000-0000-00000000f001'::uuid,
  'application is linked to the existing family'
);

select is(
  (select a.payment_id from public.student_applications a join sibling_result r on a.id = (r.result ->> 'application_id')::uuid),
  (select (result ->> 'payment_id')::uuid from sibling_result),
  'application is linked to the payment'
);

select is(
  (select count(*)::int from public.families where id in ('71000000-0000-0000-0000-00000000f001', '71000000-0000-0000-0000-00000000f002')),
  2,
  'no new family is created'
);

select results_eq(
  $$select a.mother_first_name, a.father_first_name, a.desired_class, a.status
    from public.student_applications a join sibling_result r on a.id = (r.result ->> 'application_id')::uuid$$,
  $$values ('Amina'::text, 'Karim'::text, 'Nivå 1'::text, 'ny'::text)$$,
  'mother and father come from the family guardians by role'
);

select results_eq(
  $$select p.amount, p.status, p.method, p.payer_name, p.school_year_id
    from public.payments p join sibling_result r on p.id = (r.result ->> 'payment_id')::uuid$$,
  $$values (50000, 'opprettet'::text, 'vipps'::text, 'Amina Test'::text, '71000000-0000-0000-0000-000000000001'::uuid)$$,
  'payment is a pending Vipps deposit paid by the signed in guardian'
);

select lives_ok(
  $$select public.create_portal_sibling_enrollment(
    '71000000-0000-0000-0000-00000000f002', null, '71000000-0000-0000-0000-000000000001',
    'isk-sibling-solo', 50000, 'Innmelding', 'Solo 1', '1337', 'Sandvika',
    '{"child_first_name":"Ali","child_last_name":"Test","child_birth_date":"2018-01-01","child_gender":"gutt","terms_accepted":true}'::jsonb
  )$$,
  'a family with one guardian can enroll a sibling'
);

select results_eq(
  $$select mother_first_name, father_first_name from public.student_applications where family_id = '71000000-0000-0000-0000-00000000f002'$$,
  $$values ('Solo'::text, null::text)$$,
  'single guardian is used as the first parent'
);

select throws_ok(
  $$select public.create_portal_sibling_enrollment(
    '71000000-0000-0000-0000-00000000f001', null, '71000000-0000-0000-0000-000000000001',
    'isk-sibling-no-terms', 50000, 'Innmelding', 'Gamlevei 2', '1300', 'Sandvika',
    '{"child_first_name":"Noor","child_last_name":"Test","child_birth_date":"2019-02-02","child_gender":"jente","terms_accepted":false}'::jsonb
  )$$,
  '22023',
  null,
  'terms must be accepted'
);

select throws_ok(
  $$select public.create_portal_sibling_enrollment(
    '71000000-0000-0000-0000-00000000f009', null, '71000000-0000-0000-0000-000000000001',
    'isk-sibling-no-family', 50000, 'Innmelding', 'Gamlevei 2', '1300', 'Sandvika',
    '{"child_first_name":"Noor","child_last_name":"Test","child_birth_date":"2019-02-02","child_gender":"jente","terms_accepted":true}'::jsonb
  )$$,
  '23503',
  null,
  'unknown family is rejected'
);

select * from finish();
rollback;
