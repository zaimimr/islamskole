begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(13);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, raw_app_meta_data)
values
  ('d9000000-0000-0000-0000-0000000000a1', 'zz-d9-elev@zztest.local', '{"role":"member"}'),
  ('d9000000-0000-0000-0000-0000000000a2', 'mangler@islamskole.no', '{"role":"member"}'),
  ('d9000000-0000-0000-0000-0000000000a3', 'zz-d9-parent@zztest.local', '{"role":"member"}');

update public.school_years set is_active = false where is_active;

insert into public.school_years (id, label, starts_on, ends_on, is_active)
values
  (
    'd9000000-0000-0000-0000-000000000001',
    'ZZTEST D9 aktiv',
    (now() at time zone 'Europe/Oslo')::date - 60,
    (now() at time zone 'Europe/Oslo')::date + 200,
    true
  ),
  (
    'd9000000-0000-0000-0000-000000000000',
    'ZZTEST D9 i fjor',
    (now() at time zone 'Europe/Oslo')::date - 500,
    (now() at time zone 'Europe/Oslo')::date - 300,
    false
  );

insert into public.school_days (id, school_year_id, date)
values
  ('d9000000-0000-0000-0000-0000000000d0', 'd9000000-0000-0000-0000-000000000000', (now() at time zone 'Europe/Oslo')::date - 400),
  ('d9000000-0000-0000-0000-0000000000d1', 'd9000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/Oslo')::date - 7);

insert into public.classes (id, slug, name_no, name_en)
values
  ('d9000000-0000-0000-0000-0000000000c1', 'zztest-d9-a', 'ZZTEST D9 A', 'ZZTEST D9 A'),
  ('d9000000-0000-0000-0000-0000000000c2', 'zztest-d9-b', 'ZZTEST D9 B', 'ZZTEST D9 B');

insert into public.families (id, origin)
values ('d9000000-0000-0000-0000-0000000000f1', 'test');

insert into public.guardians (id, first_name, last_name, email)
values ('d9000000-0000-0000-0000-000000000061', 'ZZTEST', 'Forelder', 'zz-d9-parent@zztest.local');

insert into public.family_guardians (family_id, guardian_id, is_primary_contact)
values ('d9000000-0000-0000-0000-0000000000f1', 'd9000000-0000-0000-0000-000000000061', true);

insert into public.students (id, family_id, child_first_name, child_last_name, child_email)
values
  ('d9000000-0000-0000-0000-000000000051', null, 'ZZTEST', 'Elev', 'ZZ-D9-Elev@zztest.local'),
  ('d9000000-0000-0000-0000-000000000052', 'd9000000-0000-0000-0000-0000000000f1', 'ZZTEST', 'Klassekamerat', null),
  ('d9000000-0000-0000-0000-000000000053', null, 'ZZTEST', 'Mangler', 'mangler@islamskole.no');

insert into public.enrollments (student_id, class_id, school_year_id, status)
values
  ('d9000000-0000-0000-0000-000000000051', 'd9000000-0000-0000-0000-0000000000c1', 'd9000000-0000-0000-0000-000000000001', 'aktiv'),
  ('d9000000-0000-0000-0000-000000000051', 'd9000000-0000-0000-0000-0000000000c2', 'd9000000-0000-0000-0000-000000000000', 'aktiv'),
  ('d9000000-0000-0000-0000-000000000052', 'd9000000-0000-0000-0000-0000000000c1', 'd9000000-0000-0000-0000-000000000001', 'aktiv'),
  ('d9000000-0000-0000-0000-000000000053', 'd9000000-0000-0000-0000-0000000000c1', 'd9000000-0000-0000-0000-000000000001', 'aktiv');

insert into public.attendance (student_id, school_day_id, status)
values
  ('d9000000-0000-0000-0000-000000000051', 'd9000000-0000-0000-0000-0000000000d1', 'til_stede'),
  ('d9000000-0000-0000-0000-000000000052', 'd9000000-0000-0000-0000-0000000000d1', 'fravaer'),
  ('d9000000-0000-0000-0000-000000000053', 'd9000000-0000-0000-0000-0000000000d1', 'sent');

insert into public.class_notes (class_id, school_day_id, homework)
values
  ('d9000000-0000-0000-0000-0000000000c1', 'd9000000-0000-0000-0000-0000000000d1', 'ZZTEST A i år'),
  ('d9000000-0000-0000-0000-0000000000c2', 'd9000000-0000-0000-0000-0000000000d0', 'ZZTEST B i fjor'),
  ('d9000000-0000-0000-0000-0000000000c2', 'd9000000-0000-0000-0000-0000000000d1', 'ZZTEST B i år');

insert into public.payments (student_id, reference, amount, status, method, authorized_amount, captured_amount)
values ('d9000000-0000-0000-0000-000000000051', 'zztest-d9-1', 10000, 'fanget', 'bank', 10000, 10000);

select has_function(
  'public',
  'portal_student_ids',
  array[]::text[],
  'D9: portal_student_ids() exists'
);

select has_function(
  'public',
  'portal_my_self',
  array[]::text[],
  'D9: portal_my_self() exists'
);

select set_config('request.jwt.claims', '{"sub":"d9000000-0000-0000-0000-0000000000a1","email":"zz-d9-elev@zztest.local","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.attendance where student_id = 'd9000000-0000-0000-0000-000000000051'),
  1::bigint,
  'D9: a student reads their own attendance'
);

select is(
  (select count(*) from public.attendance where student_id = 'd9000000-0000-0000-0000-000000000052'),
  0::bigint,
  'D9: a student cannot read a classmate attendance'
);

select is(
  (select count(*) from public.class_notes where class_id = 'd9000000-0000-0000-0000-0000000000c1'),
  1::bigint,
  'D9: a student reads this year''s notes of their class'
);

select is(
  (
    select count(*) from public.class_notes
    where class_id = 'd9000000-0000-0000-0000-0000000000c2'
      and school_day_id = 'd9000000-0000-0000-0000-0000000000d0'
  ),
  0::bigint,
  'D9: a student cannot read notes of last year''s class'
);

select is(
  (
    select count(*) from public.class_notes
    where class_id = 'd9000000-0000-0000-0000-0000000000c2'
      and school_day_id = 'd9000000-0000-0000-0000-0000000000d1'
  ),
  0::bigint,
  'D9: a student cannot read notes of a class they are not in this year'
);

select is(
  (select count(*) from public.payments where student_id = 'd9000000-0000-0000-0000-000000000051'),
  0::bigint,
  'D9: a student cannot read payments'
);

select set_config('request.jwt.claims', '{"sub":"d9000000-0000-0000-0000-0000000000a2","email":"mangler@islamskole.no","role":"authenticated"}', true);

select is(
  (select count(*) from public.attendance where student_id = 'd9000000-0000-0000-0000-000000000053'),
  0::bigint,
  'D9: the mangler@islamskole.no placeholder email gives no student access'
);

select is(
  (select count(*) from public.portal_student_ids()),
  0::bigint,
  'D9: portal_student_ids is empty for the placeholder email'
);

select set_config('request.jwt.claims', '{"sub":"d9000000-0000-0000-0000-0000000000a1","email":"zz-d9-elev@zztest.local","role":"authenticated"}', true);

select results_eq(
  $$ select * from public.portal_student_ids() $$,
  $$ values ('d9000000-0000-0000-0000-000000000051'::uuid) $$,
  'D9: portal_student_ids matches child_email case-insensitively'
);

select ok(
  (select count(*) from public.portal_my_self()) >= 1,
  'D9: portal_my_self returns the student''s own view'
);

select set_config('request.jwt.claims', '{"sub":"d9000000-0000-0000-0000-0000000000a3","email":"zz-d9-parent@zztest.local","role":"authenticated"}', true);

select is(
  (select count(*) from public.portal_my_self()),
  0::bigint,
  'D9: portal_my_self returns nothing for a parent who is not a student'
);

reset role;

select * from finish();

rollback;
