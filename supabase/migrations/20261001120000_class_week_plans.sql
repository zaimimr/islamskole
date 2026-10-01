create table if not exists public.class_week_plans (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  start_position integer check (start_position is null or start_position >= 1),
  end_position integer,
  subject text check (subject is null or length(subject) <= 120),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 4000),
  resource_url text check (resource_url is null or (length(resource_url) <= 500 and resource_url ~* '^https?://')),
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((start_position is null) = (end_position is null)),
  check (end_position is null or end_position >= start_position)
);

create index if not exists class_week_plans_class_year_week_idx
  on public.class_week_plans (class_id, school_year_id, week_start, start_position, sort_order);
create index if not exists class_week_plans_school_year_idx on public.class_week_plans (school_year_id);

create or replace function public.class_week_plans_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.class_week_plans_stamp() from public, anon, authenticated;

drop trigger if exists class_week_plans_stamp on public.class_week_plans;
create trigger class_week_plans_stamp
  before insert or update on public.class_week_plans
  for each row execute function public.class_week_plans_stamp();

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
      join public.guardians g on g.id = p.teacher_guardian_id
      where p.class_id = p_class_id
        and p.school_year_id = p_school_year_id
        and g.is_teacher
        and g.teacher_suspended_at is null
        and p.teacher_guardian_id in (select public.portal_guardian_ids())
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
          and l.teacher_guardian_id in (select public.portal_guardian_ids())
          and public.portal_teaches_lesson(l.id)
      )
    )
  );
$$;

revoke all on function public.portal_can_edit_week_plan(uuid, uuid) from public, anon;
revoke all on function public.portal_can_read_week_plan(uuid, uuid) from public, anon;
grant execute on function public.portal_can_edit_week_plan(uuid, uuid) to authenticated;
grant execute on function public.portal_can_read_week_plan(uuid, uuid) to authenticated;

alter table public.class_week_plans enable row level security;
revoke all on public.class_week_plans from anon, public;
grant select, insert, update, delete on public.class_week_plans to authenticated;

drop policy if exists "admin all" on public.class_week_plans;
create policy "admin all" on public.class_week_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "portal reads class plan" on public.class_week_plans;
create policy "portal reads class plan" on public.class_week_plans
  for select to authenticated using (public.portal_can_read_week_plan(class_id, school_year_id));

drop policy if exists "teacher inserts class plan" on public.class_week_plans;
create policy "teacher inserts class plan" on public.class_week_plans
  for insert to authenticated with check (public.portal_can_edit_week_plan(class_id, school_year_id));

drop policy if exists "teacher updates class plan" on public.class_week_plans;
create policy "teacher updates class plan" on public.class_week_plans
  for update to authenticated
  using (public.portal_can_edit_week_plan(class_id, school_year_id))
  with check (public.portal_can_edit_week_plan(class_id, school_year_id));

drop policy if exists "teacher deletes class plan" on public.class_week_plans;
create policy "teacher deletes class plan" on public.class_week_plans
  for delete to authenticated using (public.portal_can_edit_week_plan(class_id, school_year_id));
