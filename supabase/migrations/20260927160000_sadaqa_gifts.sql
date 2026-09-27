create table if not exists public.sadaqa_gifts (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount > 0),
  received_on date not null default current_date,
  method text not null check (method in ('vipps', 'bank', 'kontant', 'overbetaling', 'annet')),
  donor_name text,
  family_id uuid references public.families(id) on delete set null,
  source_payment_id uuid references public.payments(id) on delete restrict,
  school_year_id uuid references public.school_years(id) on delete set null,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text,
  void_reason text
);

create index if not exists sadaqa_gifts_received_on_idx on public.sadaqa_gifts (received_on desc);
create index if not exists sadaqa_gifts_source_payment_idx on public.sadaqa_gifts (source_payment_id);

alter table public.sadaqa_gifts enable row level security;

drop policy if exists "admin all" on public.sadaqa_gifts;
create policy "admin all" on public.sadaqa_gifts
  for all using (public.is_admin()) with check (public.is_admin());
