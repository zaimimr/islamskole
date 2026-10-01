drop function if exists public.portal_my_lessons(date, date);
drop function if exists public.portal_lessons(uuid[]);
create function public.portal_lessons(p_school_day_ids uuid[])
returns table (
  lesson_id uuid,
  school_day_id uuid,
  date date,
  class_id uuid,
  class_name_no text,
  class_name_en text,
  start_position integer,
  end_position integer,
  start_label text,
  end_label text,
  starts_at time,
  ends_at time,
  subject text,
  teacher_guardian_id uuid,
  teacher_first_name text,
  teacher_last_name text,
  is_substitute boolean,
  cancelled boolean,
  is_mine boolean,
  note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.school_day_id,
    d.date,
    l.class_id,
    c.name_no,
    c.name_en,
    l.start_position,
    l.end_position,
    s1.label,
    s2.label,
    s1.starts_at,
    s2.ends_at,
    l.subject,
    l.teacher_guardian_id,
    g.first_name,
    g.last_name,
    l.is_substitute,
    l.cancelled or d.cancelled,
    coalesce(l.teacher_guardian_id in (select public.portal_guardian_ids()), false),
    l.note
  from public.lessons l
  join public.school_days d on d.id = l.school_day_id
  join public.classes c on c.id = l.class_id
  left join public.school_time_slots s1 on s1.school_year_id = d.school_year_id and s1.position = l.start_position
  left join public.school_time_slots s2 on s2.school_year_id = d.school_year_id and s2.position = l.end_position
  left join public.guardians g on g.id = l.teacher_guardian_id
  where l.school_day_id = any(p_school_day_ids)
    and (public.is_admin() or public.portal_can_read_lesson(l.id))
  order by d.date, c.sort_order, c.name_no, l.start_position;
$$;

revoke all on function public.portal_lessons(uuid[]) from public, anon;
grant execute on function public.portal_lessons(uuid[]) to authenticated;

create function public.portal_my_lessons(p_from date, p_to date)
returns table (
  lesson_id uuid,
  school_day_id uuid,
  date date,
  class_id uuid,
  class_name_no text,
  class_name_en text,
  start_position integer,
  end_position integer,
  start_label text,
  end_label text,
  starts_at time,
  ends_at time,
  subject text,
  teacher_guardian_id uuid,
  teacher_first_name text,
  teacher_last_name text,
  is_substitute boolean,
  cancelled boolean,
  is_mine boolean,
  note text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.portal_lessons(array(
    select l.school_day_id
    from public.lessons l
    join public.school_days d on d.id = l.school_day_id
    join public.school_years sy on sy.id = d.school_year_id and sy.is_active
    where d.date between p_from and p_to
      and public.portal_teaches_lesson(l.id)
  )) p
  where public.portal_teaches_lesson(p.lesson_id);
$$;

revoke all on function public.portal_my_lessons(date, date) from public, anon;
grant execute on function public.portal_my_lessons(date, date) to authenticated;
