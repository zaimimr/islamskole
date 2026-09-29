begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(26);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  (
    select string_agg(c.confdeltype::text, ',')
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = format('public.%I', t.tbl)::regclass
      and c.conkey = array[(
        select a.attnum
        from pg_attribute a
        where a.attrelid = format('public.%I', t.tbl)::regclass
          and a.attname = t.col
      )]
  ),
  'r',
  format('D2 %s: %s.%s is ON DELETE RESTRICT', t.story, t.tbl, t.col)
)
from (
  values
    ('payments', 'student_id', 'SEC-20'),
    ('payment_allocations', 'student_id', 'SEC-20'),
    ('payment_allocations', 'school_year_id', 'CLS-21'),
    ('payment_targets', 'student_id', 'SEC-20'),
    ('student_fees', 'student_id', 'SEC-20'),
    ('student_fees', 'school_year_id', 'SEC-21'),
    ('student_fee_adjustments', 'student_id', 'SEC-20'),
    ('student_fee_adjustments', 'school_year_id', 'SEC-21'),
    ('installments', 'student_id', 'SEC-20'),
    ('installments', 'school_year_id', 'SEC-21'),
    ('payment_plans', 'school_year_id', 'SEC-21'),
    ('payment_plans', 'family_id', 'FAM-13'),
    ('attendance', 'school_day_id', 'CLS-21'),
    ('class_notes', 'school_day_id', 'CLS-21')
) as t(tbl, col, story);

insert into public.school_years (id, label, starts_on, ends_on)
values
  ('d2000000-0000-0000-0000-00000000000a', 'ZZTEST D2 A', '2090-08-01', '2091-06-30'),
  ('d2000000-0000-0000-0000-00000000000b', 'ZZTEST D2 B', '2091-08-01', '2092-06-30'),
  ('d2000000-0000-0000-0000-00000000000c', 'ZZTEST D2 C', '2092-08-01', '2093-06-30'),
  ('d2000000-0000-0000-0000-00000000000d', 'ZZTEST D2 D', '2093-08-01', '2094-06-30'),
  ('d2000000-0000-0000-0000-00000000000e', 'ZZTEST D2 E', '2094-08-01', '2094-09-30'),
  ('d2000000-0000-0000-0000-0000000000a8', 'ZZTEST D2 H', '2095-08-01', '2096-06-30');

insert into public.classes (id, slug, name_no, name_en)
values ('d2000000-0000-0000-0000-0000000000c1', 'zztest-d2', 'ZZTEST D2', 'ZZTEST D2');

insert into public.students (id, child_first_name, child_last_name)
values
  ('d2000000-0000-0000-0000-000000000051', 'ZZTEST', 'Betaler'),
  ('d2000000-0000-0000-0000-000000000052', 'ZZTEST', 'Krav'),
  ('d2000000-0000-0000-0000-000000000054', 'ZZTEST', 'Fordeling'),
  ('d2000000-0000-0000-0000-000000000055', 'ZZTEST', 'Oppmote'),
  ('d2000000-0000-0000-0000-000000000056', 'ZZTEST', 'Uten penger');

insert into public.payments (
  id, student_id, reference, amount, status, method, authorized_amount, captured_amount
) values
  ('d2000000-0000-0000-0000-0000000000e1', 'd2000000-0000-0000-0000-000000000051', 'zztest-d2-1', 10000, 'fanget', 'bank', 10000, 10000),
  ('d2000000-0000-0000-0000-0000000000e2', 'd2000000-0000-0000-0000-000000000054', 'zztest-d2-2', 10000, 'fanget', 'bank', 10000, 10000);

insert into public.payment_allocations (payment_id, student_id, school_year_id, amount)
values ('d2000000-0000-0000-0000-0000000000e2', 'd2000000-0000-0000-0000-000000000054', 'd2000000-0000-0000-0000-00000000000a', 5000);

insert into public.student_fees (student_id, school_year_id, amount)
values ('d2000000-0000-0000-0000-000000000052', 'd2000000-0000-0000-0000-00000000000b', 10000);

insert into public.school_days (id, school_year_id, date)
values
  ('d2000000-0000-0000-0000-0000000000dc', 'd2000000-0000-0000-0000-00000000000c', '2092-08-03'),
  ('d2000000-0000-0000-0000-0000000000dd', 'd2000000-0000-0000-0000-00000000000d', '2093-08-07');

insert into public.attendance (student_id, school_day_id, status)
values
  ('d2000000-0000-0000-0000-000000000055', 'd2000000-0000-0000-0000-0000000000dc', 'til_stede'),
  ('d2000000-0000-0000-0000-000000000056', 'd2000000-0000-0000-0000-0000000000dc', 'fravaer');

insert into public.class_notes (class_id, school_day_id, homework)
values ('d2000000-0000-0000-0000-0000000000c1', 'd2000000-0000-0000-0000-0000000000dd', 'ZZTEST lekse');

select public.ensure_school_days('d2000000-0000-0000-0000-00000000000e');

insert into public.families (id, origin)
values ('d2000000-0000-0000-0000-0000000000f1', 'test');

insert into public.payment_plans (family_id, school_year_id, plan_type, created_by)
values ('d2000000-0000-0000-0000-0000000000f1', 'd2000000-0000-0000-0000-0000000000a8', 'full', 'zztest');

select throws_ok(
  $$ delete from public.students where id = 'd2000000-0000-0000-0000-000000000051' $$,
  '23503',
  null,
  'D2 SEC-20: deleting a student with a payment is refused'
);

select throws_ok(
  $$ delete from public.school_years where id = 'd2000000-0000-0000-0000-00000000000b' $$,
  '23503',
  null,
  'D2 SEC-21: deleting a school year with student fees is refused'
);

select throws_ok(
  $$ delete from public.students where id = 'd2000000-0000-0000-0000-000000000052' $$,
  '23503',
  null,
  'D2 SEC-20: deleting a student with a fee is refused'
);

select throws_ok(
  $$ delete from public.school_years where id = 'd2000000-0000-0000-0000-00000000000a' $$,
  '23503',
  null,
  'D2 CLS-21: deleting a school year with payment allocations and no enrollments is refused'
);

select throws_ok(
  $$ delete from public.school_years where id = 'd2000000-0000-0000-0000-00000000000c' $$,
  '23503',
  null,
  'D2 CLS-21: deleting a school year with attendance is refused'
);

select throws_ok(
  $$ delete from public.school_years where id = 'd2000000-0000-0000-0000-00000000000d' $$,
  '23503',
  null,
  'D2 CLS-21: deleting a school year with class notes is refused'
);

select lives_ok(
  $$ delete from public.school_years where id = 'd2000000-0000-0000-0000-00000000000e' $$,
  'D2 CLS-21: deleting a school year with only generated school days still works'
);

select is(
  (select count(*) from public.school_days where school_year_id = 'd2000000-0000-0000-0000-00000000000e'),
  0::bigint,
  'D2 CLS-21: the generated school days go with the deleted year'
);

select lives_ok(
  $$ delete from public.students where id = 'd2000000-0000-0000-0000-000000000056' $$,
  'D2 SEC-20: deleting a student with attendance but no money still works'
);

select is(
  (select count(*) from public.attendance where student_id = 'd2000000-0000-0000-0000-000000000056'),
  0::bigint,
  'D2 SEC-20: the deleted student attendance goes too'
);

select throws_ok(
  $$ delete from public.families where id = 'd2000000-0000-0000-0000-0000000000f1' $$,
  '23503',
  null,
  'D2 FAM-13: deleting a family with a payment plan is refused'
);

select throws_ok(
  $$ delete from public.school_years where id = 'd2000000-0000-0000-0000-0000000000a8' $$,
  '23503',
  null,
  'D2 SEC-21: deleting a school year with a payment plan is refused'
);

select * from finish();

rollback;
