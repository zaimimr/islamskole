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
    and lower(g.email) <> 'mangler@islamskole.no'
    and nullif(auth.jwt() ->> 'email', '') is not null
    and lower(g.email) = lower(auth.jwt() ->> 'email');
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
    join public.school_years sy on sy.id = d.school_year_id and sy.is_active
    join public.enrollments e
      on e.school_year_id = d.school_year_id
     and e.student_id = p_student_id
     and e.status = 'aktiv'
    join public.class_teachers ct
      on ct.class_id = e.class_id
     and ct.school_year_id = d.school_year_id
    join public.guardians g on g.id = ct.guardian_id and g.is_teacher
    where d.id = p_school_day_id
      and ct.guardian_id in (select public.portal_guardian_ids())
  );
$$;

create or replace function public.portal_class_roster(p_class_id uuid, p_school_day_id uuid)
returns table (
  student_id uuid,
  first_name text,
  last_name text,
  birth_date date,
  guardians jsonb,
  attendance_status text,
  attendance_marked_at timestamptz,
  absence_report_id uuid,
  absence_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_year uuid;
begin
  if not (public.is_admin() or public.portal_is_teacher_of(p_class_id)) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  select d.school_year_id into v_year
  from public.school_days d
  where d.id = p_school_day_id;

  if v_year is null then
    raise exception 'Fant ikke skoledagen.' using errcode = 'P0001';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.class_teachers ct
    join public.guardians g on g.id = ct.guardian_id and g.is_teacher
    where ct.class_id = p_class_id
      and ct.school_year_id = v_year
      and ct.guardian_id in (select public.portal_guardian_ids())
  ) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.child_first_name,
    s.child_last_name,
    s.child_birth_date,
    coalesce((
      select jsonb_agg(jsonb_build_object('first_name', g.first_name, 'last_name', g.last_name, 'phone', g.phone) order by sg.is_primary desc, sg.sort_order)
      from public.student_guardians sg
      join public.guardians g on g.id = sg.guardian_id
      where sg.student_id = s.id
    ), '[]'::jsonb),
    a.status,
    a.marked_at,
    r.id,
    r.reason
  from public.enrollments e
  join public.students s on s.id = e.student_id
  left join public.attendance a on a.student_id = s.id and a.school_day_id = p_school_day_id
  left join public.absence_reports r
    on r.student_id = s.id
   and r.school_day_id = p_school_day_id
   and r.withdrawn_at is null
  where e.class_id = p_class_id
    and e.school_year_id = v_year
    and e.status = 'aktiv'
  order by s.child_first_name, s.child_last_name;
end;
$$;

revoke all on function public.portal_class_roster(uuid, uuid) from public, anon;
grant execute on function public.portal_class_roster(uuid, uuid) to authenticated;

drop policy if exists "guardian withdraws child" on public.absence_reports;
create policy "guardian withdraws child" on public.absence_reports
  for update to authenticated
  using (
    public.portal_is_guardian_of(student_id)
    and withdrawn_at is null
    and public.portal_is_open_school_day(school_day_id)
  )
  with check (public.portal_is_guardian_of(student_id));

create or replace function public.attendance_stamp_marker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.marked_by := auth.uid();
    new.marked_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.attendance_stamp_marker() from public, anon, authenticated;

drop trigger if exists attendance_stamp_marker on public.attendance;
create trigger attendance_stamp_marker
  before insert or update on public.attendance
  for each row execute function public.attendance_stamp_marker();

create table if not exists public.portal_login_throttle (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.portal_login_throttle enable row level security;
revoke all on public.portal_login_throttle from public, anon, authenticated;

create or replace function public.portal_login_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.portal_login_throttle as t (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when t.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else t.window_start
        end,
        hits = case
          when t.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else t.hits + 1
        end
  returning hits into v_hits;

  delete from public.portal_login_throttle
  where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.portal_login_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.portal_login_hit(text, integer, integer) to service_role;
