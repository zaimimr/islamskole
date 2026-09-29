begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(6);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, raw_app_meta_data)
values
  ('d5000000-0000-0000-0000-0000000000a1', 'zz-d5-admin@zztest.local', '{"role":"admin"}'),
  ('d5000000-0000-0000-0000-0000000000a2', 'zz-d5-member@zztest.local', '{"role":"member"}');

insert into public.families (id, origin)
values
  ('d5000000-0000-0000-0000-0000000000f1', 'test'),
  ('d5000000-0000-0000-0000-0000000000f2', 'test');

insert into public.guardians (id, first_name, last_name, email)
values
  ('d5000000-0000-0000-0000-000000000061', 'ZZTEST', 'Gammel', 'zz-d5-1@zztest.local'),
  ('d5000000-0000-0000-0000-000000000062', 'ZZTEST', 'Ny En', 'zz-d5-2@zztest.local'),
  ('d5000000-0000-0000-0000-000000000063', 'ZZTEST', 'Ny To', 'zz-d5-3@zztest.local');

insert into public.family_guardians (family_id, guardian_id, is_primary_contact)
values
  ('d5000000-0000-0000-0000-0000000000f1', 'd5000000-0000-0000-0000-000000000061', true),
  ('d5000000-0000-0000-0000-0000000000f2', 'd5000000-0000-0000-0000-000000000062', true),
  ('d5000000-0000-0000-0000-0000000000f2', 'd5000000-0000-0000-0000-000000000063', false);

insert into public.students (id, family_id, child_first_name, child_last_name)
values ('d5000000-0000-0000-0000-000000000051', 'd5000000-0000-0000-0000-0000000000f1', 'ZZTEST', 'Flyttes');

select has_function(
  'public',
  'admin_move_student_to_family',
  array['uuid', 'uuid'],
  'D5 FAM-11: admin_move_student_to_family(uuid, uuid) exists'
);

select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-0000000000a2","email":"zz-d5-member@zztest.local","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.admin_move_student_to_family('d5000000-0000-0000-0000-000000000051', 'd5000000-0000-0000-0000-0000000000f2') $$,
  '42501',
  null,
  'D5 FAM-11: a non-admin cannot move a student'
);

select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-0000000000a1","email":"zz-d5-admin@zztest.local","role":"authenticated"}', true);

select lives_ok(
  $$ select public.admin_move_student_to_family('d5000000-0000-0000-0000-000000000051', 'd5000000-0000-0000-0000-0000000000f2') $$,
  'D5 FAM-11: an admin moves a student to another family'
);

reset role;

select is(
  (select family_id from public.students where id = 'd5000000-0000-0000-0000-000000000051'),
  'd5000000-0000-0000-0000-0000000000f2'::uuid,
  'D5 FAM-11: the student now belongs to the target family'
);

select results_eq(
  $$
    select guardian_id from public.student_guardians
    where student_id = 'd5000000-0000-0000-0000-000000000051'
    order by guardian_id
  $$,
  $$
    values
      ('d5000000-0000-0000-0000-000000000062'::uuid),
      ('d5000000-0000-0000-0000-000000000063'::uuid)
  $$,
  'D5 FAM-11: the student guardians are exactly the target family guardians'
);

select ok(
  not exists (
    select 1 from public.student_guardians
    where student_id = 'd5000000-0000-0000-0000-000000000051'
      and guardian_id = 'd5000000-0000-0000-0000-000000000061'
  ),
  'D5 FAM-11: the old family guardian loses the link to the student'
);

select * from finish();

rollback;
