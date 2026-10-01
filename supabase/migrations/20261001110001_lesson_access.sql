create or replace function public.portal_teaches_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.school_days d on d.id = l.school_day_id
    join public.school_years sy on sy.id = d.school_year_id and sy.is_active
    where l.id = p_lesson_id
      and (
        exists (
          select 1
          from public.guardians g
          where g.id = l.teacher_guardian_id
            and g.is_teacher
            and g.teacher_suspended_at is null
            and g.id in (select public.portal_guardian_ids())
        )
        or public.portal_is_teacher_of(l.class_id)
      )
  );
$$;

create or replace function public.portal_can_read_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.school_days d on d.id = l.school_day_id
    join public.school_years sy on sy.id = d.school_year_id and sy.is_active
    where l.id = p_lesson_id
      and (
        public.portal_teaches_lesson(l.id)
        or public.portal_is_guardian_in_class(l.class_id)
        or public.portal_is_student_in_class(l.class_id)
      )
  );
$$;

create or replace function public.portal_can_mark_lesson(p_student_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.school_days d on d.id = l.school_day_id
    join public.enrollments e
      on e.class_id = l.class_id
     and e.school_year_id = d.school_year_id
     and e.student_id = p_student_id
     and e.status = 'aktiv'
    where l.id = p_lesson_id
      and public.portal_teaches_lesson(l.id)
  );
$$;

create or replace function public.portal_can_write_lesson_attendance(p_student_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portal_can_mark_lesson(p_student_id, p_lesson_id)
    and exists (
      select 1
      from public.lessons l
      join public.school_days d on d.id = l.school_day_id
      where l.id = p_lesson_id
        and not l.cancelled
        and not d.cancelled
        and d.date <= (now() at time zone 'Europe/Oslo')::date
    );
$$;

revoke all on function public.portal_teaches_lesson(uuid) from public, anon;
revoke all on function public.portal_can_read_lesson(uuid) from public, anon;
revoke all on function public.portal_can_mark_lesson(uuid, uuid) from public, anon;
revoke all on function public.portal_can_write_lesson_attendance(uuid, uuid) from public, anon;
grant execute on function public.portal_teaches_lesson(uuid) to authenticated;
grant execute on function public.portal_can_read_lesson(uuid) to authenticated;
grant execute on function public.portal_can_mark_lesson(uuid, uuid) to authenticated;
grant execute on function public.portal_can_write_lesson_attendance(uuid, uuid) to authenticated;

drop policy if exists "portal reads" on public.lessons;
create policy "portal reads" on public.lessons
  for select to authenticated using (public.portal_can_read_lesson(id));

drop policy if exists "lesson teacher reads" on public.attendance;
create policy "lesson teacher reads" on public.attendance
  for select to authenticated
  using (lesson_id is not null and public.portal_can_mark_lesson(student_id, lesson_id));
drop policy if exists "lesson teacher inserts" on public.attendance;
create policy "lesson teacher inserts" on public.attendance
  for insert to authenticated
  with check (lesson_id is not null and public.portal_can_write_lesson_attendance(student_id, lesson_id));
drop policy if exists "lesson teacher updates" on public.attendance;
create policy "lesson teacher updates" on public.attendance
  for update to authenticated
  using (lesson_id is not null and public.portal_can_write_lesson_attendance(student_id, lesson_id))
  with check (lesson_id is not null and public.portal_can_write_lesson_attendance(student_id, lesson_id));
drop policy if exists "lesson teacher deletes" on public.attendance;
create policy "lesson teacher deletes" on public.attendance
  for delete to authenticated
  using (lesson_id is not null and public.portal_can_mark_lesson(student_id, lesson_id));

drop policy if exists "lesson teacher reads" on public.class_notes;
create policy "lesson teacher reads" on public.class_notes
  for select to authenticated using (public.portal_teaches_lesson(lesson_id));
drop policy if exists "lesson teacher inserts" on public.class_notes;
create policy "lesson teacher inserts" on public.class_notes
  for insert to authenticated
  with check (
    public.portal_teaches_lesson(lesson_id)
    and public.portal_is_uncancelled_day(school_day_id)
    and (author_guardian_id is null or author_guardian_id in (select public.portal_guardian_ids()))
  );
drop policy if exists "lesson teacher updates" on public.class_notes;
create policy "lesson teacher updates" on public.class_notes
  for update to authenticated
  using (public.portal_teaches_lesson(lesson_id) and public.portal_is_uncancelled_day(school_day_id))
  with check (
    public.portal_teaches_lesson(lesson_id)
    and public.portal_is_uncancelled_day(school_day_id)
    and (author_guardian_id is null or author_guardian_id in (select public.portal_guardian_ids()))
  );
drop policy if exists "lesson teacher deletes" on public.class_notes;
create policy "lesson teacher deletes" on public.class_notes
  for delete to authenticated using (public.portal_teaches_lesson(lesson_id));

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
  is_mine boolean
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
    coalesce(l.teacher_guardian_id in (select public.portal_guardian_ids()), false)
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

drop function if exists public.portal_my_lessons(date, date);
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
  is_mine boolean
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

drop function if exists public.portal_lesson_roster(uuid);
create function public.portal_lesson_roster(p_lesson_id uuid)
returns table (
  student_id uuid,
  first_name text,
  last_name text,
  birth_date date,
  guardians jsonb,
  attendance_status text,
  attendance_marked_at timestamptz,
  absence_report_id uuid,
  absence_reason text,
  allergies text,
  medical_notes text,
  photo_consent boolean,
  pickup jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lesson record;
begin
  select l.id, l.class_id, l.school_day_id, d.school_year_id into v_lesson
  from public.lessons l
  join public.school_days d on d.id = l.school_day_id
  where l.id = p_lesson_id;

  if not found then
    raise exception 'Fant ikke timen.' using errcode = 'P0001';
  end if;

  if not (public.is_admin() or public.portal_teaches_lesson(p_lesson_id)) then
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
    r.reason,
    s.allergies,
    s.medical_notes,
    s.photo_consent,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'phone', p.phone, 'relation', p.relation) order by p.created_at)
      from public.family_pickup_persons p
      where p.family_id = s.family_id
    ), '[]'::jsonb)
  from public.enrollments e
  join public.students s on s.id = e.student_id
  left join public.attendance a on a.student_id = s.id and a.lesson_id = v_lesson.id
  left join public.absence_reports r
    on r.student_id = s.id
   and r.school_day_id = v_lesson.school_day_id
   and r.withdrawn_at is null
  where e.class_id = v_lesson.class_id
    and e.school_year_id = v_lesson.school_year_id
    and e.status = 'aktiv'
  order by s.child_first_name, s.child_last_name;
end;
$$;

revoke all on function public.portal_lesson_roster(uuid) from public, anon;
grant execute on function public.portal_lesson_roster(uuid) to authenticated;

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
  absence_reason text,
  allergies text,
  medical_notes text,
  photo_consent boolean,
  pickup jsonb
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
    r.reason,
    s.allergies,
    s.medical_notes,
    s.photo_consent,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'phone', p.phone, 'relation', p.relation) order by p.created_at)
      from public.family_pickup_persons p
      where p.family_id = s.family_id
    ), '[]'::jsonb)
  from public.enrollments e
  join public.students s on s.id = e.student_id
  left join lateral (
    select x.status, x.marked_at
    from public.attendance x
    left join public.lessons xl on xl.id = x.lesson_id
    where x.student_id = s.id
      and x.school_day_id = p_school_day_id
    order by xl.start_position nulls first
    limit 1
  ) a on true
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

create or replace function public.portal_my_self()
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
  notes jsonb,
  attendance jsonb
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
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'date', d.date,
        'homework', n.homework,
        'summary', n.summary,
        'lesson_id', n.lesson_id,
        'subject', l.subject,
        'start_position', l.start_position,
        'end_position', l.end_position
      ) order by d.date desc, l.start_position)
      from public.class_notes n
      join public.school_days d on d.id = n.school_day_id
      left join public.lessons l on l.id = n.lesson_id
      where n.class_id = c.id
        and d.school_year_id = sy.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.date,
        'status', a.status,
        'lesson_id', a.lesson_id,
        'start_position', l.start_position
      ) order by d.date desc, l.start_position)
      from public.attendance a
      join public.school_days d on d.id = a.school_day_id
      join public.school_years y on y.id = d.school_year_id and y.is_active
      left join public.lessons l on l.id = a.lesson_id
      where a.student_id = s.id
    ), '[]'::jsonb)
  from public.students s
  left join public.enrollments e
    on e.student_id = s.id
   and e.status = 'aktiv'
   and e.school_year_id in (select id from public.school_years where is_active)
  left join public.classes c on c.id = e.class_id
  left join public.school_years sy on sy.id = e.school_year_id
  where s.id in (select public.portal_student_ids())
  order by s.child_birth_date nulls last, s.child_first_name, c.sort_order;
$$;

revoke all on function public.portal_my_self() from public, anon;
grant execute on function public.portal_my_self() to authenticated;

create or replace function public.admin_save_time_slots(p_school_year_id uuid, p_slots jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_max integer;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.school_years where id = p_school_year_id) then
    raise exception 'Fant ikke skoleåret.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'Skoledagen må ha minst én time.' using errcode = 'P0001';
  end if;

  v_count := jsonb_array_length(p_slots);

  select max(p.end_position) into v_max
  from public.class_slot_plans p
  where p.school_year_id = p_school_year_id;

  if v_max is not null and v_max > v_count then
    raise exception 'En timeplan bruker time %. Endre timeplanen først.', v_max using errcode = 'P0001';
  end if;

  delete from public.school_time_slots
  where school_year_id = p_school_year_id
    and position > v_count;

  insert into public.school_time_slots (school_year_id, position, label, starts_at, ends_at)
  select p_school_year_id, x.ordinality::integer, btrim(x.value ->> 'label'), (x.value ->> 'starts_at')::time, (x.value ->> 'ends_at')::time
  from jsonb_array_elements(p_slots) with ordinality as x(value, ordinality)
  on conflict (school_year_id, position) do update
    set label = excluded.label,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at;

  perform public.reconcile_lessons(p_school_year_id, null);
  return v_count;
end;
$$;

revoke all on function public.admin_save_time_slots(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_time_slots(uuid, jsonb) to authenticated;

create or replace function public.admin_save_class_slot_plans(p_class_id uuid, p_school_year_id uuid, p_plans jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_slots integer;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.classes where id = p_class_id)
    or not exists (select 1 from public.school_years where id = p_school_year_id) then
    raise exception 'Fant ikke klassen eller skoleåret.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_plans) <> 'array' then
    raise exception 'Ugyldig timeplan.' using errcode = 'P0001';
  end if;

  select coalesce(max(position), 0) into v_slots
  from public.school_time_slots
  where school_year_id = p_school_year_id;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid)
    where x.start_position is null
      or x.end_position is null
      or x.start_position < 1
      or x.end_position < x.start_position
      or x.end_position > v_slots
  ) then
    raise exception 'Timene må ligge innenfor skoledagens timer.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid)
    where x.teacher_guardian_id is not null
      and not exists (
        select 1 from public.guardians g where g.id = x.teacher_guardian_id and g.is_teacher
      )
  ) then
    raise exception 'Personen er ikke registrert som lærer.' using errcode = 'P0001';
  end if;

  delete from public.class_slot_plans
  where class_id = p_class_id
    and school_year_id = p_school_year_id;

  insert into public.class_slot_plans (class_id, school_year_id, start_position, end_position, subject, teacher_guardian_id)
  select p_class_id, p_school_year_id, x.start_position, x.end_position, nullif(btrim(x.subject), ''), x.teacher_guardian_id
  from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid)
  order by x.start_position;

  get diagnostics v_count = row_count;

  insert into public.class_teachers (class_id, guardian_id, school_year_id)
  select distinct p_class_id, p.teacher_guardian_id, p_school_year_id
  from public.class_slot_plans p
  where p.class_id = p_class_id
    and p.school_year_id = p_school_year_id
    and p.teacher_guardian_id is not null
  on conflict (class_id, guardian_id, school_year_id) do nothing;

  perform public.reconcile_lessons(p_school_year_id, p_class_id);
  return v_count;
end;
$$;

revoke all on function public.admin_save_class_slot_plans(uuid, uuid, jsonb) from public, anon;
grant execute on function public.admin_save_class_slot_plans(uuid, uuid, jsonb) to authenticated;

create or replace function public.ensure_lessons(p_school_day_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  return public.materialize_lessons(p_school_day_id, null, false);
end;
$$;

revoke all on function public.ensure_lessons(uuid) from public, anon;
grant execute on function public.ensure_lessons(uuid) to authenticated;

create or replace function public.ensure_year_lessons(p_school_year_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  return public.reconcile_lessons(p_school_year_id, null);
end;
$$;

revoke all on function public.ensure_year_lessons(uuid) from public, anon;
grant execute on function public.ensure_year_lessons(uuid) to authenticated;

create or replace function public.admin_update_lesson(
  p_lesson_id uuid,
  p_subject text,
  p_teacher_guardian_id uuid,
  p_cancelled boolean,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
  v_default uuid;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  select l.*, d.school_year_id into v_lesson
  from public.lessons l
  join public.school_days d on d.id = l.school_day_id
  where l.id = p_lesson_id
  for update of l;

  if not found then
    raise exception 'Fant ikke timen.' using errcode = 'P0001';
  end if;

  if p_teacher_guardian_id is not null and not exists (
    select 1 from public.guardians g where g.id = p_teacher_guardian_id and g.is_teacher
  ) then
    raise exception 'Personen er ikke registrert som lærer.' using errcode = 'P0001';
  end if;

  select p.teacher_guardian_id into v_default
  from public.class_slot_plans p
  where p.id = v_lesson.plan_id;

  update public.lessons
  set subject = nullif(btrim(p_subject), ''),
      teacher_guardian_id = p_teacher_guardian_id,
      cancelled = coalesce(p_cancelled, false),
      note = nullif(btrim(p_note), ''),
      is_override = true,
      is_substitute = p_teacher_guardian_id is not null
        and p_teacher_guardian_id is distinct from v_default
        and (
          v_default is not null
          or not exists (
            select 1 from public.class_teachers ct
            where ct.class_id = v_lesson.class_id
              and ct.school_year_id = v_lesson.school_year_id
              and ct.guardian_id = p_teacher_guardian_id
          )
        )
  where id = p_lesson_id;

  if coalesce(p_cancelled, false) then
    delete from public.attendance
    where lesson_id = p_lesson_id
      and status = 'meldt_fravaer';
  else
    perform public.lesson_apply_absences(p_lesson_id);
  end if;
end;
$$;

revoke all on function public.admin_update_lesson(uuid, text, uuid, boolean, text) from public, anon;
grant execute on function public.admin_update_lesson(uuid, text, uuid, boolean, text) to authenticated;

create or replace function public.admin_merge_lessons(p_lesson_id uuid, p_other_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep record;
  v_other record;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  select * into v_keep from public.lessons where id = p_lesson_id for update;
  select * into v_other from public.lessons where id = p_other_lesson_id for update;

  if v_keep.id is null or v_other.id is null or v_keep.id = v_other.id then
    raise exception 'Fant ikke timene.' using errcode = 'P0001';
  end if;

  if v_keep.school_day_id <> v_other.school_day_id or v_keep.class_id <> v_other.class_id then
    raise exception 'Bare timer i samme klasse og dag kan slås sammen.' using errcode = 'P0001';
  end if;

  if v_keep.end_position + 1 <> v_other.start_position and v_other.end_position + 1 <> v_keep.start_position then
    raise exception 'Bare timer som følger etter hverandre kan slås sammen.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.attendance where lesson_id = v_other.id and status <> 'meldt_fravaer')
    or exists (select 1 from public.class_notes where lesson_id = v_other.id) then
    raise exception 'Timen har oppmøte eller notat og kan ikke slås sammen.' using errcode = 'P0001';
  end if;

  delete from public.attendance where lesson_id = v_other.id;
  delete from public.lessons where id = v_other.id;

  update public.lessons
  set start_position = least(v_keep.start_position, v_other.start_position),
      end_position = greatest(v_keep.end_position, v_other.end_position),
      is_override = true
  where id = v_keep.id;
end;
$$;

revoke all on function public.admin_merge_lessons(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_lessons(uuid, uuid) to authenticated;

create or replace function public.admin_split_lesson(p_lesson_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
  v_new uuid;
  v_position integer;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  select * into v_lesson from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'Fant ikke timen.' using errcode = 'P0001';
  end if;

  if v_lesson.end_position = v_lesson.start_position then
    return 0;
  end if;

  update public.lessons
  set end_position = start_position,
      is_override = true
  where id = v_lesson.id;

  for v_position in v_lesson.start_position + 1 .. v_lesson.end_position loop
    insert into public.lessons (
      school_day_id, class_id, start_position, end_position, subject, teacher_guardian_id,
      is_substitute, is_override, cancelled, note
    )
    values (
      v_lesson.school_day_id, v_lesson.class_id, v_position, v_position, v_lesson.subject,
      v_lesson.teacher_guardian_id, v_lesson.is_substitute, true, v_lesson.cancelled, v_lesson.note
    )
    returning id into v_new;
    perform public.lesson_apply_absences(v_new);
  end loop;

  return v_lesson.end_position - v_lesson.start_position;
end;
$$;

revoke all on function public.admin_split_lesson(uuid) from public, anon;
grant execute on function public.admin_split_lesson(uuid) to authenticated;

create or replace function public.admin_reset_day_lessons(p_school_day_id uuid, p_class_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  delete from public.attendance a
  using public.lessons l
  where a.lesson_id = l.id
    and l.school_day_id = p_school_day_id
    and l.class_id = p_class_id
    and a.status = 'meldt_fravaer'
    and not exists (select 1 from public.attendance o where o.lesson_id = l.id and o.status <> 'meldt_fravaer')
    and not exists (select 1 from public.class_notes n where n.lesson_id = l.id);

  delete from public.lessons l
  where l.school_day_id = p_school_day_id
    and l.class_id = p_class_id
    and not exists (select 1 from public.attendance a where a.lesson_id = l.id)
    and not exists (select 1 from public.class_notes n where n.lesson_id = l.id);

  update public.lessons
  set is_override = false,
      cancelled = false
  where school_day_id = p_school_day_id
    and class_id = p_class_id;

  return public.materialize_lessons(p_school_day_id, p_class_id, true);
end;
$$;

revoke all on function public.admin_reset_day_lessons(uuid, uuid) from public, anon;
grant execute on function public.admin_reset_day_lessons(uuid, uuid) to authenticated;
