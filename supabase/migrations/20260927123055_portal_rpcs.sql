create or replace function public.portal_my_children()
returns table (
  student_id uuid,
  first_name text,
  last_name text,
  birth_date date,
  class_id uuid,
  class_name_no text,
  class_name_en text,
  school_year_id uuid,
  school_year_label text,
  teachers jsonb,
  remaining_ore bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.child_first_name,
    s.child_last_name,
    s.child_birth_date,
    c.id,
    c.name_no,
    c.name_en,
    sy.id,
    sy.label,
    coalesce((
      select jsonb_agg(jsonb_build_object('first_name', g.first_name, 'last_name', g.last_name) order by g.first_name, g.last_name)
      from public.class_teachers ct
      join public.guardians g on g.id = ct.guardian_id
      where ct.class_id = c.id
        and ct.school_year_id = sy.id
        and g.is_teacher
    ), '[]'::jsonb),
    (
      select b.remaining::bigint
      from public.student_balances b
      where b.student_id = s.id
        and b.school_year_id = sy.id
    )
  from public.students s
  join public.enrollments e on e.student_id = s.id and e.status = 'aktiv'
  join public.school_years sy on sy.id = e.school_year_id and sy.is_active
  join public.classes c on c.id = e.class_id
  where exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = s.id
      and sg.guardian_id in (select public.portal_guardian_ids())
  )
  order by s.child_birth_date nulls last, s.child_first_name;
$$;

create or replace function public.portal_my_classes()
returns table (
  class_id uuid,
  name_no text,
  name_en text,
  school_year_id uuid,
  school_year_label text,
  role text,
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
    sy.id,
    sy.label,
    min(ct.role),
    (
      select count(*)::integer
      from public.enrollments e
      where e.class_id = c.id
        and e.school_year_id = sy.id
        and e.status = 'aktiv'
    )
  from public.class_teachers ct
  join public.guardians g on g.id = ct.guardian_id and g.is_teacher
  join public.school_years sy on sy.id = ct.school_year_id and sy.is_active
  join public.classes c on c.id = ct.class_id
  where ct.guardian_id in (select public.portal_guardian_ids())
  group by c.id, sy.id
  order by c.sort_order, c.name_no;
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

revoke all on function public.portal_my_children() from public, anon;
revoke all on function public.portal_my_classes() from public, anon;
revoke all on function public.portal_class_roster(uuid, uuid) from public, anon;
grant execute on function public.portal_my_children() to authenticated;
grant execute on function public.portal_my_classes() to authenticated;
grant execute on function public.portal_class_roster(uuid, uuid) to authenticated;
