alter table public.class_slot_plans
  add column if not exists co_teacher_guardian_id uuid references public.guardians(id) on delete set null;
alter table public.lessons
  add column if not exists co_teacher_guardian_id uuid references public.guardians(id) on delete set null;

create index if not exists class_slot_plans_co_teacher_idx on public.class_slot_plans (co_teacher_guardian_id);
create index if not exists lessons_co_teacher_idx on public.lessons (co_teacher_guardian_id);

alter table public.class_slot_plans drop constraint if exists class_slot_plans_co_teacher_check;
alter table public.class_slot_plans
  add constraint class_slot_plans_co_teacher_check check (co_teacher_guardian_id <> teacher_guardian_id);
alter table public.lessons drop constraint if exists lessons_co_teacher_check;
alter table public.lessons
  add constraint lessons_co_teacher_check check (co_teacher_guardian_id <> teacher_guardian_id);

drop function if exists public.lesson_plan_ranges(uuid, uuid);
create function public.lesson_plan_ranges(p_class_id uuid, p_school_year_id uuid)
returns table (
  plan_id uuid,
  start_position integer,
  end_position integer,
  subject text,
  teacher_guardian_id uuid,
  co_teacher_guardian_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.start_position, p.end_position, p.subject, p.teacher_guardian_id, p.co_teacher_guardian_id
  from public.class_slot_plans p
  where p.class_id = p_class_id
    and p.school_year_id = p_school_year_id
  union all
  select null::uuid, 1, coalesce((
      select max(s.position) from public.school_time_slots s where s.school_year_id = p_school_year_id
    ), 1), null::text, null::uuid, null::uuid
  where not exists (
    select 1 from public.class_slot_plans p
    where p.class_id = p_class_id
      and p.school_year_id = p_school_year_id
  )
  order by 2;
$$;

revoke all on function public.lesson_plan_ranges(uuid, uuid) from public, anon, authenticated;

create or replace function public.materialize_lessons(
  p_school_day_id uuid,
  p_class_id uuid default null,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day record;
  v_today date := (now() at time zone 'Europe/Oslo')::date;
  v_class uuid;
  v_lesson record;
  v_plan record;
  v_new uuid;
  v_count integer := 0;
begin
  select d.id, d.date, d.school_year_id into v_day
  from public.school_days d
  where d.id = p_school_day_id;
  if not found then
    return 0;
  end if;

  for v_class in
    select c.id
    from public.classes c
    where (p_class_id is null or c.id = p_class_id)
      and (
        (p_force and c.id = p_class_id)
        or exists (
          select 1 from public.class_slot_plans p
          where p.class_id = c.id and p.school_year_id = v_day.school_year_id
        )
        or exists (
          select 1 from public.enrollments e
          where e.class_id = c.id and e.school_year_id = v_day.school_year_id and e.status = 'aktiv'
        )
        or exists (
          select 1 from public.lessons l
          where l.class_id = c.id and l.school_day_id = v_day.id
        )
      )
  loop
    perform pg_advisory_xact_lock(hashtext('lessons:' || v_day.id::text || ':' || v_class::text));

    for v_lesson in
      select l.*
      from public.lessons l
      where l.school_day_id = v_day.id
        and l.class_id = v_class
        and not l.is_override
    loop
      select r.* into v_plan
      from public.lesson_plan_ranges(v_class, v_day.school_year_id) r
      where r.start_position = v_lesson.start_position
        and r.end_position = v_lesson.end_position
      limit 1;

      if found then
        if v_day.date >= v_today
          and (v_lesson.plan_id, v_lesson.subject, v_lesson.teacher_guardian_id, v_lesson.co_teacher_guardian_id, v_lesson.is_substitute)
            is distinct from (v_plan.plan_id, v_plan.subject, v_plan.teacher_guardian_id, v_plan.co_teacher_guardian_id, false)
        then
          update public.lessons
          set plan_id = v_plan.plan_id,
              subject = v_plan.subject,
              teacher_guardian_id = v_plan.teacher_guardian_id,
              co_teacher_guardian_id = v_plan.co_teacher_guardian_id,
              is_substitute = false
          where id = v_lesson.id;
        end if;
      elsif v_day.date >= v_today
        and not exists (select 1 from public.attendance a where a.lesson_id = v_lesson.id and a.status <> 'meldt_fravaer')
        and not exists (select 1 from public.class_notes n where n.lesson_id = v_lesson.id)
      then
        delete from public.attendance where lesson_id = v_lesson.id;
        delete from public.lessons where id = v_lesson.id;
      end if;
    end loop;

    for v_plan in
      select r.* from public.lesson_plan_ranges(v_class, v_day.school_year_id) r
    loop
      if not exists (
        select 1
        from public.lessons l
        where l.school_day_id = v_day.id
          and l.class_id = v_class
          and l.start_position <= v_plan.end_position
          and v_plan.start_position <= l.end_position
      ) then
        insert into public.lessons (
          school_day_id, class_id, start_position, end_position, subject, teacher_guardian_id, co_teacher_guardian_id, plan_id
        )
        values (
          v_day.id, v_class, v_plan.start_position, v_plan.end_position, v_plan.subject, v_plan.teacher_guardian_id,
          v_plan.co_teacher_guardian_id, v_plan.plan_id
        )
        returning id into v_new;
        perform public.lesson_apply_absences(v_new);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.materialize_lessons(uuid, uuid, boolean) from public, anon, authenticated;

drop policy if exists "teacher reads own" on public.class_slot_plans;
create policy "teacher reads own" on public.class_slot_plans
  for select to authenticated using (
    public.portal_is_teacher_of(class_id)
    or teacher_guardian_id in (select public.portal_guardian_ids())
    or co_teacher_guardian_id in (select public.portal_guardian_ids())
  );

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
          where g.id in (l.teacher_guardian_id, l.co_teacher_guardian_id)
            and g.is_teacher
            and g.teacher_suspended_at is null
            and g.id in (select public.portal_guardian_ids())
        )
        or public.portal_is_teacher_of(l.class_id)
      )
  );
$$;

revoke all on function public.portal_teaches_lesson(uuid) from public, anon;
grant execute on function public.portal_teaches_lesson(uuid) to authenticated;

create or replace function public.portal_can_edit_week_plan(p_class_id uuid, p_school_year_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_years sy where sy.id = p_school_year_id and sy.is_active
  )
  and (
    public.portal_is_teacher_of(p_class_id)
    or exists (
      select 1
      from public.class_slot_plans p
      join public.guardians g on g.id in (p.teacher_guardian_id, p.co_teacher_guardian_id)
      where p.class_id = p_class_id
        and p.school_year_id = p_school_year_id
        and g.is_teacher
        and g.teacher_suspended_at is null
        and g.id in (select public.portal_guardian_ids())
    )
  );
$$;

create or replace function public.portal_can_read_week_plan(p_class_id uuid, p_school_year_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portal_can_edit_week_plan(p_class_id, p_school_year_id)
  or (
    exists (
      select 1 from public.school_years sy where sy.id = p_school_year_id and sy.is_active
    )
    and (
      public.portal_is_guardian_in_class(p_class_id)
      or public.portal_is_student_in_class(p_class_id)
      or exists (
        select 1
        from public.lessons l
        join public.school_days d on d.id = l.school_day_id
        where l.class_id = p_class_id
          and d.school_year_id = p_school_year_id
          and (
            l.teacher_guardian_id in (select public.portal_guardian_ids())
            or l.co_teacher_guardian_id in (select public.portal_guardian_ids())
          )
          and public.portal_teaches_lesson(l.id)
      )
    )
  );
$$;

revoke all on function public.portal_can_edit_week_plan(uuid, uuid) from public, anon;
revoke all on function public.portal_can_read_week_plan(uuid, uuid) from public, anon;
grant execute on function public.portal_can_edit_week_plan(uuid, uuid) to authenticated;
grant execute on function public.portal_can_read_week_plan(uuid, uuid) to authenticated;

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
  co_teacher_guardian_id uuid,
  co_teacher_first_name text,
  co_teacher_last_name text,
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
    l.co_teacher_guardian_id,
    cg.first_name,
    cg.last_name,
    l.is_substitute,
    l.cancelled or d.cancelled,
    coalesce(l.teacher_guardian_id in (select public.portal_guardian_ids()), false)
      or coalesce(l.co_teacher_guardian_id in (select public.portal_guardian_ids()), false),
    l.note
  from public.lessons l
  join public.school_days d on d.id = l.school_day_id
  join public.classes c on c.id = l.class_id
  left join public.school_time_slots s1 on s1.school_year_id = d.school_year_id and s1.position = l.start_position
  left join public.school_time_slots s2 on s2.school_year_id = d.school_year_id and s2.position = l.end_position
  left join public.guardians g on g.id = l.teacher_guardian_id
  left join public.guardians cg on cg.id = l.co_teacher_guardian_id
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
  co_teacher_guardian_id uuid,
  co_teacher_first_name text,
  co_teacher_last_name text,
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
    from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid, co_teacher_guardian_id uuid)
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
    from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid, co_teacher_guardian_id uuid)
    cross join lateral (values (x.teacher_guardian_id), (x.co_teacher_guardian_id)) as t(guardian_id)
    where t.guardian_id is not null
      and not exists (
        select 1 from public.guardians g where g.id = t.guardian_id and g.is_teacher
      )
  ) then
    raise exception 'Personen er ikke registrert som lærer.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid, co_teacher_guardian_id uuid)
    where x.co_teacher_guardian_id = x.teacher_guardian_id
  ) then
    raise exception 'Medlæreren kan ikke være den samme som læreren.' using errcode = 'P0001';
  end if;

  delete from public.class_slot_plans
  where class_id = p_class_id
    and school_year_id = p_school_year_id;

  insert into public.class_slot_plans (class_id, school_year_id, start_position, end_position, subject, teacher_guardian_id, co_teacher_guardian_id)
  select p_class_id, p_school_year_id, x.start_position, x.end_position, nullif(btrim(x.subject), ''), x.teacher_guardian_id, x.co_teacher_guardian_id
  from jsonb_to_recordset(p_plans) as x(start_position integer, end_position integer, subject text, teacher_guardian_id uuid, co_teacher_guardian_id uuid)
  order by x.start_position;

  get diagnostics v_count = row_count;

  insert into public.class_teachers (class_id, guardian_id, school_year_id)
  select distinct p_class_id, t.guardian_id, p_school_year_id
  from public.class_slot_plans p
  cross join lateral (values (p.teacher_guardian_id), (p.co_teacher_guardian_id)) as t(guardian_id)
  where p.class_id = p_class_id
    and p.school_year_id = p_school_year_id
    and t.guardian_id is not null
  on conflict (class_id, guardian_id, school_year_id) do nothing;

  perform public.reconcile_lessons(p_school_year_id, p_class_id);
  return v_count;
end;
$$;

revoke all on function public.admin_save_class_slot_plans(uuid, uuid, jsonb) from public, anon;
grant execute on function public.admin_save_class_slot_plans(uuid, uuid, jsonb) to authenticated;

drop function if exists public.admin_update_lesson(uuid, text, uuid, boolean, text);
create or replace function public.admin_update_lesson(
  p_lesson_id uuid,
  p_subject text,
  p_teacher_guardian_id uuid,
  p_cancelled boolean,
  p_note text,
  p_co_teacher_guardian_id uuid default null
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

  if exists (
    select 1
    from (values (p_teacher_guardian_id), (p_co_teacher_guardian_id)) as t(guardian_id)
    where t.guardian_id is not null
      and not exists (select 1 from public.guardians g where g.id = t.guardian_id and g.is_teacher)
  ) then
    raise exception 'Personen er ikke registrert som lærer.' using errcode = 'P0001';
  end if;

  if p_co_teacher_guardian_id = p_teacher_guardian_id then
    raise exception 'Medlæreren kan ikke være den samme som læreren.' using errcode = 'P0001';
  end if;

  select p.teacher_guardian_id into v_default
  from public.class_slot_plans p
  where p.id = v_lesson.plan_id;

  update public.lessons
  set subject = nullif(btrim(p_subject), ''),
      teacher_guardian_id = p_teacher_guardian_id,
      co_teacher_guardian_id = p_co_teacher_guardian_id,
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

revoke all on function public.admin_update_lesson(uuid, text, uuid, boolean, text, uuid) from public, anon;
grant execute on function public.admin_update_lesson(uuid, text, uuid, boolean, text, uuid) to authenticated;

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
      school_day_id, class_id, start_position, end_position, subject, teacher_guardian_id, co_teacher_guardian_id,
      is_substitute, is_override, cancelled, note
    )
    values (
      v_lesson.school_day_id, v_lesson.class_id, v_position, v_position, v_lesson.subject,
      v_lesson.teacher_guardian_id, v_lesson.co_teacher_guardian_id, v_lesson.is_substitute, true, v_lesson.cancelled, v_lesson.note
    )
    returning id into v_new;
    perform public.lesson_apply_absences(v_new);
  end loop;

  return v_lesson.end_position - v_lesson.start_position;
end;
$$;

revoke all on function public.admin_split_lesson(uuid) from public, anon;
grant execute on function public.admin_split_lesson(uuid) to authenticated;
