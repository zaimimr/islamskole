create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  student_id uuid references public.students(id) on delete set null,
  school_year_id uuid references public.school_years(id) on delete set null,
  amount integer not null check (amount > 0),
  method text not null check (method in ('vipps', 'kontant', 'bank', 'annet')),
  reason text not null check (btrim(reason) <> ''),
  refunded_by text not null,
  refund_group_id uuid not null default gen_random_uuid(),
  psp_reference text,
  idempotency_key text,
  refunded_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists refunds_payment_idx on public.refunds (payment_id);
create index if not exists refunds_student_idx
  on public.refunds (student_id)
  where student_id is not null;
create unique index if not exists refunds_idempotency_idx
  on public.refunds (idempotency_key)
  where idempotency_key is not null;

alter table public.refunds enable row level security;

drop policy if exists "admin all" on public.refunds;
create policy "admin all" on public.refunds
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.maintain_payment_refunded_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment uuid;
begin
  target_payment := coalesce(new.payment_id, old.payment_id);

  update public.payments
  set refunded_amount = coalesce((
    select sum(refund.amount)
    from public.refunds refund
    where refund.payment_id = target_payment
  ), 0)
  where id = target_payment;

  return coalesce(new, old);
end
$$;

drop trigger if exists refunds_maintain_total on public.refunds;
create trigger refunds_maintain_total
  after insert or update or delete on public.refunds
  for each row execute function public.maintain_payment_refunded_amount();

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('vipps', 'kontant', 'bank', 'annet', 'sadaqa'));

insert into public.refunds
  (payment_id, student_id, school_year_id, amount, method, reason, refunded_by, refunded_on)
select
  payment.id,
  allocation.student_id,
  allocation.school_year_id,
  allocation.amount,
  case when payment.method = 'vipps' then 'vipps' else 'annet' end,
  'Migrert refusjon',
  'migrering',
  coalesce(payment.paid_at::date, payment.updated_at::date, current_date)
from public.payments payment
join public.payment_allocations allocation on allocation.payment_id = payment.id
where payment.status = 'refundert'
  and payment.refunded_amount > 0
  and not exists (
    select 1 from public.refunds refund where refund.payment_id = payment.id
  );

insert into public.refunds
  (payment_id, amount, method, reason, refunded_by, refunded_on)
select
  payment.id,
  payment.refunded_amount,
  case when payment.method = 'vipps' then 'vipps' else 'annet' end,
  'Migrert refusjon',
  'migrering',
  coalesce(payment.paid_at::date, payment.updated_at::date, current_date)
from public.payments payment
where payment.status = 'refundert'
  and payment.refunded_amount > 0
  and not exists (
    select 1 from public.refunds refund where refund.payment_id = payment.id
  );

insert into public.refunds
  (payment_id, amount, method, reason, refunded_by, refunded_on)
select
  payment.id,
  payment.amount - covered.total,
  case when payment.method = 'vipps' then 'vipps' else 'annet' end,
  'Migrert refusjon',
  'migrering',
  coalesce(payment.paid_at::date, payment.updated_at::date, current_date)
from public.payments payment
join (
  select refund.payment_id, sum(refund.amount) as total
  from public.refunds refund
  where refund.refunded_by = 'migrering'
  group by refund.payment_id
) covered on covered.payment_id = payment.id
where payment.status = 'refundert'
  and payment.amount > covered.total;

create or replace view public.student_balances
with (security_invoker = true) as
with active_adjustments as (
  select
    adjustment.student_id,
    adjustment.school_year_id,
    sum(adjustment.amount)::bigint as total
  from public.student_fee_adjustments adjustment
  where adjustment.revoked_at is null
  group by adjustment.student_id, adjustment.school_year_id
),
attributed_refunds as (
  select
    refund.payment_id,
    refund.student_id,
    sum(refund.amount)::bigint as total
  from public.refunds refund
  where refund.student_id is not null
  group by refund.payment_id, refund.student_id
),
effective_allocations as (
  select
    allocation.student_id,
    allocation.school_year_id,
    greatest(
      least(
        greatest(
          allocation.amount::bigint - coalesce(refunded.total, 0),
          0
        ),
        greatest(
          case
            when payment.voided_at is null then payment.net_paid_amount::bigint
            else 0::bigint
          end - coalesce(
            sum(
              greatest(allocation.amount::bigint - coalesce(refunded.total, 0), 0)
            ) over (
              partition by allocation.payment_id
              order by allocation.created_at, allocation.id
              rows between unbounded preceding and 1 preceding
            ),
            0
          ),
          0
        )
      ),
      0
    )::integer as amount
  from public.payment_allocations allocation
  join public.payments payment on payment.id = allocation.payment_id
  left join attributed_refunds refunded
    on refunded.payment_id = allocation.payment_id
    and refunded.student_id = allocation.student_id
)
select
  fee.student_id,
  fee.school_year_id,
  greatest(fee.amount - fee.discount - coalesce(adjustments.total, 0), 0)::integer as owed,
  coalesce(settled.total, 0) as paid,
  greatest(
    greatest(fee.amount - fee.discount - coalesce(adjustments.total, 0), 0)
      - coalesce(settled.total, 0),
    0
  ) as remaining,
  case
    when greatest(fee.amount - fee.discount - coalesce(adjustments.total, 0), 0) = 0 then 'betalt'
    when coalesce(settled.total, 0)
      >= greatest(fee.amount - fee.discount - coalesce(adjustments.total, 0), 0) then 'betalt'
    when coalesce(settled.total, 0) > 0 then 'delvis'
    else 'ubetalt'
  end as state
from public.student_fees fee
left join active_adjustments adjustments
  on adjustments.student_id = fee.student_id
  and adjustments.school_year_id = fee.school_year_id
left join (
  select
    student_id,
    school_year_id,
    sum(amount) as total
  from effective_allocations
  group by student_id, school_year_id
) settled
  on settled.student_id = fee.student_id
  and settled.school_year_id = fee.school_year_id;

create or replace view public.sadaqa_disbursements
with (security_invoker = true) as
select
  payment.id as payment_id,
  payment.school_year_id,
  payment.amount,
  payment.refunded_amount,
  payment.net_paid_amount,
  payment.description,
  coalesce(payment.paid_at, payment.created_at) as disbursed_at,
  allocation.student_id,
  allocation.amount as allocated_amount
from public.payments payment
left join public.payment_allocations allocation on allocation.payment_id = payment.id
where payment.method = 'sadaqa'
  and payment.status = 'fanget'
  and payment.voided_at is null;
