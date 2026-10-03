begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(12);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, raw_app_meta_data)
values
  ('f3000000-0000-0000-0000-0000000000a1', 'zz-f3-teacher@zztest.local', '{"role":"member"}'),
  ('f3000000-0000-0000-0000-0000000000a2', 'zz-f3-parent@zztest.local', '{"role":"member"}');

update public.school_years set is_active = false where is_active;

insert into public.school_years (id, label, starts_on, ends_on, is_active)
values (
  'f3000000-0000-0000-0000-000000000001',
  'ZZTEST F3 aktiv',
  (now() at time zone 'Europe/Oslo')::date - 60,
  (now() at time zone 'Europe/Oslo')::date + 200,
  true
);

insert into public.classes (id, slug, name_no, name_en)
values ('f3000000-0000-0000-0000-0000000000c1', 'zztest-f3-a', 'ZZTEST F3 A', 'ZZTEST F3 A');

insert into public.families (id, origin)
values ('f3000000-0000-0000-0000-0000000000f1', 'test');

insert into public.guardians (id, first_name, last_name, email, is_teacher)
values
  ('f3000000-0000-0000-0000-000000000061', 'ZZTEST', 'Laerer', 'zz-f3-teacher@zztest.local', true),
  ('f3000000-0000-0000-0000-000000000064', 'ZZTEST', 'Forelder', 'zz-f3-parent@zztest.local', false);

insert into public.family_guardians (family_id, guardian_id, is_primary_contact)
values ('f3000000-0000-0000-0000-0000000000f1', 'f3000000-0000-0000-0000-000000000064', true);

insert into public.students (id, family_id, child_first_name, child_last_name)
values
  ('f3000000-0000-0000-0000-000000000051', 'f3000000-0000-0000-0000-0000000000f1', 'ZZTEST', 'Elev A'),
  ('f3000000-0000-0000-0000-000000000052', 'f3000000-0000-0000-0000-0000000000f1', 'ZZTEST', 'Elev B');

insert into public.enrollments (student_id, class_id, school_year_id, status)
values
  ('f3000000-0000-0000-0000-000000000051', 'f3000000-0000-0000-0000-0000000000c1', 'f3000000-0000-0000-0000-000000000001', 'aktiv'),
  ('f3000000-0000-0000-0000-000000000052', 'f3000000-0000-0000-0000-0000000000c1', 'f3000000-0000-0000-0000-000000000001', 'aktiv');

insert into public.class_teachers (class_id, guardian_id, school_year_id)
values ('f3000000-0000-0000-0000-0000000000c1', 'f3000000-0000-0000-0000-000000000061', 'f3000000-0000-0000-0000-000000000001');

insert into public.school_days (id, school_year_id, date)
values ('f3000000-0000-0000-0000-0000000000d1', 'f3000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/Oslo')::date);

create temporary table f3_lesson on commit drop as
select id from public.lessons
where class_id = 'f3000000-0000-0000-0000-0000000000c1'
  and school_day_id = 'f3000000-0000-0000-0000-0000000000d1'
order by start_position
limit 1;
grant select on f3_lesson to authenticated;

insert into public.absence_reports (student_id, school_day_id, reason, reported_by_guardian_id)
values ('f3000000-0000-0000-0000-000000000051', 'f3000000-0000-0000-0000-0000000000d1', 'ZZTEST syk', 'f3000000-0000-0000-0000-000000000064');

select is(
  (select notice_channel from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000051' and lesson_id = (select id from f3_lesson)),
  'app',
  'an absence reported on Min side is marked as reported in the app'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3000000-0000-0000-0000-0000000000a1","email":"zz-f3-teacher@zztest.local","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.attendance (student_id, lesson_id, status)
     values ('f3000000-0000-0000-0000-000000000052', (select id from f3_lesson), 'meldt_fravaer') $$,
  'the teacher marks a reported absence they heard about directly'
);

select is(
  (select notice_channel from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson)),
  'direkte',
  'a reported absence the teacher marks is recorded as told directly'
);

update public.attendance set note = '  ZZTEST SMS fra mor  '
where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson);

select is(
  (select note from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson)),
  'ZZTEST SMS fra mor',
  'the teacher adds a trimmed note to the direct notice'
);

select is(
  (select notice_channel || ' ' || attendance_note from public.portal_lesson_roster((select id from f3_lesson))
   where student_id = 'f3000000-0000-0000-0000-000000000052'),
  'direkte ZZTEST SMS fra mor',
  'the roster shows how the notice came in and the note'
);

select is(
  (select notice_channel || ' ' || coalesce(absence_reason, '-') from public.portal_lesson_roster((select id from f3_lesson))
   where student_id = 'f3000000-0000-0000-0000-000000000051'),
  'app ZZTEST syk',
  'the roster shows the app report with its reason'
);

select throws_ok(
  $$ update public.attendance set note = repeat('x', 501)
     where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson) $$,
  '23514',
  null,
  'a note is at most 500 characters'
);

update public.attendance set status = 'til_stede'
where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson);

select is(
  (select coalesce(notice_channel, '-') || ' ' || coalesce(note, '-') from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson)),
  '- -',
  'marking the student present clears the notice and note'
);

update public.attendance set status = 'meldt_fravaer'
where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson);

reset role;

insert into public.absence_reports (student_id, school_day_id, reason, reported_by_guardian_id)
values ('f3000000-0000-0000-0000-000000000052', 'f3000000-0000-0000-0000-0000000000d1', 'ZZTEST tannlege', 'f3000000-0000-0000-0000-000000000064');

update public.absence_reports set withdrawn_at = now()
where school_day_id = 'f3000000-0000-0000-0000-0000000000d1' and withdrawn_at is null;

select is(
  (select count(*) from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000051' and lesson_id = (select id from f3_lesson)),
  0::bigint,
  'withdrawing an app report clears the absence it created'
);

select is(
  (select notice_channel from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson)),
  'direkte',
  'withdrawing an app report keeps an absence the teacher registered directly'
);

select throws_ok(
  $$ update public.attendance set notice_channel = 'sms'
     where student_id = 'f3000000-0000-0000-0000-000000000052' and lesson_id = (select id from f3_lesson) $$,
  '23514',
  null,
  'the notice channel is either app or direkte'
);

insert into public.attendance (student_id, lesson_id, status, notice_channel)
values ('f3000000-0000-0000-0000-000000000051', (select id from f3_lesson), 'fravaer', 'app');

select is(
  (select notice_channel from public.attendance
   where student_id = 'f3000000-0000-0000-0000-000000000051' and lesson_id = (select id from f3_lesson)),
  null,
  'an absence nobody reported carries no notice channel'
);

select * from finish();

rollback;
