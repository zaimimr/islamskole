create table public.students (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.student_applications (id) on delete set null,
  full_name text not null,
  child_age int,
  guardian_name text not null,
  email text,
  phone text,
  level_quran text,
  level_arabic text,
  level_islam text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  term text not null,
  status text not null default 'aktiv' check (status in ('aktiv', 'avsluttet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_id, term)
);

create index enrollments_student_idx on public.enrollments (student_id);
create index enrollments_class_idx on public.enrollments (class_id);

create trigger enrollments_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  reference text not null unique,
  amount int not null,
  currency text not null default 'NOK',
  term text,
  description text,
  status text not null default 'opprettet'
    check (status in ('opprettet', 'autorisert', 'fanget', 'avbrutt', 'refundert', 'feilet')),
  vipps_state text,
  redirect_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  captured_at timestamptz
);

create index payments_student_idx on public.payments (student_id);

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;

create policy "students admin all" on public.students
  for all using (public.is_admin()) with check (public.is_admin());

create policy "enrollments admin all" on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "payments admin all" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());
