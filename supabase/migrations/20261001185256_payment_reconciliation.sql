create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('vipps', 'dnb')),
  kind text not null check (kind in ('api', 'fil')),
  account text,
  file_name text,
  period_from date,
  period_to date,
  row_count integer not null default 0 check (row_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  errors jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists import_batches_created_at_idx on public.import_batches (created_at desc);

create table if not exists public.external_transactions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('vipps', 'dnb')),
  account text not null check (length(account) between 1 and 40),
  external_id text not null check (length(external_id) between 1 and 200),
  booked_on date not null,
  booked_at timestamptz,
  amount integer not null check (amount <> 0),
  currency text not null default 'NOK',
  counterparty_name text,
  counterparty_phone text,
  message text,
  reference text,
  psp_reference text,
  entry_type text,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  import_batch_id uuid references public.import_batches(id) on delete set null,
  status text not null default 'ny' check (status in ('ny', 'matchet', 'sadaqa', 'familie', 'ignorert')),
  suggested_status text check (suggested_status in ('matchet', 'sadaqa', 'familie', 'ignorert')),
  suggestion_reason text,
  matched_payment_id uuid references public.payments(id) on delete restrict,
  sadaqa_gift_id uuid references public.sadaqa_gifts(id) on delete restrict,
  family_id uuid references public.families(id) on delete set null,
  mapped_by text,
  mapped_at timestamptz,
  note text,
  constraint external_transactions_source_account_external_id_key unique (source, account, external_id),
  constraint external_transactions_open_unmapped check (
    status <> 'ny' or (matched_payment_id is null and sadaqa_gift_id is null and mapped_at is null)
  ),
  constraint external_transactions_payment_required check (
    status not in ('matchet', 'familie') or (matched_payment_id is not null and sadaqa_gift_id is null)
  ),
  constraint external_transactions_gift_required check (
    status <> 'sadaqa' or (sadaqa_gift_id is not null and matched_payment_id is null)
  ),
  constraint external_transactions_ignored_reason check (
    status <> 'ignorert' or (length(trim(coalesce(note, ''))) > 0 and matched_payment_id is null and sadaqa_gift_id is null)
  )
);

create index if not exists external_transactions_status_booked_idx
  on public.external_transactions (status, booked_on desc);
create index if not exists external_transactions_batch_idx
  on public.external_transactions (import_batch_id);
create index if not exists external_transactions_family_idx
  on public.external_transactions (family_id);
create index if not exists external_transactions_psp_idx
  on public.external_transactions (source, account, psp_reference);
create unique index if not exists external_transactions_payment_once_idx
  on public.external_transactions (matched_payment_id)
  where matched_payment_id is not null;
create unique index if not exists external_transactions_gift_once_idx
  on public.external_transactions (sadaqa_gift_id)
  where sadaqa_gift_id is not null;

alter table public.import_batches enable row level security;
alter table public.external_transactions enable row level security;

drop policy if exists "admin all" on public.import_batches;
create policy "admin all" on public.import_batches
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin all" on public.external_transactions;
create policy "admin all" on public.external_transactions
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.import_batches from anon;
revoke all on public.external_transactions from anon;
