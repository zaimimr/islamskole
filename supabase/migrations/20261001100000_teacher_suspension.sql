alter table public.guardians
  add column if not exists teacher_suspended_at timestamptz,
  add column if not exists teacher_suspended_reason text,
  add column if not exists teacher_suspended_by text;

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
    join public.guardians g on g.id = cs.guardian_id and g.is_teacher and g.teacher_suspended_at is null
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
      and g.teacher_suspended_at is null
      and ct.guardian_id in (select public.portal_guardian_ids())
  )
  or public.portal_is_substitute_of(p_class_id);
$$;

revoke all on function public.portal_is_teacher_of(uuid) from public, anon;
grant execute on function public.portal_is_teacher_of(uuid) to authenticated;

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
      where g.id in (select public.portal_guardian_ids())
        and g.is_teacher
        and g.teacher_suspended_at is null
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
  where g.id in (select public.portal_guardian_ids())
    and g.is_teacher
    and g.teacher_suspended_at is null
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
