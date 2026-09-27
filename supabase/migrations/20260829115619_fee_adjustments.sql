create table if not exists public.student_fee_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  type text not null check (type in ('soskenrabatt', 'laererbarn', 'frivillig', 'annet')),
  amount integer not null check (amount > 0),
  teacher_guardian_id uuid references public.guardians(id) on delete set null,
  note text not null check (btrim(note) <> ''),
  granted_by text not null,
  legacy_fee_id uuid unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  constraint student_fee_adjustments_teacher_link
    check (type <> 'laererbarn' or teacher_guardian_id is not null)
);

create index if not exists student_fee_adjustments_student_year_idx
  on public.student_fee_adjustments (student_id, school_year_id);

create index if not exists student_fee_adjustments_year_type_idx
  on public.student_fee_adjustments (school_year_id, type);

create index if not exists student_fee_adjustments_teacher_idx
  on public.student_fee_adjustments (teacher_guardian_id)
  where teacher_guardian_id is not null;

alter table public.student_fee_adjustments enable row level security;

drop policy if exists "admin all" on public.student_fee_adjustments;
create policy "admin all" on public.student_fee_adjustments
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.student_fee_adjustments
  (student_id, school_year_id, type, amount, note, granted_by, legacy_fee_id)
select
  fee.student_id,
  fee.school_year_id,
  'annet',
  fee.discount,
  coalesce(nullif(btrim(fee.note), ''), 'Migrert fritak'),
  'migrering',
  fee.id
from public.student_fees fee
where fee.discount > 0
  and not exists (
    select 1
    from public.student_fee_adjustments adjustment
    where adjustment.legacy_fee_id = fee.id
  );

update public.student_fees fee
set discount = 0, updated_at = now()
where fee.discount > 0
  and exists (
    select 1
    from public.student_fee_adjustments adjustment
    where adjustment.legacy_fee_id = fee.id
  );

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
effective_allocations as (
  select
    allocation.student_id,
    allocation.school_year_id,
    greatest(
      least(
        allocation.amount::bigint,
        greatest(
          case
            when payment.voided_at is null then payment.net_paid_amount::bigint
            else 0::bigint
          end - coalesce(
            sum(allocation.amount) over (
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

create or replace view public.fee_adjustment_totals
with (security_invoker = true) as
select
  adjustment.school_year_id,
  adjustment.type,
  count(*) filter (where adjustment.revoked_at is null) as active_count,
  coalesce(sum(adjustment.amount) filter (where adjustment.revoked_at is null), 0) as active_amount,
  count(*) filter (where adjustment.revoked_at is not null) as revoked_count,
  coalesce(sum(adjustment.amount) filter (where adjustment.revoked_at is not null), 0) as revoked_amount
from public.student_fee_adjustments adjustment
group by adjustment.school_year_id, adjustment.type;

create or replace view public.teacher_gift_report
with (security_invoker = true) as
select
  guardian.id as teacher_guardian_id,
  guardian.first_name,
  guardian.last_name,
  adjustment.school_year_id,
  count(distinct adjustment.student_id) as student_count,
  coalesce(sum(adjustment.amount), 0) as total_amount
from public.student_fee_adjustments adjustment
join public.guardians guardian on guardian.id = adjustment.teacher_guardian_id
where adjustment.type = 'laererbarn'
  and adjustment.revoked_at is null
group by guardian.id, guardian.first_name, guardian.last_name, adjustment.school_year_id;
