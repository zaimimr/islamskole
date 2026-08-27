create table if not exists public.student_fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  amount integer not null default 0 check (amount >= 0),
  discount integer not null default 0 check (discount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year_id)
);

create index if not exists student_fees_year_idx
  on public.student_fees (school_year_id);

alter table public.student_fees enable row level security;

drop policy if exists "student_fees admin all" on public.student_fees;
create policy "student_fees admin all" on public.student_fees
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, student_id)
);

create index if not exists payment_allocations_student_year_idx
  on public.payment_allocations (student_id, school_year_id);
create index if not exists payment_allocations_payment_idx
  on public.payment_allocations (payment_id);

alter table public.payment_allocations enable row level security;

drop policy if exists "payment_allocations admin all" on public.payment_allocations;
create policy "payment_allocations admin all" on public.payment_allocations
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.student_fees (student_id, school_year_id, amount)
select
  e.student_id,
  e.school_year_id,
  coalesce(e.price_snapshot, c.price, y.fee, 0) * 100
from public.enrollments e
join public.classes c on c.id = e.class_id
join public.school_years y on y.id = e.school_year_id
where e.status = 'aktiv'
on conflict (student_id, school_year_id) do nothing;

insert into public.payment_allocations (payment_id, student_id, school_year_id, amount)
select p.id, p.student_id, p.school_year_id, p.amount
from public.payments p
where p.status = 'fanget'
  and p.student_id is not null
  and p.school_year_id is not null
  and p.amount > 0
on conflict (payment_id, student_id) do nothing;

with grouped as (
  select
    p.id as payment_id,
    p.amount,
    p.school_year_id,
    s.id as student_id,
    count(*) over (partition by p.id) as siblings,
    row_number() over (partition by p.id order by s.id) as position
  from public.payments p
  join public.student_applications sa on sa.payment_id = p.id
  join public.students s on s.application_id = sa.id
  where p.status = 'fanget'
    and p.student_id is null
    and p.school_year_id is not null
    and p.amount > 0
)
insert into public.payment_allocations (payment_id, student_id, school_year_id, amount)
select
  payment_id,
  student_id,
  school_year_id,
  amount / siblings + case when position = 1 then amount % siblings else 0 end
from grouped
on conflict (payment_id, student_id) do nothing;

create or replace view public.student_balances
with (security_invoker = true) as
select
  f.student_id,
  f.school_year_id,
  greatest(f.amount - f.discount, 0) as owed,
  coalesce(settled.total, 0) as paid,
  greatest(greatest(f.amount - f.discount, 0) - coalesce(settled.total, 0), 0) as remaining,
  case
    when greatest(f.amount - f.discount, 0) = 0 then 'betalt'
    when coalesce(settled.total, 0) >= greatest(f.amount - f.discount, 0) then 'betalt'
    when coalesce(settled.total, 0) > 0 then 'delvis'
    else 'ubetalt'
  end as state
from public.student_fees f
left join lateral (
  select sum(a.amount) as total
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.student_id = f.student_id
    and a.school_year_id = f.school_year_id
    and p.status = 'fanget'
) settled on true;
