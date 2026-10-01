begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(6);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.school_years (id, label, starts_on, ends_on)
values ('cf000000-0000-0000-0000-000000000001', 'ZZTEST CF', '2097-08-01', '2098-06-30');

insert into public.families (id, display_name, origin)
values
  ('cf000000-0000-0000-0000-0000000000f1', 'ZZTEST Familie CF1', 'test'),
  ('cf000000-0000-0000-0000-0000000000f2', 'ZZTEST Familie CF2', 'test');

select throws_ok(
  $$ insert into public.payment_plans (family_id, school_year_id, plan_type, created_by)
     values ('cf000000-0000-0000-0000-0000000000f1', 'cf000000-0000-0000-0000-000000000001', 'egendefinert', 'zztest') $$,
  '23514',
  null,
  'egendefinert plan without config is refused'
);

select throws_ok(
  $$ insert into public.payment_plans (family_id, school_year_id, plan_type, custom_config, created_by)
     values ('cf000000-0000-0000-0000-0000000000f1', 'cf000000-0000-0000-0000-000000000001', 'egendefinert', '{"start_month":"2097-09"}', 'zztest') $$,
  '23514',
  null,
  'egendefinert plan with incomplete config is refused'
);

select throws_ok(
  $$ insert into public.payment_plans (family_id, school_year_id, plan_type, created_by)
     values ('cf000000-0000-0000-0000-0000000000f1', 'cf000000-0000-0000-0000-000000000001', 'ukjent', 'zztest') $$,
  '23514',
  null,
  'unknown plan type is refused'
);

select lives_ok(
  $$ insert into public.payment_plans (id, family_id, school_year_id, plan_type, custom_config, created_by)
     values ('cf000000-0000-0000-0000-0000000000e1', 'cf000000-0000-0000-0000-0000000000f2', 'cf000000-0000-0000-0000-000000000001', 'egendefinert',
       '{"initial_amount":200000,"initial_mode":"totalt","initial_due_date":"2097-08-20","monthly_amount":null,"monthly_mode":"totalt","final_amount":null,"final_mode":"totalt","final_due_date":null,"start_month":"2097-09","end_month":"2098-05","due_day":15}',
       'zztest') $$,
  'egendefinert plan with config is stored'
);

select ok(
  not has_table_privilege('anon', 'public.payment_plans', 'select'),
  'anon cannot read payment plans'
);

select set_config('request.jwt.claims', '{"sub":"cf000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payment_plans where id = 'cf000000-0000-0000-0000-0000000000e1'),
  0,
  'non-admin cannot see the custom plan config'
);

reset role;

select * from finish();

rollback;
