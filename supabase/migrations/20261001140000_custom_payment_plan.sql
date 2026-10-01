alter table public.payment_plans
  add column if not exists custom_config jsonb;

alter table public.payment_plans
  drop constraint if exists payment_plans_plan_type_check;
alter table public.payment_plans
  add constraint payment_plans_plan_type_check
  check (plan_type in ('full', 'semester', 'maanedlig', 'egendefinert'));

alter table public.payment_plans
  drop constraint if exists payment_plans_custom_config_required;
alter table public.payment_plans
  add constraint payment_plans_custom_config_required
  check (
    plan_type <> 'egendefinert'
    or (
      custom_config is not null
      and jsonb_typeof(custom_config) = 'object'
      and custom_config ? 'start_month'
      and custom_config ? 'end_month'
      and custom_config ? 'due_day'
    )
  );

revoke all on public.payment_plans from anon;
