create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger school_years_updated_at
  before update on public.school_years
  for each row execute function public.set_updated_at();

alter table public.school_years enable row level security;

create policy "school_years admin all" on public.school_years
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.school_years (label, starts_on, ends_on, is_active)
values ('2025/2026', '2025-08-01', '2026-06-30', true)
on conflict (label) do nothing;

alter table public.enrollments
  add column school_year_id uuid references public.school_years (id) on delete restrict;
alter table public.payments
  add column school_year_id uuid references public.school_years (id) on delete set null;

update public.enrollments
  set school_year_id = (select id from public.school_years where label = '2025/2026')
  where school_year_id is null;
update public.payments
  set school_year_id = (select id from public.school_years where label = '2025/2026')
  where school_year_id is null;

alter table public.enrollments alter column school_year_id set not null;

alter table public.enrollments
  drop constraint if exists enrollments_student_id_class_id_term_key;
alter table public.enrollments drop column if exists term;
alter table public.enrollments
  add constraint enrollments_student_class_year_key
  unique (student_id, class_id, school_year_id);

alter table public.payments drop column if exists term;

create index enrollments_school_year_idx on public.enrollments (school_year_id);
create index payments_school_year_idx on public.payments (school_year_id);
