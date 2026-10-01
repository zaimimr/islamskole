begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(22);

select ok(
  not has_table_privilege('anon', 'public.sms_login_codes', 'select'),
  'anon cannot read sms_login_codes'
);

select ok(
  not has_table_privilege('authenticated', 'public.sms_login_codes', 'select'),
  'authenticated cannot read sms_login_codes'
);

select ok(
  not has_function_privilege('anon', 'public.sms_login_verify(text, text, integer)', 'execute'),
  'anon cannot execute sms_login_verify'
);

select ok(
  not has_function_privilege('authenticated', 'public.sms_login_issue(text, text, integer)', 'execute'),
  'authenticated cannot execute sms_login_issue'
);

select ok(
  not has_function_privilege('anon', 'public.sms_login_lookup(text)', 'execute'),
  'anon cannot execute sms_login_lookup'
);

select ok(
  has_function_privilege('service_role', 'public.sms_login_verify(text, text, integer)', 'execute'),
  'service_role can execute sms_login_verify'
);

select is(public.normalize_no_mobile('912 34 567'), '+4791234567', 'eight digits with spaces');
select is(public.normalize_no_mobile('+47 912 34 567'), '+4791234567', 'plus 47 prefix');
select is(public.normalize_no_mobile('0047-41234567'), '+4741234567', '0047 prefix');
select is(public.normalize_no_mobile('67 12 34 56'), null, 'landline is not a mobile');
select is(public.normalize_no_mobile('+46701234567'), null, 'foreign number is rejected');

insert into public.guardians (id, first_name, last_name, email, phone)
values
  ('d7000000-0000-0000-0000-000000000061', 'ZZTEST', 'Sms', 'ZZ-D7-Sms@zztest.local', '+47 900 00 001'),
  ('d7000000-0000-0000-0000-000000000062', 'ZZTEST', 'Utenepost', null, '90000002');

insert into public.students (id, family_id, child_first_name, child_last_name, child_email, child_phone)
values ('d7000000-0000-0000-0000-000000000051', null, 'ZZTEST', 'Elev', 'zz-d7-elev@zztest.local', '0047 90000003');

select is(
  (select email from public.sms_login_lookup('+4790000001') limit 1),
  'zz-d7-sms@zztest.local',
  'guardian phone resolves to lowercased email'
);

select is(
  (select count(*)::integer from public.sms_login_lookup('+4790000002')),
  0,
  'guardian without email gives no login'
);

select is(
  (select source from public.sms_login_lookup('+4790000003') limit 1),
  'student',
  'student phone resolves to child email'
);

select isnt(public.sms_login_issue('+4790000009', 'hash-a', 600), null, 'issue returns an id');
select is(public.sms_login_verify('+4790000009', 'wrong', 5), 'invalid', 'wrong code is invalid');
select is(public.sms_login_verify('+4790000009', 'hash-a', 5), 'ok', 'right code logs in');
select is(public.sms_login_verify('+4790000009', 'hash-a', 5), 'missing', 'code cannot be reused');

select public.sms_login_issue('+4790000009', 'hash-b', 600);
select public.sms_login_verify('+4790000009', 'x', 5) from generate_series(1, 4);
select is(public.sms_login_verify('+4790000009', 'x', 5), 'locked', 'fifth wrong attempt locks');
select is(public.sms_login_verify('+4790000009', 'hash-b', 5), 'locked', 'locked code rejects the right code');

select public.sms_login_issue('+4790000009', 'hash-c', 600);
update public.sms_login_codes set expires_at = now() - interval '1 second'
where phone = '+4790000009' and code_hash = 'hash-c';
select is(public.sms_login_verify('+4790000009', 'hash-c', 5), 'expired', 'expired code is rejected');

select public.sms_login_issue('+4790000009', 'hash-d', 600);
select public.sms_login_issue('+4790000009', 'hash-e', 600);
select is(public.sms_login_verify('+4790000009', 'hash-d', 5), 'invalid', 'new code replaces the old one');

select * from finish();

rollback;
