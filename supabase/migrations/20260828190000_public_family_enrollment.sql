create or replace function public.sync_student_family_guardians()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.student_guardians
  where student_id = new.id
    and family_id is distinct from new.family_id;

  if new.family_id is null then
    return new;
  end if;

  insert into public.student_guardians (
    student_id,
    family_id,
    guardian_id,
    relationship_label,
    is_primary,
    receives_communication,
    sort_order
  )
  select
    new.id,
    family.family_id,
    family.guardian_id,
    family.relationship_label,
    family.is_primary_contact,
    family.receives_communication,
    family.sort_order
  from public.family_guardians family
  where family.family_id = new.family_id
  on conflict (student_id, guardian_id)
  do update set
    family_id = excluded.family_id,
    relationship_label = excluded.relationship_label,
    is_primary = excluded.is_primary,
    receives_communication = excluded.receives_communication,
    sort_order = excluded.sort_order;

  return new;
end
$$;

revoke all on function public.sync_student_family_guardians() from public;

drop trigger if exists students_sync_family_guardians on public.students;
create trigger students_sync_family_guardians
  after insert or update of family_id on public.students
  for each row execute function public.sync_student_family_guardians();

create or replace function public.propagate_family_guardian()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.student_guardians
    where family_id = old.family_id
      and guardian_id = old.guardian_id;
    return old;
  end if;

  insert into public.student_guardians (
    student_id,
    family_id,
    guardian_id,
    relationship_label,
    is_primary,
    receives_communication,
    sort_order
  )
  select
    student.id,
    new.family_id,
    new.guardian_id,
    new.relationship_label,
    new.is_primary_contact,
    new.receives_communication,
    new.sort_order
  from public.students student
  where student.family_id = new.family_id
  on conflict (student_id, guardian_id)
  do update set
    family_id = excluded.family_id,
    relationship_label = excluded.relationship_label,
    is_primary = excluded.is_primary,
    receives_communication = excluded.receives_communication,
    sort_order = excluded.sort_order;

  if tg_op = 'UPDATE'
    and (
      old.family_id is distinct from new.family_id
      or old.guardian_id is distinct from new.guardian_id
    ) then
    delete from public.student_guardians
    where family_id = old.family_id
      and guardian_id = old.guardian_id;
  end if;

  return new;
end
$$;

revoke all on function public.propagate_family_guardian() from public;

drop trigger if exists family_guardians_propagate on public.family_guardians;
create trigger family_guardians_propagate
  after insert or update or delete on public.family_guardians
  for each row execute function public.propagate_family_guardian();

create or replace function public.create_public_family_enrollment(
  p_school_year_id uuid,
  p_reference text,
  p_amount integer,
  p_description text,
  p_address text,
  p_postal_code text,
  p_city text,
  p_guardians jsonb,
  p_children jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_payment_id uuid;
  v_guardian_id uuid;
  v_guardian jsonb;
  v_child jsonb;
  v_guardian_count integer;
  v_child_count integer;
  v_sort_order integer := 0;
  v_candidate_family_ids uuid[];
  v_primary_guardian jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_amount <= 0
    or nullif(btrim(p_reference), '') is null
    or nullif(btrim(p_address), '') is null
    or nullif(btrim(p_postal_code), '') is null
    or nullif(btrim(p_city), '') is null then
    raise exception 'Invalid enrollment payment or address' using errcode = '22023';
  end if;

  if jsonb_typeof(p_guardians) <> 'array'
    or jsonb_typeof(p_children) <> 'array' then
    raise exception 'Guardians and children must be arrays' using errcode = '22023';
  end if;

  v_guardian_count := jsonb_array_length(p_guardians);
  v_child_count := jsonb_array_length(p_children);

  if v_guardian_count < 1 or v_guardian_count > 6 then
    raise exception 'Invalid guardian count' using errcode = '22023';
  end if;

  if v_child_count < 1 or v_child_count > 10 then
    raise exception 'Invalid child count' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.school_years
    where id = p_school_year_id
  ) then
    raise exception 'School year not found' using errcode = '23503';
  end if;

  insert into public.families (
    address,
    postal_code,
    city,
    origin
  ) values (
    btrim(p_address),
    btrim(p_postal_code),
    btrim(p_city),
    'public_enrollment'
  )
  returning id into v_family_id;

  for v_guardian in
    select value from jsonb_array_elements(p_guardians)
  loop
    if nullif(btrim(v_guardian ->> 'first_name'), '') is null
      or nullif(btrim(v_guardian ->> 'last_name'), '') is null
      or nullif(btrim(v_guardian ->> 'email'), '') is null
      or nullif(btrim(v_guardian ->> 'phone'), '') is null then
      raise exception 'Guardian contact is incomplete' using errcode = '22023';
    end if;

    insert into public.guardians (
      first_name,
      last_name,
      email,
      phone
    ) values (
      btrim(v_guardian ->> 'first_name'),
      btrim(v_guardian ->> 'last_name'),
      lower(btrim(v_guardian ->> 'email')),
      btrim(v_guardian ->> 'phone')
    )
    returning id into v_guardian_id;

    insert into public.family_guardians (
      family_id,
      guardian_id,
      relationship_label,
      is_primary_contact,
      is_billing_contact,
      receives_communication,
      sort_order
    ) values (
      v_family_id,
      v_guardian_id,
      coalesce(nullif(btrim(v_guardian ->> 'role'), ''), 'foresatt'),
      v_sort_order = 0,
      v_sort_order = 0,
      true,
      v_sort_order
    );

    if v_sort_order = 0 then
      v_primary_guardian := v_guardian;
    end if;

    v_sort_order := v_sort_order + 1;
  end loop;

  select array_agg(distinct existing.family_id order by existing.family_id)
  into v_candidate_family_ids
  from public.family_guardians current_membership
  join public.guardians current_guardian
    on current_guardian.id = current_membership.guardian_id
  join public.guardians existing_guardian
    on (
      nullif(lower(btrim(current_guardian.email)), '') is not null
      and lower(btrim(existing_guardian.email)) = lower(btrim(current_guardian.email))
    )
    or (
      nullif(regexp_replace(current_guardian.phone, '[^0-9+]', '', 'g'), '') is not null
      and regexp_replace(existing_guardian.phone, '[^0-9+]', '', 'g') =
        regexp_replace(current_guardian.phone, '[^0-9+]', '', 'g')
    )
  join public.family_guardians existing
    on existing.guardian_id = existing_guardian.id
  where current_membership.family_id = v_family_id
    and existing.family_id <> v_family_id;

  if cardinality(v_candidate_family_ids) > 0 then
    insert into public.family_data_reviews (
      family_id,
      category,
      source_entity,
      source_entity_id,
      details
    ) values (
      v_family_id,
      'possible_duplicate_family',
      'family',
      v_family_id,
      jsonb_build_object(
        'candidateFamilyIds', to_jsonb(v_candidate_family_ids),
        'source', 'public_enrollment'
      )
    )
    on conflict do nothing;
  end if;

  insert into public.payments (
    school_year_id,
    reference,
    amount,
    currency,
    method,
    status,
    description,
    payer_name,
    payer_email,
    payer_phone
  ) values (
    p_school_year_id,
    btrim(p_reference),
    p_amount,
    'NOK',
    'vipps',
    'opprettet',
    nullif(btrim(p_description), ''),
    nullif(
      btrim(concat_ws(
        ' ',
        v_primary_guardian ->> 'first_name',
        v_primary_guardian ->> 'last_name'
      )),
      ''
    ),
    lower(nullif(btrim(v_primary_guardian ->> 'email'), '')),
    nullif(btrim(v_primary_guardian ->> 'phone'), '')
  )
  returning id into v_payment_id;

  for v_child in
    select value from jsonb_array_elements(p_children)
  loop
    if nullif(btrim(v_child ->> 'child_first_name'), '') is null
      or nullif(btrim(v_child ->> 'child_last_name'), '') is null
      or nullif(btrim(v_child ->> 'child_birth_date'), '') is null
      or nullif(btrim(v_child ->> 'child_gender'), '') is null
      or coalesce((v_child ->> 'terms_accepted')::boolean, false) is false then
      raise exception 'Child enrollment is incomplete' using errcode = '22023';
    end if;

    insert into public.student_applications (
      child_first_name,
      child_last_name,
      child_birth_date,
      child_gender,
      child_address,
      child_postal_code,
      child_city,
      child_email,
      child_phone,
      mother_first_name,
      mother_last_name,
      mother_phone,
      mother_email,
      father_first_name,
      father_last_name,
      father_phone,
      father_email,
      desired_class,
      child_level_quran,
      child_level_arabic,
      child_level_islam,
      message,
      terms_accepted,
      family_id,
      payment_id
    ) values (
      btrim(v_child ->> 'child_first_name'),
      btrim(v_child ->> 'child_last_name'),
      (v_child ->> 'child_birth_date')::date,
      btrim(v_child ->> 'child_gender'),
      btrim(p_address),
      btrim(p_postal_code),
      btrim(p_city),
      nullif(btrim(v_child ->> 'child_email'), ''),
      nullif(btrim(v_child ->> 'child_phone'), ''),
      nullif(btrim(v_child ->> 'mother_first_name'), ''),
      nullif(btrim(v_child ->> 'mother_last_name'), ''),
      nullif(btrim(v_child ->> 'mother_phone'), ''),
      lower(nullif(btrim(v_child ->> 'mother_email'), '')),
      nullif(btrim(v_child ->> 'father_first_name'), ''),
      nullif(btrim(v_child ->> 'father_last_name'), ''),
      nullif(btrim(v_child ->> 'father_phone'), ''),
      lower(nullif(btrim(v_child ->> 'father_email'), '')),
      nullif(btrim(v_child ->> 'desired_class'), ''),
      nullif(btrim(v_child ->> 'child_level_quran'), ''),
      nullif(btrim(v_child ->> 'child_level_arabic'), ''),
      nullif(btrim(v_child ->> 'child_level_islam'), ''),
      nullif(btrim(v_child ->> 'message'), ''),
      true,
      v_family_id,
      v_payment_id
    );
  end loop;

  return jsonb_build_object(
    'family_id', v_family_id,
    'payment_id', v_payment_id
  );
end
$$;

revoke all on function public.create_public_family_enrollment(
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public;
revoke all on function public.create_public_family_enrollment(
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from anon;
revoke all on function public.create_public_family_enrollment(
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from authenticated;
grant execute on function public.create_public_family_enrollment(
  uuid,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;

create or replace function public.create_manual_family_student(p_student jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_student_id uuid;
  v_guardian_id uuid;
  v_guardian jsonb;
  v_sort_order integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if nullif(btrim(p_student ->> 'child_first_name'), '') is null
    or nullif(btrim(p_student ->> 'child_last_name'), '') is null then
    raise exception 'Student name is required' using errcode = '22023';
  end if;

  insert into public.families (
    address,
    postal_code,
    city,
    origin
  ) values (
    nullif(btrim(p_student ->> 'child_address'), ''),
    nullif(btrim(p_student ->> 'child_postal_code'), ''),
    nullif(btrim(p_student ->> 'child_city'), ''),
    'manual'
  )
  returning id into v_family_id;

  for v_guardian in
    select value
    from jsonb_array_elements(
      jsonb_build_array(
        jsonb_build_object(
          'first_name', p_student ->> 'mother_first_name',
          'last_name', p_student ->> 'mother_last_name',
          'email', p_student ->> 'mother_email',
          'phone', p_student ->> 'mother_phone',
          'role', 'mor'
        ),
        jsonb_build_object(
          'first_name', p_student ->> 'father_first_name',
          'last_name', p_student ->> 'father_last_name',
          'email', p_student ->> 'father_email',
          'phone', p_student ->> 'father_phone',
          'role', 'far'
        )
      )
    )
  loop
    if nullif(
      btrim(concat_ws(
        ' ',
        v_guardian ->> 'first_name',
        v_guardian ->> 'last_name'
      )),
      ''
    ) is null then
      continue;
    end if;

    insert into public.guardians (
      first_name,
      last_name,
      email,
      phone
    ) values (
      nullif(btrim(v_guardian ->> 'first_name'), ''),
      nullif(btrim(v_guardian ->> 'last_name'), ''),
      lower(nullif(btrim(v_guardian ->> 'email'), '')),
      nullif(btrim(v_guardian ->> 'phone'), '')
    )
    returning id into v_guardian_id;

    insert into public.family_guardians (
      family_id,
      guardian_id,
      relationship_label,
      is_primary_contact,
      is_billing_contact,
      receives_communication,
      sort_order
    ) values (
      v_family_id,
      v_guardian_id,
      v_guardian ->> 'role',
      v_sort_order = 0,
      v_sort_order = 0,
      true,
      v_sort_order
    );

    v_sort_order := v_sort_order + 1;
  end loop;

  if v_sort_order = 0 then
    raise exception 'At least one guardian is required' using errcode = '22023';
  end if;

  insert into public.students (
    family_id,
    child_first_name,
    child_last_name,
    child_birth_date,
    child_gender,
    child_address,
    child_postal_code,
    child_city,
    child_email,
    child_phone,
    mother_first_name,
    mother_last_name,
    mother_phone,
    mother_email,
    father_first_name,
    father_last_name,
    father_phone,
    father_email,
    child_level_quran,
    child_level_arabic,
    child_level_islam,
    notes
  ) values (
    v_family_id,
    btrim(p_student ->> 'child_first_name'),
    btrim(p_student ->> 'child_last_name'),
    nullif(btrim(p_student ->> 'child_birth_date'), '')::date,
    nullif(btrim(p_student ->> 'child_gender'), ''),
    nullif(btrim(p_student ->> 'child_address'), ''),
    nullif(btrim(p_student ->> 'child_postal_code'), ''),
    nullif(btrim(p_student ->> 'child_city'), ''),
    nullif(btrim(p_student ->> 'child_email'), ''),
    nullif(btrim(p_student ->> 'child_phone'), ''),
    nullif(btrim(p_student ->> 'mother_first_name'), ''),
    nullif(btrim(p_student ->> 'mother_last_name'), ''),
    nullif(btrim(p_student ->> 'mother_phone'), ''),
    lower(nullif(btrim(p_student ->> 'mother_email'), '')),
    nullif(btrim(p_student ->> 'father_first_name'), ''),
    nullif(btrim(p_student ->> 'father_last_name'), ''),
    nullif(btrim(p_student ->> 'father_phone'), ''),
    lower(nullif(btrim(p_student ->> 'father_email'), '')),
    nullif(btrim(p_student ->> 'child_level_quran'), ''),
    nullif(btrim(p_student ->> 'child_level_arabic'), ''),
    nullif(btrim(p_student ->> 'child_level_islam'), ''),
    nullif(btrim(p_student ->> 'notes'), '')
  )
  returning id into v_student_id;

  return v_student_id;
end
$$;

revoke all on function public.create_manual_family_student(jsonb) from public;
revoke all on function public.create_manual_family_student(jsonb) from anon;
grant execute on function public.create_manual_family_student(jsonb) to authenticated;
grant execute on function public.create_manual_family_student(jsonb) to service_role;
