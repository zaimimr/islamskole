create or replace function public.portal_diff(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(n.key, jsonb_build_object('from', coalesce(p_old -> n.key, 'null'::jsonb), 'to', n.value)),
    '{}'::jsonb
  )
  from jsonb_each(p_new) n
  where coalesce(p_old -> n.key, 'null'::jsonb) is distinct from n.value;
$$;

revoke all on function public.portal_diff(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.portal_valid_phone(p_phone text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_phone is null
    or (length(p_phone) <= 40 and regexp_replace(p_phone, '[\s-]', '', 'g') ~ '^\+?\d{8,15}$');
$$;

revoke all on function public.portal_valid_phone(text) from public, anon, authenticated;

create or replace function public.portal_log_change(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_family_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, metadata)
  values (
    (select u.id from auth.users u where u.id = auth.uid()),
    nullif(auth.jwt() ->> 'email', ''),
    p_action,
    p_entity_type,
    p_entity_id::text,
    jsonb_build_object('source', 'parent', 'family_id', p_family_id) || coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.portal_log_change(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.portal_sync_family_contacts(p_family_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.family_guardians where family_id = p_family_id) then
    return;
  end if;

  with contacts as (
    select
      g.first_name,
      g.last_name,
      g.phone,
      g.email,
      row_number() over (order by fg.is_primary_contact desc, fg.sort_order, g.id) as position
    from public.family_guardians fg
    join public.guardians g on g.id = fg.guardian_id
    where fg.family_id = p_family_id
  )
  update public.students s
  set
    mother_first_name = (select first_name from contacts where position = 1),
    mother_last_name = (select last_name from contacts where position = 1),
    mother_phone = (select phone from contacts where position = 1),
    mother_email = (select email from contacts where position = 1),
    father_first_name = (select first_name from contacts where position = 2),
    father_last_name = (select last_name from contacts where position = 2),
    father_phone = (select phone from contacts where position = 2),
    father_email = (select email from contacts where position = 2)
  where s.family_id = p_family_id;
end;
$$;

revoke all on function public.portal_sync_family_contacts(uuid) from public, anon, authenticated;
grant execute on function public.portal_sync_family_contacts(uuid) to service_role;

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
      'preferred_language', f.preferred_language,
      'guardians', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.id,
          'first_name', g.first_name,
          'last_name', g.last_name,
          'email', g.email,
          'phone', g.phone,
          'relationship_label', fg.relationship_label,
          'receives_communication', fg.receives_communication,
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
          'gender', s.child_gender,
          'email', s.child_email,
          'phone', s.child_phone,
          'level_quran', s.child_level_quran,
          'level_arabic', s.child_level_arabic,
          'level_islam', s.child_level_islam,
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
declare
  v_old jsonb;
  v_new jsonb;
begin
  if p_family_id is null or p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_address), '') is null
    or nullif(btrim(p_postal_code), '') is null
    or nullif(btrim(p_city), '') is null then
    raise exception 'Adressen er ikke fullstendig.' using errcode = '22023';
  end if;
  if btrim(p_postal_code) !~ '^\d{4}$' or length(btrim(p_address)) > 200 or length(btrim(p_city)) > 100 then
    raise exception 'Adressen er ugyldig.' using errcode = '22023';
  end if;

  select jsonb_build_object('address', address, 'postal_code', postal_code, 'city', city)
  into v_old
  from public.families
  where id = p_family_id
  for update;

  v_new := jsonb_build_object('address', btrim(p_address), 'postal_code', btrim(p_postal_code), 'city', btrim(p_city));

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

  if public.portal_diff(v_old, v_new) <> '{}'::jsonb then
    perform public.portal_log_change(
      'portal.family.address', 'family', p_family_id, p_family_id,
      jsonb_build_object('changes', public.portal_diff(v_old, v_new))
    );
  end if;
end;
$$;

revoke all on function public.portal_update_family_address(uuid, text, text, text) from public, anon;
grant execute on function public.portal_update_family_address(uuid, text, text, text) to authenticated;

create or replace function public.portal_update_family_preferences(
  p_family_id uuid,
  p_preferred_language text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if p_family_id is null or p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if coalesce(p_preferred_language, '') not in ('no', 'en') then
    raise exception 'Ugyldig språk.' using errcode = '22023';
  end if;

  select preferred_language into v_old from public.families where id = p_family_id for update;

  update public.families
  set preferred_language = p_preferred_language,
      updated_at = now()
  where id = p_family_id;

  if v_old is distinct from p_preferred_language then
    perform public.portal_log_change(
      'portal.family.preferences', 'family', p_family_id, p_family_id,
      jsonb_build_object('changes', jsonb_build_object(
        'preferred_language', jsonb_build_object('from', v_old, 'to', p_preferred_language)
      ))
    );
  end if;
end;
$$;

revoke all on function public.portal_update_family_preferences(uuid, text) from public, anon;
grant execute on function public.portal_update_family_preferences(uuid, text) to authenticated;

create or replace function public.portal_update_family_guardian(
  p_family_id uuid,
  p_guardian_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_relationship_label text,
  p_receives_communication boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_phone text := nullif(btrim(p_phone), '');
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
begin
  if p_family_id is null or p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.family_guardians where family_id = p_family_id and guardian_id = p_guardian_id
  ) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null
    or length(btrim(p_first_name)) > 80 or length(btrim(p_last_name)) > 80 then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;
  if not public.portal_valid_phone(v_phone) then
    raise exception 'Ugyldig telefonnummer.' using errcode = '22023';
  end if;
  if coalesce(p_relationship_label, '') not in ('mor', 'far', 'foresatt', 'steforelder', 'verge', 'annet') then
    raise exception 'Ugyldig rolle.' using errcode = '22023';
  end if;
  if p_receives_communication is null then
    raise exception 'Velg om den foresatte skal få beskjeder.' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'first_name', g.first_name,
    'last_name', g.last_name,
    'phone', g.phone,
    'relationship_label', fg.relationship_label,
    'receives_communication', fg.receives_communication
  )
  into v_old
  from public.guardians g
  join public.family_guardians fg on fg.guardian_id = g.id and fg.family_id = p_family_id
  where g.id = p_guardian_id
  for update of g, fg;

  if not p_receives_communication
    and (v_old ->> 'receives_communication')::boolean
    and not exists (
      select 1 from public.family_guardians
      where family_id = p_family_id
        and guardian_id <> p_guardian_id
        and receives_communication
    ) then
    raise exception 'Minst én foresatt må få beskjeder.' using errcode = '22023';
  end if;

  v_new := jsonb_build_object(
    'first_name', btrim(p_first_name),
    'last_name', btrim(p_last_name),
    'phone', v_phone,
    'relationship_label', p_relationship_label,
    'receives_communication', p_receives_communication
  );
  v_diff := public.portal_diff(v_old, v_new);
  if v_diff = '{}'::jsonb then
    return;
  end if;

  update public.guardians
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      phone = v_phone,
      updated_at = now()
  where id = p_guardian_id;

  update public.family_guardians
  set relationship_label = p_relationship_label,
      receives_communication = p_receives_communication
  where family_id = p_family_id
    and guardian_id = p_guardian_id;

  perform public.portal_sync_family_contacts(fg.family_id)
  from public.family_guardians fg
  where fg.guardian_id = p_guardian_id;

  perform public.portal_log_change(
    'portal.guardian.update', 'guardian', p_guardian_id, p_family_id,
    jsonb_build_object('changes', v_diff)
  );
end;
$$;

revoke all on function public.portal_update_family_guardian(uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.portal_update_family_guardian(uuid, uuid, text, text, text, text, boolean) to authenticated;

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
declare
  v_family uuid;
  v_link public.family_guardians%rowtype;
begin
  select fg.family_id into v_family
  from public.family_guardians fg
  where fg.guardian_id = p_guardian_id
    and fg.family_id in (select public.portal_my_family_ids())
  order by fg.family_id
  limit 1;

  if v_family is null then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  select * into v_link from public.family_guardians where family_id = v_family and guardian_id = p_guardian_id;

  perform public.portal_update_family_guardian(
    v_family,
    p_guardian_id,
    p_first_name,
    p_last_name,
    p_phone,
    case when v_link.relationship_label in ('mor', 'far', 'foresatt', 'steforelder', 'verge', 'annet')
      then v_link.relationship_label else 'foresatt' end,
    v_link.receives_communication
  );
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
  v_phone text := nullif(btrim(p_phone), '');
begin
  if p_family_id is null or p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null
    or length(btrim(p_first_name)) > 80 or length(btrim(p_last_name)) > 80 then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;
  if not public.portal_valid_phone(v_phone) then
    raise exception 'Ugyldig telefonnummer.' using errcode = '22023';
  end if;
  if coalesce(p_relationship_label, '') not in ('mor', 'far', 'foresatt', 'steforelder', 'verge', 'annet') then
    raise exception 'Ugyldig rolle.' using errcode = '22023';
  end if;
  if (select count(*) from public.family_guardians where family_id = p_family_id) >= 6 then
    raise exception 'Maks 6 foresatte.' using errcode = '22023';
  end if;

  insert into public.guardians (first_name, last_name, phone)
  values (btrim(p_first_name), btrim(p_last_name), v_phone)
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

  perform public.portal_sync_family_contacts(p_family_id);

  perform public.portal_log_change(
    'portal.guardian.add', 'guardian', v_guardian, p_family_id,
    jsonb_build_object('added', jsonb_build_object(
      'first_name', btrim(p_first_name),
      'last_name', btrim(p_last_name),
      'phone', v_phone,
      'relationship_label', p_relationship_label
    ))
  );

  return v_guardian;
end;
$$;

revoke all on function public.portal_add_guardian(uuid, text, text, text, text) from public, anon;
grant execute on function public.portal_add_guardian(uuid, text, text, text, text) to authenticated;

create or replace function public.portal_remove_guardian(p_family_id uuid, p_guardian_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_link public.family_guardians%rowtype;
  v_guardian public.guardians%rowtype;
  v_result text;
begin
  if p_family_id is null or p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if p_guardian_id in (select public.portal_guardian_ids()) then
    raise exception 'Du kan ikke fjerne deg selv.' using errcode = '22023';
  end if;

  select * into v_link
  from public.family_guardians
  where family_id = p_family_id and guardian_id = p_guardian_id
  for update;

  if not found then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.family_guardians
    where family_id = p_family_id and guardian_id <> p_guardian_id
  ) then
    raise exception 'Familien må ha minst én foresatt.' using errcode = '22023';
  end if;

  select * into v_guardian from public.guardians where id = p_guardian_id for update;

  delete from public.student_guardians
  where family_id = p_family_id and guardian_id = p_guardian_id;

  delete from public.family_guardians
  where family_id = p_family_id and guardian_id = p_guardian_id;

  if v_link.is_primary_contact then
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

  if v_link.is_billing_contact then
    update public.family_guardians
    set is_billing_contact = true
    where family_id = p_family_id
      and guardian_id = (
        select guardian_id from public.family_guardians
        where family_id = p_family_id
        order by is_primary_contact desc, sort_order, created_at, guardian_id
        limit 1
      );
  end if;

  if not exists (
    select 1 from public.family_guardians where family_id = p_family_id and receives_communication
  ) then
    update public.family_guardians
    set receives_communication = true
    where family_id = p_family_id;
  end if;

  perform public.portal_sync_family_contacts(p_family_id);

  if exists (select 1 from public.family_guardians where guardian_id = p_guardian_id)
    or v_guardian.is_teacher
    or v_guardian.is_volunteer then
    v_result := 'unlinked';
  else
    delete from public.guardians where id = p_guardian_id;
    v_result := 'deleted';
  end if;

  perform public.portal_log_change(
    'portal.guardian.remove', 'guardian', p_guardian_id, p_family_id,
    jsonb_build_object(
      'result', v_result,
      'removed', jsonb_build_object(
        'first_name', v_guardian.first_name,
        'last_name', v_guardian.last_name,
        'email', v_guardian.email,
        'phone', v_guardian.phone,
        'relationship_label', v_link.relationship_label
      )
    )
  );

  return v_result;
end;
$$;

revoke all on function public.portal_remove_guardian(uuid, uuid) from public, anon;
grant execute on function public.portal_remove_guardian(uuid, uuid) to authenticated;

create or replace function public.portal_update_child(
  p_student_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_gender text,
  p_email text,
  p_phone text,
  p_level_quran text,
  p_level_arabic text,
  p_level_islam text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(p_email), ''));
  v_phone text := nullif(btrim(p_phone), '');
  v_quran text := nullif(btrim(p_level_quran), '');
  v_arabic text := nullif(btrim(p_level_arabic), '');
  v_islam text := nullif(btrim(p_level_islam), '');
  v_family uuid;
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
begin
  if not public.portal_can_edit_student(p_student_id) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null
    or length(btrim(p_first_name)) > 80 or length(btrim(p_last_name)) > 80 then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;
  if p_birth_date is null or p_birth_date < date '1950-01-01' or p_birth_date > current_date then
    raise exception 'Ugyldig fødselsdato.' using errcode = '22023';
  end if;
  if coalesce(p_gender, '') not in ('gutt', 'jente') then
    raise exception 'Ugyldig kjønn.' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or v_email = 'mangler@islamskole.no') then
    raise exception 'Ugyldig e-postadresse.' using errcode = '22023';
  end if;
  if not public.portal_valid_phone(v_phone) then
    raise exception 'Ugyldig telefonnummer.' using errcode = '22023';
  end if;
  if (v_quran is not null and v_quran not in ('nybegynner', 'litt', 'middels', 'god'))
    or (v_arabic is not null and v_arabic not in ('nybegynner', 'litt', 'middels', 'god'))
    or (v_islam is not null and v_islam not in ('nybegynner', 'litt', 'middels', 'god')) then
    raise exception 'Ugyldig nivå.' using errcode = '22023';
  end if;

  select
    s.family_id,
    jsonb_build_object(
      'child_first_name', s.child_first_name,
      'child_last_name', s.child_last_name,
      'child_birth_date', s.child_birth_date,
      'child_gender', s.child_gender,
      'child_email', s.child_email,
      'child_phone', s.child_phone,
      'child_level_quran', s.child_level_quran,
      'child_level_arabic', s.child_level_arabic,
      'child_level_islam', s.child_level_islam
    )
  into v_family, v_old
  from public.students s
  where s.id = p_student_id
  for update;

  v_new := jsonb_build_object(
    'child_first_name', btrim(p_first_name),
    'child_last_name', btrim(p_last_name),
    'child_birth_date', p_birth_date,
    'child_gender', p_gender,
    'child_email', v_email,
    'child_phone', v_phone,
    'child_level_quran', v_quran,
    'child_level_arabic', v_arabic,
    'child_level_islam', v_islam
  );
  v_diff := public.portal_diff(v_old, v_new);
  if v_diff = '{}'::jsonb then
    return;
  end if;

  update public.students
  set child_first_name = btrim(p_first_name),
      child_last_name = btrim(p_last_name),
      child_birth_date = p_birth_date,
      child_gender = p_gender,
      child_email = v_email,
      child_phone = v_phone,
      child_level_quran = v_quran,
      child_level_arabic = v_arabic,
      child_level_islam = v_islam,
      updated_at = now()
  where id = p_student_id;

  perform public.portal_log_change(
    'portal.child.update', 'student', p_student_id, v_family,
    jsonb_build_object('changes', v_diff)
  );
end;
$$;

revoke all on function public.portal_update_child(uuid, text, text, date, text, text, text, text, text, text) from public, anon;
grant execute on function public.portal_update_child(uuid, text, text, date, text, text, text, text, text, text) to authenticated;

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
declare
  v_family uuid;
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
begin
  if not public.portal_can_edit_student(p_student_id) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if length(coalesce(p_allergies, '')) > 1000 or length(coalesce(p_medical_notes, '')) > 2000 then
    raise exception 'Teksten er for lang.' using errcode = '22023';
  end if;

  select
    s.family_id,
    jsonb_build_object('allergies', s.allergies, 'medical_notes', s.medical_notes, 'photo_consent', s.photo_consent)
  into v_family, v_old
  from public.students s
  where s.id = p_student_id
  for update;

  v_new := jsonb_build_object(
    'allergies', nullif(btrim(p_allergies), ''),
    'medical_notes', nullif(btrim(p_medical_notes), ''),
    'photo_consent', p_photo_consent
  );
  v_diff := public.portal_diff(v_old, v_new);

  update public.students
  set allergies = nullif(btrim(p_allergies), ''),
      medical_notes = nullif(btrim(p_medical_notes), ''),
      photo_consent = p_photo_consent,
      health_updated_at = now(),
      updated_at = now()
  where id = p_student_id;

  if v_diff <> '{}'::jsonb then
    perform public.portal_log_change(
      'portal.child.health', 'student', p_student_id, v_family,
      jsonb_build_object('changes', v_diff)
    );
  end if;
end;
$$;

revoke all on function public.portal_update_child_health(uuid, text, text, boolean) from public, anon;
grant execute on function public.portal_update_child_health(uuid, text, text, boolean) to authenticated;

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
  v_phone text := nullif(btrim(p_phone), '');
begin
  if p_family_id is null or p_family_id not in (select public.portal_my_family_ids()) then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 120
    or length(coalesce(btrim(p_relation), '')) > 60 then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;
  if not public.portal_valid_phone(v_phone) then
    raise exception 'Ugyldig telefonnummer.' using errcode = '22023';
  end if;
  if (select count(*) from public.family_pickup_persons where family_id = p_family_id) >= 10 then
    raise exception 'Maks 10 personer.' using errcode = '22023';
  end if;

  insert into public.family_pickup_persons (family_id, name, phone, relation)
  values (p_family_id, btrim(p_name), v_phone, nullif(btrim(p_relation), ''))
  returning id into v_id;

  perform public.portal_log_change(
    'portal.pickup.add', 'family_pickup_person', v_id, p_family_id,
    jsonb_build_object('added', jsonb_build_object(
      'name', btrim(p_name),
      'phone', v_phone,
      'relation', nullif(btrim(p_relation), '')
    ))
  );
  return v_id;
end;
$$;

revoke all on function public.portal_add_pickup(uuid, text, text, text) from public, anon;
grant execute on function public.portal_add_pickup(uuid, text, text, text) to authenticated;

create or replace function public.portal_update_pickup(
  p_id uuid,
  p_name text,
  p_phone text,
  p_relation text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_phone text := nullif(btrim(p_phone), '');
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb;
begin
  select p.family_id, jsonb_build_object('name', p.name, 'phone', p.phone, 'relation', p.relation)
  into v_family, v_old
  from public.family_pickup_persons p
  where p.id = p_id
    and p.family_id in (select public.portal_my_family_ids())
  for update;

  if v_family is null then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 120
    or length(coalesce(btrim(p_relation), '')) > 60 then
    raise exception 'Navn mangler.' using errcode = '22023';
  end if;
  if not public.portal_valid_phone(v_phone) then
    raise exception 'Ugyldig telefonnummer.' using errcode = '22023';
  end if;

  v_new := jsonb_build_object('name', btrim(p_name), 'phone', v_phone, 'relation', nullif(btrim(p_relation), ''));
  v_diff := public.portal_diff(v_old, v_new);
  if v_diff = '{}'::jsonb then
    return;
  end if;

  update public.family_pickup_persons
  set name = btrim(p_name),
      phone = v_phone,
      relation = nullif(btrim(p_relation), '')
  where id = p_id;

  perform public.portal_log_change(
    'portal.pickup.update', 'family_pickup_person', p_id, v_family,
    jsonb_build_object('changes', v_diff)
  );
end;
$$;

revoke all on function public.portal_update_pickup(uuid, text, text, text) from public, anon;
grant execute on function public.portal_update_pickup(uuid, text, text, text) to authenticated;

create or replace function public.portal_remove_pickup(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.family_pickup_persons%rowtype;
begin
  delete from public.family_pickup_persons
  where id = p_id
    and family_id in (select public.portal_my_family_ids())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  perform public.portal_log_change(
    'portal.pickup.remove', 'family_pickup_person', v_row.id, v_row.family_id,
    jsonb_build_object('removed', jsonb_build_object(
      'name', v_row.name,
      'phone', v_row.phone,
      'relation', v_row.relation
    ))
  );
end;
$$;

revoke all on function public.portal_remove_pickup(uuid) from public, anon;
grant execute on function public.portal_remove_pickup(uuid) to authenticated;

create index if not exists audit_log_parent_family_idx
  on public.audit_log ((metadata ->> 'family_id'), created_at desc)
  where action like 'portal.%';
