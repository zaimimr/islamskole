create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  role text not null default 'lærer',
  created_at timestamptz not null default now(),
  primary key (class_id, guardian_id, school_year_id)
);

create index if not exists class_teachers_guardian_idx on public.class_teachers (guardian_id);

create table if not exists public.school_days (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  date date not null,
  cancelled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (school_year_id, date)
);

create index if not exists school_days_date_idx on public.school_days (date);

create table if not exists public.attendance (
  student_id uuid not null references public.students(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  status text not null check (status in ('til_stede', 'fravaer', 'meldt_fravaer', 'sent')),
  marked_by uuid default auth.uid(),
  marked_at timestamptz not null default now(),
  primary key (student_id, school_day_id)
);

create index if not exists attendance_school_day_idx on public.attendance (school_day_id);

create table if not exists public.class_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  homework text,
  summary text,
  author_guardian_id uuid references public.guardians(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, school_day_id)
);

create table if not exists public.absence_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  reason text,
  reported_by_guardian_id uuid references public.guardians(id) on delete set null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create unique index if not exists absence_reports_one_open
  on public.absence_reports (student_id, school_day_id)
  where withdrawn_at is null;
create index if not exists absence_reports_school_day_idx on public.absence_reports (school_day_id);

drop trigger if exists class_notes_updated_at on public.class_notes;
create trigger class_notes_updated_at
  before update on public.class_notes
  for each row execute function public.set_updated_at();

create or replace function public.portal_guardian_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.guardians g
  where g.email is not null
    and nullif(auth.jwt() ->> 'email', '') is not null
    and lower(g.email) = lower(auth.jwt() ->> 'email');
$$;

create or replace function public.portal_is_teacher_of(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_teachers ct
    join public.guardians g on g.id = ct.guardian_id
    join public.school_years sy on sy.id = ct.school_year_id
    where ct.class_id = p_class_id
      and sy.is_active
      and g.is_teacher
      and ct.guardian_id in (select public.portal_guardian_ids())
  );
$$;

create or replace function public.portal_is_guardian_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = p_student_id
      and sg.guardian_id in (select public.portal_guardian_ids())
  );
$$;

create or replace function public.portal_teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.school_years sy on sy.id = e.school_year_id
    where e.student_id = p_student_id
      and e.status = 'aktiv'
      and sy.is_active
      and public.portal_is_teacher_of(e.class_id)
  );
$$;

create or replace function public.portal_is_guardian_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.school_years sy on sy.id = e.school_year_id
    where e.class_id = p_class_id
      and e.status = 'aktiv'
      and sy.is_active
      and public.portal_is_guardian_of(e.student_id)
  );
$$;

create or replace function public.portal_can_mark(p_student_id uuid, p_school_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_days d
    join public.enrollments e
      on e.school_year_id = d.school_year_id
     and e.student_id = p_student_id
     and e.status = 'aktiv'
    where d.id = p_school_day_id
      and public.portal_is_teacher_of(e.class_id)
  );
$$;

create or replace function public.portal_is_open_school_day(p_school_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_days d
    join public.school_years sy on sy.id = d.school_year_id
    where d.id = p_school_day_id
      and sy.is_active
      and not d.cancelled
      and d.date >= (now() at time zone 'Europe/Oslo')::date
  );
$$;

revoke all on function public.portal_guardian_ids() from public, anon;
revoke all on function public.portal_is_teacher_of(uuid) from public, anon;
revoke all on function public.portal_is_guardian_of(uuid) from public, anon;
revoke all on function public.portal_teaches_student(uuid) from public, anon;
revoke all on function public.portal_is_guardian_in_class(uuid) from public, anon;
revoke all on function public.portal_can_mark(uuid, uuid) from public, anon;
revoke all on function public.portal_is_open_school_day(uuid) from public, anon;
grant execute on function public.portal_guardian_ids() to authenticated;
grant execute on function public.portal_is_teacher_of(uuid) to authenticated;
grant execute on function public.portal_is_guardian_of(uuid) to authenticated;
grant execute on function public.portal_teaches_student(uuid) to authenticated;
grant execute on function public.portal_is_guardian_in_class(uuid) to authenticated;
grant execute on function public.portal_can_mark(uuid, uuid) to authenticated;
grant execute on function public.portal_is_open_school_day(uuid) to authenticated;

create or replace function public.portal_absence_to_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.withdrawn_at is null then
    insert into public.attendance (student_id, school_day_id, status, marked_by)
    values (new.student_id, new.school_day_id, 'meldt_fravaer', auth.uid())
    on conflict (student_id, school_day_id) do nothing;
  elsif tg_op = 'UPDATE' and old.withdrawn_at is null and new.withdrawn_at is not null then
    delete from public.attendance
    where student_id = new.student_id
      and school_day_id = new.school_day_id
      and status = 'meldt_fravaer';
  end if;
  return new;
end;
$$;

revoke all on function public.portal_absence_to_attendance() from public, anon, authenticated;

drop trigger if exists absence_reports_attendance on public.absence_reports;
create trigger absence_reports_attendance
  after insert or update of withdrawn_at on public.absence_reports
  for each row execute function public.portal_absence_to_attendance();

alter table public.class_teachers enable row level security;
alter table public.school_days enable row level security;
alter table public.attendance enable row level security;
alter table public.class_notes enable row level security;
alter table public.absence_reports enable row level security;

revoke all on public.class_teachers, public.school_days, public.attendance, public.class_notes, public.absence_reports from anon;
revoke update on public.absence_reports from authenticated;
grant update (withdrawn_at, reason) on public.absence_reports to authenticated;

drop policy if exists "admin all" on public.class_teachers;
create policy "admin all" on public.class_teachers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "teacher reads own" on public.class_teachers;
create policy "teacher reads own" on public.class_teachers
  for select to authenticated using (guardian_id in (select public.portal_guardian_ids()));

drop policy if exists "admin all" on public.school_days;
create policy "admin all" on public.school_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "signed in reads" on public.school_days;
create policy "signed in reads" on public.school_days
  for select to authenticated using (true);

drop policy if exists "admin all" on public.attendance;
create policy "admin all" on public.attendance
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "guardian reads child" on public.attendance;
create policy "guardian reads child" on public.attendance
  for select to authenticated using (public.portal_is_guardian_of(student_id));
drop policy if exists "teacher reads class" on public.attendance;
create policy "teacher reads class" on public.attendance
  for select to authenticated using (public.portal_can_mark(student_id, school_day_id));
drop policy if exists "teacher inserts class" on public.attendance;
create policy "teacher inserts class" on public.attendance
  for insert to authenticated with check (public.portal_can_mark(student_id, school_day_id));
drop policy if exists "teacher updates class" on public.attendance;
create policy "teacher updates class" on public.attendance
  for update to authenticated
  using (public.portal_can_mark(student_id, school_day_id))
  with check (public.portal_can_mark(student_id, school_day_id));
drop policy if exists "teacher deletes class" on public.attendance;
create policy "teacher deletes class" on public.attendance
  for delete to authenticated using (public.portal_can_mark(student_id, school_day_id));

drop policy if exists "admin all" on public.class_notes;
create policy "admin all" on public.class_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "teacher reads class" on public.class_notes;
create policy "teacher reads class" on public.class_notes
  for select to authenticated using (public.portal_is_teacher_of(class_id));
drop policy if exists "teacher inserts class" on public.class_notes;
create policy "teacher inserts class" on public.class_notes
  for insert to authenticated with check (
    public.portal_is_teacher_of(class_id)
    and (author_guardian_id is null or author_guardian_id in (select public.portal_guardian_ids()))
  );
drop policy if exists "teacher updates class" on public.class_notes;
create policy "teacher updates class" on public.class_notes
  for update to authenticated
  using (public.portal_is_teacher_of(class_id))
  with check (
    public.portal_is_teacher_of(class_id)
    and (author_guardian_id is null or author_guardian_id in (select public.portal_guardian_ids()))
  );
drop policy if exists "guardian reads class" on public.class_notes;
create policy "guardian reads class" on public.class_notes
  for select to authenticated using (public.portal_is_guardian_in_class(class_id));

drop policy if exists "admin all" on public.absence_reports;
create policy "admin all" on public.absence_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "guardian reads child" on public.absence_reports;
create policy "guardian reads child" on public.absence_reports
  for select to authenticated using (public.portal_is_guardian_of(student_id));
drop policy if exists "guardian reports child" on public.absence_reports;
create policy "guardian reports child" on public.absence_reports
  for insert to authenticated with check (
    public.portal_is_guardian_of(student_id)
    and reported_by_guardian_id in (select public.portal_guardian_ids())
    and withdrawn_at is null
    and public.portal_is_open_school_day(school_day_id)
  );
drop policy if exists "guardian withdraws child" on public.absence_reports;
create policy "guardian withdraws child" on public.absence_reports
  for update to authenticated
  using (public.portal_is_guardian_of(student_id) and withdrawn_at is null)
  with check (public.portal_is_guardian_of(student_id));
drop policy if exists "teacher reads class" on public.absence_reports;
create policy "teacher reads class" on public.absence_reports
  for select to authenticated using (public.portal_can_mark(student_id, school_day_id));

create or replace function public.ensure_school_days(p_school_year_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_first date;
  v_count integer;
begin
  select starts_on, ends_on into v_start, v_end
  from public.school_years
  where id = p_school_year_id;

  if v_start is null or v_end is null then
    raise exception 'Skoleåret mangler start- eller sluttdato.' using errcode = 'P0001';
  end if;

  v_first := v_start + ((7 - extract(dow from v_start)::integer) % 7);

  insert into public.school_days (school_year_id, date)
  select p_school_year_id, day::date
  from generate_series(v_first, v_end, interval '7 days') as day
  on conflict (school_year_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.ensure_school_days(uuid) from public, anon;
grant execute on function public.ensure_school_days(uuid) to authenticated, service_role;
