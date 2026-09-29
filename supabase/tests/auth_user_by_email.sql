begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(5);

insert into auth.users (id, email, raw_app_meta_data)
values ('db000000-0000-0000-0000-0000000000e1', 'zz-lookup@zztest.local', '{"role":"member"}');

select ok(
  not has_function_privilege('anon', 'public.auth_user_id_by_email(text)', 'execute'),
  'anon cannot execute auth_user_id_by_email'
);

select ok(
  not has_function_privilege('authenticated', 'public.auth_user_id_by_email(text)', 'execute'),
  'authenticated cannot execute auth_user_id_by_email'
);

select ok(
  has_function_privilege('service_role', 'public.auth_user_id_by_email(text)', 'execute'),
  'service_role can execute auth_user_id_by_email'
);

select is(
  public.auth_user_id_by_email('ZZ-Lookup@ZZTEST.local'),
  'db000000-0000-0000-0000-0000000000e1'::uuid,
  'lookup ignores case'
);

select is(
  public.auth_user_id_by_email('zz-nobody@zztest.local'),
  null,
  'unknown email returns null'
);

select * from finish();

rollback;
