alter table public.guardians add column if not exists teacher_suspended_at timestamptz;

create table if not exists public.school_time_slots (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  position integer not null check (position >= 1),
  label text not null check (length(btrim(label)) between 1 and 60),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year_id, position),
  check (ends_at > starts_at)
);

create table if not exists public.class_slot_plans (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  start_position integer not null check (start_position >= 1),
  end_position integer not null,
  subject text check (subject is null or length(subject) <= 120),
  teacher_guardian_id uuid references public.guardians(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_position >= start_position)
);

create index if not exists class_slot_plans_class_year_idx on public.class_slot_plans (class_id, school_year_id);
create index if not exists class_slot_plans_teacher_idx on public.class_slot_plans (teacher_guardian_id);
create index if not exists class_slot_plans_school_year_idx on public.class_slot_plans (school_year_id);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  school_day_id uuid not null references public.school_days(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  start_position integer not null check (start_position >= 1),
  end_position integer not null,
  subject text check (subject is null or length(subject) <= 120),
  teacher_guardian_id uuid references public.guardians(id) on delete set null,
  is_substitute boolean not null default false,
  is_override boolean not null default false,
  cancelled boolean not null default false,
  note text check (note is null or length(note) <= 500),
  plan_id uuid references public.class_slot_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_position >= start_position)
);

create index if not exists lessons_day_class_idx on public.lessons (school_day_id, class_id, start_position);
create index if not exists lessons_class_idx on public.lessons (class_id);
create index if not exists lessons_teacher_idx on public.lessons (teacher_guardian_id);
create index if not exists lessons_plan_idx on public.lessons (plan_id);

alter table public.attendance add column if not exists id uuid not null default gen_random_uuid();
alter table public.attendance add column if not exists lesson_id uuid references public.lessons(id);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance'::regclass
      and conname = 'attendance_pkey'
      and array_length(conkey, 1) = 2
  ) then
    alter table public.attendance drop constraint attendance_pkey;
    alter table public.attendance add constraint attendance_pkey primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance'::regclass
      and conname = 'attendance_student_lesson_key'
  ) then
    alter table public.attendance
      add constraint attendance_student_lesson_key unique (student_id, lesson_id);
  end if;
end;
$$;

create unique index if not exists attendance_one_unplaced_per_day
  on public.attendance (student_id, school_day_id)
  where lesson_id is null;
create index if not exists attendance_lesson_idx on public.attendance (lesson_id);

alter table public.class_notes add column if not exists lesson_id uuid references public.lessons(id);
alter table public.class_notes drop constraint if exists class_notes_class_id_school_day_id_key;
create unique index if not exists class_notes_lesson_key on public.class_notes (lesson_id);
create index if not exists class_notes_class_idx on public.class_notes (class_id);

drop trigger if exists school_time_slots_updated_at on public.school_time_slots;
create trigger school_time_slots_updated_at
  before update on public.school_time_slots
  for each row execute function public.set_updated_at();

drop trigger if exists class_slot_plans_updated_at on public.class_slot_plans;
create trigger class_slot_plans_updated_at
  before update on public.class_slot_plans
  for each row execute function public.set_updated_at();

drop trigger if exists lessons_updated_at on public.lessons;
create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create or replace function public.class_slot_plans_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.class_slot_plans p
    where p.class_id = new.class_id
      and p.school_year_id = new.school_year_id
      and p.id <> new.id
      and p.start_position <= new.end_position
      and new.start_position <= p.end_position
  ) then
    raise exception 'Timene overlapper med en annen time i timeplanen.' using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke all on function public.class_slot_plans_no_overlap() from public, anon, authenticated;

drop trigger if exists class_slot_plans_no_overlap on public.class_slot_plans;
create trigger class_slot_plans_no_overlap
  after insert or update on public.class_slot_plans
  for each row execute function public.class_slot_plans_no_overlap();

create or replace function public.lessons_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.lessons l
    where l.class_id = new.class_id
      and l.school_day_id = new.school_day_id
      and l.id <> new.id
      and l.start_position <= new.end_position
      and new.start_position <= l.end_position
  ) then
    raise exception 'Timene overlapper med en annen time denne dagen.' using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke all on function public.lessons_no_overlap() from public, anon, authenticated;

drop trigger if exists lessons_no_overlap on public.lessons;
create trigger lessons_no_overlap
  after insert or update on public.lessons
  for each row execute function public.lessons_no_overlap();

create or replace function public.seed_default_time_slots(p_school_year_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if exists (select 1 from public.school_time_slots where school_year_id = p_school_year_id) then
    return 0;
  end if;

  insert into public.school_time_slots (school_year_id, position, label, starts_at, ends_at)
  values
    (p_school_year_id, 1, 'Time 1', '10:00', '11:00'),
    (p_school_year_id, 2, 'Time 2', '11:00', '12:00'),
    (p_school_year_id, 3, 'Time 3', '13:00', '14:00')
  on conflict (school_year_id, position) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.seed_default_time_slots(uuid) from public, anon, authenticated;

create or replace function public.school_years_seed_time_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_time_slots(new.id);
  return new;
end;
$$;

revoke all on function public.school_years_seed_time_slots() from public, anon, authenticated;

drop trigger if exists school_years_seed_time_slots on public.school_years;
create trigger school_years_seed_time_slots
  after insert on public.school_years
  for each row execute function public.school_years_seed_time_slots();

do $$
declare
  v_year uuid;
begin
  for v_year in select id from public.school_years loop
    perform public.seed_default_time_slots(v_year);
  end loop;
end;
$$;

create or replace function public.lesson_plan_ranges(p_class_id uuid, p_school_year_id uuid)
returns table (
  plan_id uuid,
  start_position integer,
  end_position integer,
  subject text,
  teacher_guardian_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.start_position, p.end_position, p.subject, p.teacher_guardian_id
  from public.class_slot_plans p
  where p.class_id = p_class_id
    and p.school_year_id = p_school_year_id
  union all
  select null::uuid, 1, coalesce((
      select max(s.position) from public.school_time_slots s where s.school_year_id = p_school_year_id
    ), 1), null::text, null::uuid
  where not exists (
    select 1 from public.class_slot_plans p
    where p.class_id = p_class_id
      and p.school_year_id = p_school_year_id
  )
  order by 2;
$$;

revoke all on function public.lesson_plan_ranges(uuid, uuid) from public, anon, authenticated;

create or replace function public.lesson_apply_absences(p_lesson_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.attendance (student_id, school_day_id, lesson_id, status)
  select r.student_id, l.school_day_id, l.id, 'meldt_fravaer'
  from public.lessons l
  join public.school_days d on d.id = l.school_day_id
  join public.absence_reports r on r.school_day_id = l.school_day_id and r.withdrawn_at is null
  join public.enrollments e
    on e.student_id = r.student_id
   and e.class_id = l.class_id
   and e.school_year_id = d.school_year_id
   and e.status = 'aktiv'
  where l.id = p_lesson_id
    and not l.cancelled
    and not exists (
      select 1 from public.attendance a
      where a.student_id = r.student_id
        and a.school_day_id = l.school_day_id
        and a.lesson_id is null
    )
  on conflict (student_id, lesson_id) do nothing;
$$;

revoke all on function public.lesson_apply_absences(uuid) from public, anon, authenticated;

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
          and (v_lesson.plan_id, v_lesson.subject, v_lesson.teacher_guardian_id, v_lesson.is_substitute)
            is distinct from (v_plan.plan_id, v_plan.subject, v_plan.teacher_guardian_id, false)
        then
          update public.lessons
          set plan_id = v_plan.plan_id,
              subject = v_plan.subject,
              teacher_guardian_id = v_plan.teacher_guardian_id,
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
          school_day_id, class_id, start_position, end_position, subject, teacher_guardian_id, plan_id
        )
        values (
          v_day.id, v_class, v_plan.start_position, v_plan.end_position, v_plan.subject, v_plan.teacher_guardian_id, v_plan.plan_id
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

create or replace function public.reconcile_lessons(p_school_year_id uuid, p_class_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day uuid;
  v_count integer := 0;
begin
  for v_day in
    select d.id from public.school_days d where d.school_year_id = p_school_year_id order by d.date
  loop
    v_count := v_count + public.materialize_lessons(v_day, p_class_id, false);
  end loop;
  return v_count;
end;
$$;

revoke all on function public.reconcile_lessons(uuid, uuid) from public, anon, authenticated;

create or replace function public.school_days_materialize_lessons()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.materialize_lessons(new.id, null, false);
  return new;
end;
$$;

revoke all on function public.school_days_materialize_lessons() from public, anon, authenticated;

drop trigger if exists school_days_materialize_lessons on public.school_days;
create trigger school_days_materialize_lessons
  after insert on public.school_days
  for each row execute function public.school_days_materialize_lessons();

create or replace function public.enrollments_materialize_lessons()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select distinct n.class_id, n.school_year_id
    from new_rows n
    where n.status = 'aktiv'
  loop
    perform public.reconcile_lessons(v_row.school_year_id, v_row.class_id);
  end loop;
  return null;
end;
$$;

revoke all on function public.enrollments_materialize_lessons() from public, anon, authenticated;

drop trigger if exists enrollments_materialize_lessons_insert on public.enrollments;
create trigger enrollments_materialize_lessons_insert
  after insert on public.enrollments
  referencing new table as new_rows
  for each statement execute function public.enrollments_materialize_lessons();

drop trigger if exists enrollments_materialize_lessons_update on public.enrollments;
create trigger enrollments_materialize_lessons_update
  after update on public.enrollments
  referencing new table as new_rows
  for each statement execute function public.enrollments_materialize_lessons();

drop trigger if exists attendance_fill_lesson on public.attendance;
drop trigger if exists class_notes_fill_lesson on public.class_notes;

do $$
declare
  v_year uuid;
  v_pair record;
begin
  for v_year in select id from public.school_years where is_active loop
    perform public.reconcile_lessons(v_year, null);
  end loop;

  for v_pair in
    select distinct n.school_day_id, n.class_id
    from public.class_notes n
    where n.lesson_id is null
  loop
    perform public.materialize_lessons(v_pair.school_day_id, v_pair.class_id, true);
  end loop;

  for v_pair in
    select distinct a.school_day_id, (
      select e.class_id
      from public.enrollments e
      join public.school_days d on d.school_year_id = e.school_year_id
      where d.id = a.school_day_id
        and e.student_id = a.student_id
      order by (e.status = 'aktiv') desc, e.created_at desc
      limit 1
    ) as class_id
    from public.attendance a
    where a.lesson_id is null
  loop
    if v_pair.class_id is not null then
      perform public.materialize_lessons(v_pair.school_day_id, v_pair.class_id, true);
    end if;
  end loop;
end;
$$;

update public.class_notes n
set lesson_id = (
  select l.id from public.lessons l
  where l.school_day_id = n.school_day_id
    and l.class_id = n.class_id
  order by l.start_position
  limit 1
)
where n.lesson_id is null;

update public.attendance a
set lesson_id = (
  select l.id
  from public.lessons l
  where l.school_day_id = a.school_day_id
    and l.class_id = (
      select e.class_id
      from public.enrollments e
      join public.school_days d on d.school_year_id = e.school_year_id
      where d.id = a.school_day_id
        and e.student_id = a.student_id
      order by (e.status = 'aktiv') desc, e.created_at desc
      limit 1
    )
  order by l.start_position
  limit 1
)
where a.lesson_id is null;

alter table public.class_notes alter column lesson_id set not null;

create or replace function public.attendance_fill_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
  v_lesson record;
begin
  if new.lesson_id is null then
    select e.class_id into v_class
    from public.enrollments e
    join public.school_days d on d.school_year_id = e.school_year_id
    where d.id = new.school_day_id
      and e.student_id = new.student_id
    order by (e.status = 'aktiv') desc, e.created_at desc
    limit 1;

    if v_class is null then
      raise exception 'Eleven har ingen klasse dette skoleåret.' using errcode = 'P0001';
    end if;

    perform public.materialize_lessons(new.school_day_id, v_class, true);

    select l.id into new.lesson_id
    from public.lessons l
    where l.school_day_id = new.school_day_id
      and l.class_id = v_class
    order by l.cancelled, l.start_position
    limit 1;
  end if;

  select l.school_day_id, l.class_id, l.cancelled, d.school_year_id into v_lesson
  from public.lessons l
  join public.school_days d on d.id = l.school_day_id
  where l.id = new.lesson_id;

  if not found then
    raise exception 'Fant ikke timen.' using errcode = '23503';
  end if;

  if v_lesson.cancelled and not public.is_admin() then
    raise exception 'Timen er avlyst.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.student_id = new.student_id
      and e.class_id = v_lesson.class_id
      and e.school_year_id = v_lesson.school_year_id
  ) then
    raise exception 'Eleven går ikke i denne klassen.' using errcode = 'P0001';
  end if;

  new.school_day_id := v_lesson.school_day_id;
  return new;
end;
$$;

revoke all on function public.attendance_fill_lesson() from public, anon, authenticated;

drop trigger if exists attendance_fill_lesson on public.attendance;
create trigger attendance_fill_lesson
  before insert or update of lesson_id, school_day_id, student_id on public.attendance
  for each row execute function public.attendance_fill_lesson();

create or replace function public.class_notes_fill_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson record;
begin
  if new.lesson_id is null then
    perform public.materialize_lessons(new.school_day_id, new.class_id, true);

    select l.id into new.lesson_id
    from public.lessons l
    where l.school_day_id = new.school_day_id
      and l.class_id = new.class_id
    order by l.cancelled, l.start_position
    limit 1;
  end if;

  select l.school_day_id, l.class_id, l.cancelled into v_lesson
  from public.lessons l
  where l.id = new.lesson_id;

  if not found then
    raise exception 'Fant ikke timen.' using errcode = '23503';
  end if;

  if v_lesson.cancelled and not public.is_admin() then
    raise exception 'Timen er avlyst.' using errcode = '42501';
  end if;

  new.school_day_id := v_lesson.school_day_id;
  new.class_id := v_lesson.class_id;
  return new;
end;
$$;

revoke all on function public.class_notes_fill_lesson() from public, anon, authenticated;

drop trigger if exists class_notes_fill_lesson on public.class_notes;
create trigger class_notes_fill_lesson
  before insert or update of lesson_id, school_day_id, class_id on public.class_notes
  for each row execute function public.class_notes_fill_lesson();

create or replace function public.portal_absence_to_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson uuid;
begin
  if tg_op = 'INSERT' and new.withdrawn_at is null then
    for v_lesson in
      select l.id
      from public.lessons l
      join public.school_days d on d.id = l.school_day_id
      join public.enrollments e
        on e.class_id = l.class_id
       and e.school_year_id = d.school_year_id
       and e.student_id = new.student_id
       and e.status = 'aktiv'
      where l.school_day_id = new.school_day_id
        and not l.cancelled
    loop
      insert into public.attendance (student_id, school_day_id, lesson_id, status, marked_by)
      values (new.student_id, new.school_day_id, v_lesson, 'meldt_fravaer', auth.uid())
      on conflict (student_id, lesson_id) do nothing;
    end loop;
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

alter table public.school_time_slots enable row level security;
alter table public.class_slot_plans enable row level security;
alter table public.lessons enable row level security;

revoke all on public.school_time_slots, public.class_slot_plans, public.lessons from anon;
revoke insert, update, delete on public.school_time_slots, public.class_slot_plans from authenticated;

drop policy if exists "admin all" on public.school_time_slots;
create policy "admin all" on public.school_time_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "signed in reads" on public.school_time_slots;
create policy "signed in reads" on public.school_time_slots
  for select to authenticated using (true);

drop policy if exists "admin all" on public.class_slot_plans;
create policy "admin all" on public.class_slot_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "teacher reads own" on public.class_slot_plans;
create policy "teacher reads own" on public.class_slot_plans
  for select to authenticated using (
    public.portal_is_teacher_of(class_id)
    or teacher_guardian_id in (select public.portal_guardian_ids())
  );

drop policy if exists "admin all" on public.lessons;
create policy "admin all" on public.lessons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
