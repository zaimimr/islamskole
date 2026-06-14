create table public.student_applications (
  id uuid primary key default gen_random_uuid(),
  child_name text not null,
  child_age int,
  guardian_name text not null,
  email text not null,
  phone text,
  desired_class text,
  message text,
  status text not null default 'ny' check (status in ('ny', 'kontaktet', 'arkivert')),
  created_at timestamptz not null default now()
);

alter table public.student_applications enable row level security;

create policy "student app public insert" on public.student_applications
  for insert with check (true);
create policy "student app admin read" on public.student_applications
  for select using (public.is_admin());
create policy "student app admin update" on public.student_applications
  for update using (public.is_admin()) with check (public.is_admin());
create policy "student app admin delete" on public.student_applications
  for delete using (public.is_admin());
