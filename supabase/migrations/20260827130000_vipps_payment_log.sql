alter table public.payments
  add column if not exists payer_name text,
  add column if not exists payer_phone text,
  add column if not exists payer_email text,
  add column if not exists vipps_payment_method text,
  add column if not exists psp_reference text,
  add column if not exists last_synced_at timestamptz;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments (id) on delete set null,
  reference text not null,
  name text not null,
  amount integer,
  success boolean,
  psp_reference text,
  idempotency_key text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (reference, name, occurred_at)
);

create index if not exists payment_events_reference_idx
  on public.payment_events (reference, occurred_at desc);
create index if not exists payment_events_payment_idx
  on public.payment_events (payment_id, occurred_at desc);
create index if not exists payment_events_occurred_idx
  on public.payment_events (occurred_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "payment_events admin read" on public.payment_events;
create policy "payment_events admin read" on public.payment_events
  for select using (public.is_admin());

create index if not exists payments_year_status_idx
  on public.payments (school_year_id, status);
