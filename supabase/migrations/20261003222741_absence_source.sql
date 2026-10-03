alter table public.absence_reports add column if not exists source text not null default 'app';
alter table public.absence_reports add column if not exists reported_by uuid default auth.uid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.absence_reports'::regclass
      and conname = 'absence_reports_source_check'
  ) then
    alter table public.absence_reports
      add constraint absence_reports_source_check check (source in ('app', 'laerer'));
  end if;
end;
$$;

create or replace function public.portal_can_report_absence(p_student_id uuid, p_school_day_id uuid)
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
    where l.school_day_id = p_school_day_id
      and not d.cancelled
      and public.portal_can_mark_lesson(p_student_id, l.id)
  );
$$;

revoke all on function public.portal_can_report_absence(uuid, uuid) from public, anon;
grant execute on function public.portal_can_report_absence(uuid, uuid) to authenticated;

drop policy if exists "guardian reports child" on public.absence_reports;
create policy "guardian reports child" on public.absence_reports
  for insert to authenticated with check (
    source = 'app'
    and public.portal_is_guardian_of(student_id)
    and reported_by_guardian_id in (select public.portal_guardian_ids())
    and withdrawn_at is null
    and public.portal_is_open_school_day(school_day_id)
  );

drop policy if exists "lesson teacher reads" on public.absence_reports;
create policy "lesson teacher reads" on public.absence_reports
  for select to authenticated using (public.portal_can_report_absence(student_id, school_day_id));

drop policy if exists "teacher reports class" on public.absence_reports;
create policy "teacher reports class" on public.absence_reports
  for insert to authenticated with check (
    source = 'laerer'
    and reported_by = auth.uid()
    and withdrawn_at is null
    and public.portal_can_report_absence(student_id, school_day_id)
  );

drop policy if exists "teacher withdraws class" on public.absence_reports;
create policy "teacher withdraws class" on public.absence_reports
  for update to authenticated
  using (source = 'laerer' and withdrawn_at is null and public.portal_can_report_absence(student_id, school_day_id))
  with check (source = 'laerer' and public.portal_can_report_absence(student_id, school_day_id));

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
      insert into public.attendance as a (student_id, school_day_id, lesson_id, status, marked_by)
      values (new.student_id, new.school_day_id, v_lesson, 'meldt_fravaer', auth.uid())
      on conflict (student_id, lesson_id) do update
        set status = 'meldt_fravaer', marked_by = excluded.marked_by, marked_at = now()
        where a.status = 'fravaer';
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
  absence_source text,
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
    r.source,
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
