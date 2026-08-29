alter table public.school_years
  add column if not exists enrollment_fee integer not null default 2000,
  add column if not exists sem1_due_on date,
  add column if not exists sem2_due_on date,
  add column if not exists monthly_due_day integer not null default 15
    check (monthly_due_day between 1 and 28);

update public.school_years
set
  sem1_due_on = coalesce(sem1_due_on, make_date(extract(year from starts_on)::int, 8, 15)),
  sem2_due_on = coalesce(sem2_due_on, make_date(extract(year from starts_on)::int, 12, 15))
where starts_on is not null
  and (sem1_due_on is null or sem2_due_on is null);

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  plan_type text not null check (plan_type in ('full', 'semester', 'maanedlig')),
  monthly_amount integer check (monthly_amount is null or monthly_amount > 0),
  status text not null default 'aktiv' check (status in ('aktiv', 'avsluttet')),
  paused_at timestamptz,
  note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_plans_monthly_amount_required
    check (plan_type <> 'maanedlig' or monthly_amount is not null)
);

create unique index if not exists payment_plans_active_family_year_idx
  on public.payment_plans (family_id, school_year_id)
  where status = 'aktiv';

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  due_date date not null,
  amount integer not null check (amount >= 0),
  status text not null default 'planlagt'
    check (status in ('planlagt', 'sendt', 'betalt', 'kansellert', 'stoppet')),
  payment_id uuid references public.payments(id) on delete set null,
  sent_at timestamptz,
  reminder_sent_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installments_status_due_idx
  on public.installments (status, due_date);
create index if not exists installments_plan_idx
  on public.installments (plan_id);
create index if not exists installments_student_year_idx
  on public.installments (student_id, school_year_id);
create index if not exists installments_payment_idx
  on public.installments (payment_id)
  where payment_id is not null;

create table if not exists public.sibling_discount_dismissals (
  family_id uuid not null references public.families(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  dismissed_by text not null,
  created_at timestamptz not null default now(),
  primary key (family_id, school_year_id)
);

alter table public.payment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.sibling_discount_dismissals enable row level security;

drop policy if exists "admin all" on public.payment_plans;
create policy "admin all" on public.payment_plans
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.installments;
create policy "admin all" on public.installments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.sibling_discount_dismissals;
create policy "admin all" on public.sibling_discount_dismissals
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists payment_plans_updated_at on public.payment_plans;
create trigger payment_plans_updated_at
  before update on public.payment_plans
  for each row execute function public.set_updated_at();

drop trigger if exists installments_updated_at on public.installments;
create trigger installments_updated_at
  before update on public.installments
  for each row execute function public.set_updated_at();
