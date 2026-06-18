alter table public.payments
  add column if not exists method text not null default 'vipps'
    check (method in ('vipps', 'kontant', 'bank', 'annet'));

alter table public.payments
  add column if not exists paid_at timestamptz;

update public.payments
  set paid_at = captured_at
  where paid_at is null and captured_at is not null;
