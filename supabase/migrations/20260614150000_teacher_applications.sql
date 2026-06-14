create table public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  subjects text,
  message text,
  status text not null default 'ny' check (status in ('ny', 'kontaktet', 'arkivert')),
  created_at timestamptz not null default now()
);

create index teacher_applications_created_at_idx on public.teacher_applications (created_at desc);

alter table public.teacher_applications enable row level security;

create policy "teacher applications public insert" on public.teacher_applications
  for insert with check (true);

create policy "teacher applications admin read" on public.teacher_applications
  for select using (public.is_admin());

create policy "teacher applications admin update" on public.teacher_applications
  for update using (public.is_admin()) with check (public.is_admin());

create policy "teacher applications admin delete" on public.teacher_applications
  for delete using (public.is_admin());
