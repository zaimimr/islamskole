alter table public.payments
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists duplicate_of_payment_id uuid
    references public.payments (id) on delete set null,
  add column if not exists duplicate_reviewed_at timestamptz,
  add column if not exists duplicate_reviewed_by text;

create index if not exists payments_voided_idx
  on public.payments (voided_at) where voided_at is not null;

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
    and p.voided_at is null
) settled on true;

create or replace view public.duplicate_payment_candidates
with (security_invoker = true) as
select
  manual.id as payment_id,
  manual.amount,
  manual.description,
  manual.paid_at,
  manual.method,
  allocation.student_id,
  allocation.school_year_id,
  substring(manual.description from 'isk-[0-9a-f-]+') as cited_reference,
  original.id as matched_payment_id,
  original.reference as matched_reference,
  original.amount as matched_amount,
  original.created_at as matched_created_at,
  case
    when substring(manual.description from 'isk-[0-9a-f-]+') is not null
      and original.id is not null then 'cited_reference'
    when original.id is not null then 'note_mentions_vipps'
    else 'unmatched'
  end as evidence
from public.payments manual
join public.payment_allocations allocation on allocation.payment_id = manual.id
left join lateral (
  select p.id, p.reference, p.amount, p.created_at
  from public.payments p
  join public.payment_allocations a on a.payment_id = p.id
  where p.method = 'vipps'
    and p.status = 'fanget'
    and p.voided_at is null
    and a.student_id = allocation.student_id
    and a.school_year_id = allocation.school_year_id
    and a.amount = allocation.amount
  order by
    case
      when p.reference = substring(manual.description from 'isk-[0-9a-f-]+') then 0
      else 1
    end,
    p.created_at
  limit 1
) original on true
where manual.method <> 'vipps'
  and manual.status = 'fanget'
  and manual.voided_at is null
  and manual.duplicate_reviewed_at is null
  and manual.description ~* '(isk-[0-9a-f-]+|vipps)'
  and original.id is not null;
