alter table public.students add column if not exists allergies text;
alter table public.students add column if not exists medical_notes text;
alter table public.students add column if not exists photo_consent boolean;
alter table public.students add column if not exists health_updated_at timestamptz;
alter table public.students add column if not exists continues_next_year boolean;
alter table public.students add column if not exists continues_answered_at timestamptz;

create table if not exists public.family_pickup_persons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text check (phone is null or length(phone) <= 40),
  relation text check (relation is null or length(relation) <= 60),
  created_at timestamptz not null default now()
);

create index if not exists family_pickup_persons_family_idx on public.family_pickup_persons (family_id);

alter table public.family_pickup_persons enable row level security;
revoke all on public.family_pickup_persons from anon;
revoke insert, update, delete on public.family_pickup_persons from authenticated;

drop policy if exists "admin all" on public.family_pickup_persons;
create policy "admin all" on public.family_pickup_persons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.guardian_email_changes (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  new_email text not null,
  token_hash text not null unique,
  requested_by uuid,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guardian_email_changes_guardian_idx on public.guardian_email_changes (guardian_id);

alter table public.guardian_email_changes enable row level security;
revoke all on public.guardian_email_changes from anon, authenticated;

drop policy if exists "admin all" on public.guardian_email_changes;
create policy "admin all" on public.guardian_email_changes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.portal_my_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct fg.family_id
  from public.family_guardians fg
  where fg.guardian_id in (select public.portal_guardian_ids());
$$;

revoke all on function public.portal_my_family_ids() from public, anon;
grant execute on function public.portal_my_family_ids() to authenticated;

create or replace function public.portal_can_edit_guardian(p_guardian_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_guardians fg
    where fg.guardian_id = p_guardian_id
      and fg.family_id in (select public.portal_my_family_ids())
  );
$$;

revoke all on function public.portal_can_edit_guardian(uuid) from public, anon;
grant execute on function public.portal_can_edit_guardian(uuid) to authenticated;

create or replace function public.portal_can_edit_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.family_id in (select public.portal_my_family_ids())
  )
  or public.portal_is_guardian_of(p_student_id);
$$;

revoke all on function public.portal_can_edit_student(uuid) from public, anon;
grant execute on function public.portal_can_edit_student(uuid) to authenticated;

create or replace function public.portal_my_families()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(family_row order by family_row ->> 'display_name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', f.id,
      'display_name', f.display_name,
      'address', f.address,
      'postal_code', f.postal_code,
      'city', f.city,
      'guardians', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.id,
          'first_name', g.first_name,
          'last_name', g.last_name,
          'email', g.email,
          'phone', g.phone,
          'relationship_label', fg.relationship_label,
          'is_me', g.id in (select public.portal_guardian_ids()),
          'pending_email', (
            select c.new_email
            from public.guardian_email_changes c
            where c.guardian_id = g.id
              and c.confirmed_at is null
              and c.expires_at > now()
            order by c.created_at desc
            limit 1
          )
        ) order by fg.sort_order, g.first_name)
        from public.family_guardians fg
        join public.guardians g on g.id = fg.guardian_id
        where fg.family_id = f.id
      ), '[]'::jsonb),
      'children', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'first_name', s.child_first_name,
          'last_name', s.child_last_name,
          'birth_date', s.child_birth_date,
          'allergies', s.allergies,
          'medical_notes', s.medical_notes,
          'photo_consent', s.photo_consent,
          'health_updated_at', s.health_updated_at,
          'continues_next_year', s.continues_next_year,
          'active_this_year', exists (
            select 1
            from public.enrollments e
            join public.school_years sy on sy.id = e.school_year_id and sy.is_active
            where e.student_id = s.id and e.status = 'aktiv'
          )
        ) order by s.child_birth_date nulls last, s.child_first_name)
        from public.students s
        where s.family_id = f.id
      ), '[]'::jsonb),
      'pickup', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'phone', p.phone,
          'relation', p.relation
        ) order by p.created_at)
        from public.family_pickup_persons p
        where p.family_id = f.id
      ), '[]'::jsonb)
    ) as family_row
    from public.families f
    where f.id in (select public.portal_my_family_ids())
  ) rows;
$$;

revoke all on function public.portal_my_families() from public, anon;
grant execute on function public.portal_my_families() to authenticated;

create or replace function public.portal_update_family_address(
  p_family_id uuid,
  p_address text,
  p_postal_code text,
  p_city text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_address), '') is null
    or nullif(btrim(p_postal_code), '') is null
    or nullif(btrim(p_city), '') is null then
    raise exception 'Adressen er ikke fullstendig.' using errcode = '22023';
  end if;

  update public.families
  set address = btrim(p_address),
      postal_code = btrim(p_postal_code),
      city = btrim(p_city),
      updated_at = now()
  where id = p_family_id;

  update public.students
  set child_address = btrim(p_address),
      child_postal_code = btrim(p_postal_code),
      child_city = btrim(p_city),
      updated_at = now()
  where family_id = p_family_id;
end;
$$;

revoke all on function public.portal_update_family_address(uuid, text, text, text) from public, anon;
grant execute on function public.portal_update_family_address(uuid, text, text, text) to authenticated;

create or replace function public.portal_update_guardian(
  p_guardian_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.portal_can_edit_guardian(p_guardian_id) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;

  update public.guardians
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      phone = nullif(btrim(p_phone), ''),
      updated_at = now()
  where id = p_guardian_id;
end;
$$;

revoke all on function public.portal_update_guardian(uuid, text, text, text) from public, anon;
grant execute on function public.portal_update_guardian(uuid, text, text, text) to authenticated;

create or replace function public.portal_add_guardian(
  p_family_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_relationship_label text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_guardian uuid;
  v_sort integer;
begin
  if p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;
  if coalesce(p_relationship_label, '') not in ('mor', 'far', 'foresatt', 'steforelder', 'verge', 'annet') then
    raise exception 'Ugyldig rolle.' using errcode = '22023';
  end if;

  insert into public.guardians (first_name, last_name, phone)
  values (btrim(p_first_name), btrim(p_last_name), nullif(btrim(p_phone), ''))
  returning id into v_guardian;

  select coalesce(max(sort_order), -1) + 1 into v_sort
  from public.family_guardians where family_id = p_family_id;

  insert into public.family_guardians (
    family_id, guardian_id, relationship_label, is_primary_contact, is_billing_contact, receives_communication, sort_order
  ) values (p_family_id, v_guardian, p_relationship_label, false, false, true, v_sort);

  insert into public.student_guardians (
    student_id, guardian_id, family_id, relationship_label, is_primary, receives_communication, sort_order
  )
  select s.id, v_guardian, p_family_id, p_relationship_label, false, true, v_sort
  from public.students s
  where s.family_id = p_family_id
  on conflict do nothing;

  return v_guardian;
end;
$$;

revoke all on function public.portal_add_guardian(uuid, text, text, text, text) from public, anon;
grant execute on function public.portal_add_guardian(uuid, text, text, text, text) to authenticated;

create or replace function public.portal_update_child_health(
  p_student_id uuid,
  p_allergies text,
  p_medical_notes text,
  p_photo_consent boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.portal_can_edit_student(p_student_id) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if length(coalesce(p_allergies, '')) > 1000 or length(coalesce(p_medical_notes, '')) > 2000 then
    raise exception 'Teksten er for lang.' using errcode = '22023';
  end if;

  update public.students
  set allergies = nullif(btrim(p_allergies), ''),
      medical_notes = nullif(btrim(p_medical_notes), ''),
      photo_consent = p_photo_consent,
      health_updated_at = now(),
      updated_at = now()
  where id = p_student_id;
end;
$$;

revoke all on function public.portal_update_child_health(uuid, text, text, boolean) from public, anon;
grant execute on function public.portal_update_child_health(uuid, text, text, boolean) to authenticated;

create or replace function public.portal_set_continues(p_student_id uuid, p_continues boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.portal_can_edit_student(p_student_id) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  update public.students
  set continues_next_year = p_continues,
      continues_answered_at = case when p_continues is null then null else now() end,
      updated_at = now()
  where id = p_student_id;
end;
$$;

revoke all on function public.portal_set_continues(uuid, boolean) from public, anon;
grant execute on function public.portal_set_continues(uuid, boolean) to authenticated;

create or replace function public.portal_add_pickup(
  p_family_id uuid,
  p_name text,
  p_phone text,
  p_relation text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if (select count(*) from public.family_pickup_persons where family_id = p_family_id) >= 10 then
    raise exception 'Maks 10 personer.' using errcode = '22023';
  end if;

  insert into public.family_pickup_persons (family_id, name, phone, relation)
  values (p_family_id, btrim(p_name), nullif(btrim(p_phone), ''), nullif(btrim(p_relation), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.portal_add_pickup(uuid, text, text, text) from public, anon;
grant execute on function public.portal_add_pickup(uuid, text, text, text) to authenticated;

create or replace function public.portal_remove_pickup(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  delete from public.family_pickup_persons
  where id = p_id
    and family_id in (select public.portal_my_family_ids());
  if not found then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.portal_remove_pickup(uuid) from public, anon;
grant execute on function public.portal_remove_pickup(uuid) to authenticated;

drop function if exists public.portal_class_roster(uuid, uuid);
create function public.portal_class_roster(p_class_id uuid, p_school_day_id uuid)
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

revoke all on function public.portal_class_roster(uuid, uuid) from public, anon;
grant execute on function public.portal_class_roster(uuid, uuid) to authenticated;
