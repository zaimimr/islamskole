create table if not exists public.class_substitutes (
  class_id uuid not null references public.classes(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  until date not null,
  created_at timestamptz not null default now(),
  primary key (class_id, guardian_id, school_year_id)
);

create index if not exists class_substitutes_guardian_idx on public.class_substitutes (guardian_id);
create index if not exists class_substitutes_school_year_idx on public.class_substitutes (school_year_id);

alter table public.class_substitutes enable row level security;
revoke all on public.class_substitutes from anon;
revoke insert, update, delete on public.class_substitutes from authenticated;

drop policy if exists "admin all" on public.class_substitutes;
create policy "admin all" on public.class_substitutes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teacher reads own" on public.class_substitutes;
create policy "teacher reads own" on public.class_substitutes
  for select to authenticated using (guardian_id in (select public.portal_guardian_ids()));

create or replace function public.portal_is_substitute_of(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_substitutes cs
    join public.guardians g on g.id = cs.guardian_id and g.is_teacher
    join public.school_years sy on sy.id = cs.school_year_id and sy.is_active
    where cs.class_id = p_class_id
      and cs.until >= (now() at time zone 'Europe/Oslo')::date
      and cs.guardian_id in (select public.portal_guardian_ids())
  );
$$;

revoke all on function public.portal_is_substitute_of(uuid) from public, anon;
grant execute on function public.portal_is_substitute_of(uuid) to authenticated;

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
  )
  or public.portal_is_substitute_of(p_class_id);
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
    where d.id = p_school_day_id
      and public.portal_is_teacher_of(e.class_id)
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
    select 1 from public.school_years sy where sy.id = v_year and sy.is_active
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

drop function if exists public.portal_my_classes();
create function public.portal_my_classes()
returns table (
  class_id uuid,
  name_no text,
  name_en text,
  school_year_id uuid,
  school_year_label text,
  role text,
  student_count integer,
  substitute_until date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name_no,
    c.name_en,
    sy.id,
    sy.label,
    coalesce(
      (
        select min(ct.role)
        from public.class_teachers ct
        join public.guardians g on g.id = ct.guardian_id and g.is_teacher
        where ct.class_id = c.id
          and ct.school_year_id = sy.id
          and ct.guardian_id in (select public.portal_guardian_ids())
      ),
      'vikar'
    ),
    (
      select count(*)::integer
      from public.enrollments e
      where e.class_id = c.id
        and e.school_year_id = sy.id
        and e.status = 'aktiv'
    ),
    (
      select max(cs.until)
      from public.class_substitutes cs
      where cs.class_id = c.id
        and cs.school_year_id = sy.id
        and cs.guardian_id in (select public.portal_guardian_ids())
        and cs.until >= (now() at time zone 'Europe/Oslo')::date
    )
  from public.classes c
  cross join public.school_years sy
  where sy.is_active
    and public.portal_is_teacher_of(c.id)
  order by c.sort_order, c.name_no;
$$;

revoke all on function public.portal_my_classes() from public, anon;
grant execute on function public.portal_my_classes() to authenticated;

create or replace function public.portal_substitute_options()
returns table (
  class_id uuid,
  name_no text,
  name_en text,
  student_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name_no,
    c.name_en,
    count(e.student_id)::integer
  from public.classes c
  join public.school_years sy on sy.is_active
  left join public.enrollments e
    on e.class_id = c.id and e.school_year_id = sy.id and e.status = 'aktiv'
  where exists (
      select 1 from public.guardians g
      where g.id in (select public.portal_guardian_ids()) and g.is_teacher
    )
    and not public.portal_is_teacher_of(c.id)
    and (c.published or e.student_id is not null)
  group by c.id
  order by c.sort_order, c.name_no;
$$;

revoke all on function public.portal_substitute_options() from public, anon;
grant execute on function public.portal_substitute_options() to authenticated;

create or replace function public.portal_start_substitute(p_class_id uuid)
returns date
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_guardian uuid;
  v_year uuid;
  v_until date := (now() at time zone 'Europe/Oslo')::date + 7;
begin
  select g.id into v_guardian
  from public.guardians g
  where g.id in (select public.portal_guardian_ids()) and g.is_teacher
  order by g.created_at
  limit 1;

  if v_guardian is null then
    raise exception 'Bare lærere kan være vikar.' using errcode = '42501';
  end if;

  select sy.id into v_year from public.school_years sy where sy.is_active;
  if v_year is null or not exists (select 1 from public.classes c where c.id = p_class_id) then
    raise exception 'Fant ikke klassen.' using errcode = 'P0001';
  end if;

  insert into public.class_substitutes (class_id, guardian_id, school_year_id, until)
  values (p_class_id, v_guardian, v_year, v_until)
  on conflict (class_id, guardian_id, school_year_id)
  do update set until = excluded.until, created_at = now();

  return v_until;
end;
$$;

revoke all on function public.portal_start_substitute(uuid) from public, anon;
grant execute on function public.portal_start_substitute(uuid) to authenticated;

create or replace function public.portal_end_substitute(p_class_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.class_substitutes
  where class_id = p_class_id
    and guardian_id in (select public.portal_guardian_ids());
$$;

revoke all on function public.portal_end_substitute(uuid) from public, anon;
grant execute on function public.portal_end_substitute(uuid) to authenticated;
