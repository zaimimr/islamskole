-- A reported absence ("meldt fravær") now records how the notice came in:
-- 'app' when a guardian reported it on Min side, 'direkte' when the teacher marks it
-- after hearing from the family themselves (SMS, a call, at pickup). The teacher can
-- add a short note on a direct notice.

alter table public.attendance add column if not exists notice_channel text;
alter table public.attendance add column if not exists note text;

update public.attendance a
set notice_channel = case
  when exists (
    select 1 from public.absence_reports r
    where r.student_id = a.student_id
      and r.school_day_id = a.school_day_id
      and r.withdrawn_at is null
  ) then 'app'
  else 'direkte'
end
where a.status = 'meldt_fravaer'
  and a.notice_channel is null;

update public.attendance
set notice_channel = null, note = null
where status <> 'meldt_fravaer'
  and (notice_channel is not null or note is not null);

alter table public.attendance drop constraint if exists attendance_notice_channel_check;
alter table public.attendance add constraint attendance_notice_channel_check
  check (notice_channel in ('app', 'direkte'));

alter table public.attendance drop constraint if exists attendance_notice_matches_status;
alter table public.attendance add constraint attendance_notice_matches_status
  check ((status = 'meldt_fravaer') = (notice_channel is not null));

alter table public.attendance drop constraint if exists attendance_note_check;
alter table public.attendance add constraint attendance_note_check
  check (note is null or (status = 'meldt_fravaer' and char_length(note) <= 500));

create or replace function public.attendance_normalize_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'meldt_fravaer' then
    new.notice_channel := null;
    new.note := null;
  elsif new.notice_channel is null then
    new.notice_channel := 'direkte';
  end if;
  new.note := nullif(btrim(new.note), '');
  return new;
end;
$$;

revoke all on function public.attendance_normalize_notice() from public, anon, authenticated;

drop trigger if exists attendance_normalize_notice on public.attendance;
create trigger attendance_normalize_notice
  before insert or update on public.attendance
  for each row execute function public.attendance_normalize_notice();

create or replace function public.lesson_apply_absences(p_lesson_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.attendance (student_id, school_day_id, lesson_id, status, notice_channel)
  select r.student_id, l.school_day_id, l.id, 'meldt_fravaer', 'app'
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

-- Withdrawing an app report only clears what the app set; a notice the teacher
-- registered themselves stays.
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
      insert into public.attendance (student_id, school_day_id, lesson_id, status, notice_channel, marked_by)
      values (new.student_id, new.school_day_id, v_lesson, 'meldt_fravaer', 'app', auth.uid())
      on conflict (student_id, lesson_id) do nothing;
    end loop;
  elsif tg_op = 'UPDATE' and old.withdrawn_at is null and new.withdrawn_at is not null then
    delete from public.attendance
    where student_id = new.student_id
      and school_day_id = new.school_day_id
      and status = 'meldt_fravaer'
      and notice_channel = 'app';
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
  notice_channel text,
  attendance_note text,
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
    a.notice_channel,
    a.note,
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
