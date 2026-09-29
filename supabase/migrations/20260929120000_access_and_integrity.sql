create or replace function public.guardians_drop_class_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_teacher and not new.is_teacher then
    delete from public.class_teachers where guardian_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.guardians_drop_class_links() from public, anon, authenticated;

drop trigger if exists guardians_drop_class_links on public.guardians;
create trigger guardians_drop_class_links
  after update of is_teacher on public.guardians
  for each row execute function public.guardians_drop_class_links();

alter table public.payments drop constraint if exists payments_student_id_fkey;
alter table public.payments add constraint payments_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.payment_allocations drop constraint if exists payment_allocations_student_id_fkey;
alter table public.payment_allocations add constraint payment_allocations_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.payment_allocations drop constraint if exists payment_allocations_school_year_id_fkey;
alter table public.payment_allocations add constraint payment_allocations_school_year_id_fkey
  foreign key (school_year_id) references public.school_years(id) on delete restrict;

alter table public.payment_targets drop constraint if exists payment_targets_student_id_fkey;
alter table public.payment_targets add constraint payment_targets_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.student_fees drop constraint if exists student_fees_student_id_fkey;
alter table public.student_fees add constraint student_fees_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.student_fees drop constraint if exists student_fees_school_year_id_fkey;
alter table public.student_fees add constraint student_fees_school_year_id_fkey
  foreign key (school_year_id) references public.school_years(id) on delete restrict;

alter table public.student_fee_adjustments drop constraint if exists student_fee_adjustments_student_id_fkey;
alter table public.student_fee_adjustments add constraint student_fee_adjustments_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.student_fee_adjustments drop constraint if exists student_fee_adjustments_school_year_id_fkey;
alter table public.student_fee_adjustments add constraint student_fee_adjustments_school_year_id_fkey
  foreign key (school_year_id) references public.school_years(id) on delete restrict;

alter table public.installments drop constraint if exists installments_student_id_fkey;
alter table public.installments add constraint installments_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.installments drop constraint if exists installments_school_year_id_fkey;
alter table public.installments add constraint installments_school_year_id_fkey
  foreign key (school_year_id) references public.school_years(id) on delete restrict;

alter table public.payment_plans drop constraint if exists payment_plans_school_year_id_fkey;
alter table public.payment_plans add constraint payment_plans_school_year_id_fkey
  foreign key (school_year_id) references public.school_years(id) on delete restrict;

alter table public.payment_plans drop constraint if exists payment_plans_family_id_fkey;
alter table public.payment_plans add constraint payment_plans_family_id_fkey
  foreign key (family_id) references public.families(id) on delete restrict;

alter table public.attendance drop constraint if exists attendance_school_day_id_fkey;
alter table public.attendance add constraint attendance_school_day_id_fkey
  foreign key (school_day_id) references public.school_days(id) on delete restrict;

alter table public.class_notes drop constraint if exists class_notes_school_day_id_fkey;
alter table public.class_notes add constraint class_notes_school_day_id_fkey
  foreign key (school_day_id) references public.school_days(id) on delete restrict;

create or replace function public.admin_remove_guardian_from_family(p_family_id uuid, p_guardian_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_primary boolean;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  select is_primary_contact into v_was_primary
  from public.family_guardians
  where family_id = p_family_id
    and guardian_id = p_guardian_id
  for update;

  if not found then
    raise exception 'Den foresatte er ikke knyttet til familien.';
  end if;

  if not exists (
    select 1 from public.family_guardians
    where family_id = p_family_id
      and guardian_id <> p_guardian_id
  ) then
    raise exception 'Familien må ha minst én foresatt.';
  end if;

  delete from public.student_guardians
  where family_id = p_family_id
    and guardian_id = p_guardian_id;

  delete from public.family_guardians
  where family_id = p_family_id
    and guardian_id = p_guardian_id;

  if v_was_primary then
    update public.family_guardians
    set is_primary_contact = true
    where family_id = p_family_id
      and guardian_id = (
        select guardian_id from public.family_guardians
        where family_id = p_family_id
        order by sort_order, created_at, guardian_id
        limit 1
      );
  end if;

  if exists (select 1 from public.family_guardians where guardian_id = p_guardian_id)
    or exists (select 1 from public.guardians where id = p_guardian_id and is_teacher) then
    return 'unlinked';
  end if;

  delete from public.guardians where id = p_guardian_id;
  return 'deleted';
end;
$$;

revoke all on function public.admin_remove_guardian_from_family(uuid, uuid) from public, anon;
grant execute on function public.admin_remove_guardian_from_family(uuid, uuid) to authenticated;

create or replace function public.admin_merge_families(p_keep uuid, p_merge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair record;
  v_actor uuid;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if p_keep is null or p_merge is null or p_keep = p_merge then
    raise exception 'Velg to ulike familier.';
  end if;

  if (select count(*) from public.families where id in (p_keep, p_merge)) <> 2 then
    raise exception 'Fant ikke familien.';
  end if;

  perform 1 from public.families where id in (p_keep, p_merge) for update;

  if exists (
    select 1
    from public.payment_plans k
    join public.payment_plans m on m.school_year_id = k.school_year_id
    where k.family_id = p_keep
      and m.family_id = p_merge
      and k.status = 'aktiv'
      and m.status = 'aktiv'
  ) then
    raise exception 'Begge familiene har en aktiv betalingsplan for samme skoleår. Avslutt en av dem først.';
  end if;

  select id into v_actor from public.profiles where id = auth.uid();

  for v_pair in
    select distinct on (m.id) m.id as old_id, k.id as new_id
    from public.family_guardians mfg
    join public.guardians m on m.id = mfg.guardian_id
    join public.family_guardians kfg on kfg.family_id = p_keep
    join public.guardians k on k.id = kfg.guardian_id
    where mfg.family_id = p_merge
      and m.id <> k.id
      and nullif(btrim(m.email), '') is not null
      and lower(btrim(m.email)) <> 'mangler@islamskole.no'
      and lower(btrim(m.email)) = lower(btrim(k.email))
    order by m.id, k.created_at, k.id
  loop
    delete from public.family_guardians o
    where o.guardian_id = v_pair.old_id
      and exists (
        select 1 from public.family_guardians n
        where n.family_id = o.family_id
          and n.guardian_id = v_pair.new_id
      );

    update public.family_guardians
    set guardian_id = v_pair.new_id
    where guardian_id = v_pair.old_id;

    delete from public.class_teachers o
    where o.guardian_id = v_pair.old_id
      and exists (
        select 1 from public.class_teachers n
        where n.guardian_id = v_pair.new_id
          and n.class_id = o.class_id
          and n.school_year_id = o.school_year_id
      );

    update public.class_teachers set guardian_id = v_pair.new_id where guardian_id = v_pair.old_id;
    update public.student_fee_adjustments set teacher_guardian_id = v_pair.new_id where teacher_guardian_id = v_pair.old_id;
    update public.class_notes set author_guardian_id = v_pair.new_id where author_guardian_id = v_pair.old_id;
    update public.absence_reports set reported_by_guardian_id = v_pair.new_id where reported_by_guardian_id = v_pair.old_id;

    update public.guardians g
    set first_name = coalesce(nullif(btrim(g.first_name), ''), o.first_name),
        last_name = coalesce(nullif(btrim(g.last_name), ''), o.last_name),
        phone = coalesce(nullif(btrim(g.phone), ''), o.phone),
        teacher_note = coalesce(nullif(btrim(g.teacher_note), ''), o.teacher_note),
        source_application_id = coalesce(g.source_application_id, o.source_application_id),
        is_teacher = g.is_teacher or o.is_teacher,
        is_volunteer = g.is_volunteer or o.is_volunteer
    from public.guardians o
    where g.id = v_pair.new_id
      and o.id = v_pair.old_id;

    delete from public.guardians where id = v_pair.old_id;
  end loop;

  insert into public.family_guardians (
    family_id,
    guardian_id,
    relationship_label,
    is_primary_contact,
    is_billing_contact,
    receives_communication,
    sort_order
  )
  select p_keep, guardian_id, relationship_label, false, false, receives_communication, sort_order
  from public.family_guardians
  where family_id = p_merge
  on conflict (family_id, guardian_id) do nothing;

  delete from public.student_guardians where family_id = p_merge;

  update public.students set family_id = p_keep where family_id = p_merge;

  delete from public.family_guardians where family_id = p_merge;

  update public.payment_plans set family_id = p_keep where family_id = p_merge;
  update public.student_applications set family_id = p_keep where family_id = p_merge;
  update public.sadaqa_gifts set family_id = p_keep where family_id = p_merge;

  delete from public.sibling_discount_dismissals m
  where m.family_id = p_merge
    and exists (
      select 1 from public.sibling_discount_dismissals k
      where k.family_id = p_keep
        and k.school_year_id = m.school_year_id
    );

  update public.sibling_discount_dismissals set family_id = p_keep where family_id = p_merge;

  update public.family_data_reviews
  set status = 'resolved',
      resolved_at = now(),
      resolved_by = v_actor,
      updated_at = now()
  where status = 'open'
    and category = 'possible_duplicate_family'
    and (
      (family_id = p_keep and coalesce(details -> 'candidateFamilyIds', '[]'::jsonb) ? p_merge::text)
      or (family_id = p_merge and coalesce(details -> 'candidateFamilyIds', '[]'::jsonb) ? p_keep::text)
    );

  update public.family_data_reviews m
  set status = 'dismissed',
      resolved_at = now(),
      resolved_by = v_actor,
      updated_at = now()
  where m.family_id = p_merge
    and m.status = 'open'
    and exists (
      select 1 from public.family_data_reviews k
      where k.family_id = p_keep
        and k.status = 'open'
        and k.category = m.category
        and coalesce(k.source_entity, '') = coalesce(m.source_entity, '')
        and coalesce(k.source_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(m.source_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

  update public.family_data_reviews set family_id = p_keep where family_id = p_merge;

  delete from public.families where id = p_merge;
end;
$$;

revoke all on function public.admin_merge_families(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_families(uuid, uuid) to authenticated;

create or replace function public.admin_move_student_to_family(p_student_id uuid, p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Fant ikke eleven.';
  end if;

  if not exists (select 1 from public.families where id = p_family_id) then
    raise exception 'Fant ikke familien.';
  end if;

  delete from public.student_guardians where student_id = p_student_id;

  update public.students
  set family_id = p_family_id
  where id = p_student_id
    and family_id is distinct from p_family_id;

  if not found then
    insert into public.student_guardians (
      student_id,
      family_id,
      guardian_id,
      relationship_label,
      is_primary,
      receives_communication,
      sort_order
    )
    select p_student_id, family_id, guardian_id, relationship_label, is_primary_contact, receives_communication, sort_order
    from public.family_guardians
    where family_id = p_family_id;
  end if;
end;
$$;

revoke all on function public.admin_move_student_to_family(uuid, uuid) from public, anon;
grant execute on function public.admin_move_student_to_family(uuid, uuid) to authenticated;

create or replace function public.set_active_school_year(p_school_year_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous uuid;
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.school_years where id = p_school_year_id) then
    raise exception 'Fant ikke skoleåret.' using errcode = 'P0001';
  end if;

  select id into v_previous
  from public.school_years
  where is_active
    and id <> p_school_year_id;

  update public.school_years
  set is_active = false
  where is_active
    and id <> p_school_year_id;

  update public.school_years
  set is_active = true
  where id = p_school_year_id
    and not is_active;

  if v_previous is not null then
    insert into public.class_teachers (class_id, guardian_id, school_year_id, role)
    select ct.class_id, ct.guardian_id, p_school_year_id, ct.role
    from public.class_teachers ct
    join public.guardians g on g.id = ct.guardian_id and g.is_teacher
    where ct.school_year_id = v_previous
    on conflict (class_id, guardian_id, school_year_id) do nothing;
  end if;
end;
$$;

revoke execute on function public.set_active_school_year(uuid) from public, anon;
grant execute on function public.set_active_school_year(uuid) to authenticated;

create or replace function public.portal_guardian_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.guardians g
  where g.email is not null
    and lower(g.email) <> 'mangler@islamskole.no'
    and nullif(auth.jwt() ->> 'email', '') is not null
    and lower(g.email) = lower(auth.jwt() ->> 'email')
    and exists (select 1 from auth.users u where u.id = auth.uid());
$$;

create or replace function public.portal_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  where s.child_email is not null
    and lower(s.child_email) <> 'mangler@islamskole.no'
    and nullif(auth.jwt() ->> 'email', '') is not null
    and lower(s.child_email) = lower(auth.jwt() ->> 'email')
    and exists (select 1 from auth.users u where u.id = auth.uid());
$$;

revoke all on function public.portal_student_ids() from public, anon;
grant execute on function public.portal_student_ids() to authenticated;

create or replace function public.portal_is_student_in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.school_years sy on sy.id = e.school_year_id and sy.is_active
    where e.class_id = p_class_id
      and e.status = 'aktiv'
      and e.student_id in (select public.portal_student_ids())
  );
$$;

revoke all on function public.portal_is_student_in_class(uuid) from public, anon;
grant execute on function public.portal_is_student_in_class(uuid) to authenticated;

create or replace function public.portal_is_active_year_day(p_school_day_id uuid)
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
    where d.id = p_school_day_id
  );
$$;

revoke all on function public.portal_is_active_year_day(uuid) from public, anon;
grant execute on function public.portal_is_active_year_day(uuid) to authenticated;

create or replace function public.portal_is_uncancelled_day(p_school_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_days d
    where d.id = p_school_day_id
      and not d.cancelled
  );
$$;

revoke all on function public.portal_is_uncancelled_day(uuid) from public, anon;
grant execute on function public.portal_is_uncancelled_day(uuid) to authenticated;

create or replace function public.portal_can_write_attendance(p_student_id uuid, p_school_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portal_can_mark(p_student_id, p_school_day_id)
    and exists (
      select 1
      from public.school_days d
      where d.id = p_school_day_id
        and not d.cancelled
        and d.date <= (now() at time zone 'Europe/Oslo')::date
    );
$$;

revoke all on function public.portal_can_write_attendance(uuid, uuid) from public, anon;
grant execute on function public.portal_can_write_attendance(uuid, uuid) to authenticated;

drop policy if exists "teacher inserts class" on public.attendance;
create policy "teacher inserts class" on public.attendance
  for insert to authenticated
  with check (public.portal_can_write_attendance(student_id, school_day_id));

drop policy if exists "teacher updates class" on public.attendance;
create policy "teacher updates class" on public.attendance
  for update to authenticated
  using (public.portal_can_write_attendance(student_id, school_day_id))
  with check (public.portal_can_write_attendance(student_id, school_day_id));

drop policy if exists "student reads own" on public.attendance;
create policy "student reads own" on public.attendance
  for select to authenticated
  using (student_id in (select public.portal_student_ids()));

drop policy if exists "guardian reads class" on public.class_notes;
create policy "guardian reads class" on public.class_notes
  for select to authenticated
  using (public.portal_is_guardian_in_class(class_id) and public.portal_is_active_year_day(school_day_id));

drop policy if exists "student reads class" on public.class_notes;
create policy "student reads class" on public.class_notes
  for select to authenticated
  using (public.portal_is_student_in_class(class_id) and public.portal_is_active_year_day(school_day_id));

drop policy if exists "teacher inserts class" on public.class_notes;
create policy "teacher inserts class" on public.class_notes
  for insert to authenticated
  with check (
    public.portal_is_teacher_of(class_id)
    and public.portal_is_uncancelled_day(school_day_id)
    and (author_guardian_id is null or author_guardian_id in (select public.portal_guardian_ids()))
  );

drop policy if exists "teacher updates class" on public.class_notes;
create policy "teacher updates class" on public.class_notes
  for update to authenticated
  using (public.portal_is_teacher_of(class_id) and public.portal_is_uncancelled_day(school_day_id))
  with check (
    public.portal_is_teacher_of(class_id)
    and public.portal_is_uncancelled_day(school_day_id)
    and (author_guardian_id is null or author_guardian_id in (select public.portal_guardian_ids()))
  );

drop policy if exists "teacher deletes class" on public.class_notes;
create policy "teacher deletes class" on public.class_notes
  for delete to authenticated
  using (public.portal_is_teacher_of(class_id));

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
      select jsonb_agg(jsonb_build_object('id', n.id, 'date', d.date, 'homework', n.homework, 'summary', n.summary) order by d.date desc)
      from public.class_notes n
      join public.school_days d on d.id = n.school_day_id
      where n.class_id = c.id
        and d.school_year_id = sy.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('date', d.date, 'status', a.status) order by d.date desc)
      from public.attendance a
      join public.school_days d on d.id = a.school_day_id
      join public.school_years y on y.id = d.school_year_id and y.is_active
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

create or replace function public.profiles_keep_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin'
    and (tg_op = 'DELETE' or new.role is distinct from 'admin')
    and not exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Det må finnes minst én administrator.';
  end if;
  return null;
end;
$$;

revoke all on function public.profiles_keep_last_admin() from public, anon, authenticated;

drop trigger if exists profiles_keep_last_admin on public.profiles;
create trigger profiles_keep_last_admin
  after update of role or delete on public.profiles
  for each row execute function public.profiles_keep_last_admin();

create or replace function public.classes_default_name_en()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(btrim(new.name_en), '') is null then
    new.name_en := new.name_no;
  end if;
  return new;
end;
$$;

revoke all on function public.classes_default_name_en() from public, anon, authenticated;

drop trigger if exists classes_default_name_en on public.classes;
create trigger classes_default_name_en
  before insert or update on public.classes
  for each row execute function public.classes_default_name_en();
