create or replace function public.create_portal_sibling_enrollment(
  p_family_id uuid,
  p_payer_guardian_id uuid,
  p_school_year_id uuid,
  p_reference text,
  p_amount integer,
  p_description text,
  p_address text,
  p_postal_code text,
  p_city text,
  p_child jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_application_id uuid;
  v_mother record;
  v_father record;
  v_payer record;
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

  if jsonb_typeof(p_child) <> 'object'
    or nullif(btrim(p_child ->> 'child_first_name'), '') is null
    or nullif(btrim(p_child ->> 'child_last_name'), '') is null
    or nullif(btrim(p_child ->> 'child_birth_date'), '') is null
    or coalesce(p_child ->> 'child_gender', '') not in ('gutt', 'jente')
    or coalesce((p_child ->> 'terms_accepted')::boolean, false) is false then
    raise exception 'Child enrollment is incomplete' using errcode = '22023';
  end if;

  if not exists (select 1 from public.families where id = p_family_id) then
    raise exception 'Family not found' using errcode = '23503';
  end if;

  if not exists (select 1 from public.school_years where id = p_school_year_id) then
    raise exception 'School year not found' using errcode = '23503';
  end if;

  select g.id, g.first_name, g.last_name, g.email, g.phone
  into v_mother
  from public.family_guardians fg
  join public.guardians g on g.id = fg.guardian_id
  where fg.family_id = p_family_id
  order by (fg.relationship_label = 'mor') desc, fg.sort_order, g.first_name
  limit 1;

  if not found then
    raise exception 'Family has no guardians' using errcode = '22023';
  end if;

  select g.id, g.first_name, g.last_name, g.email, g.phone
  into v_father
  from public.family_guardians fg
  join public.guardians g on g.id = fg.guardian_id
  where fg.family_id = p_family_id
    and g.id <> v_mother.id
  order by (fg.relationship_label = 'far') desc, fg.sort_order, g.first_name
  limit 1;

  select g.first_name, g.last_name, g.email, g.phone
  into v_payer
  from public.family_guardians fg
  join public.guardians g on g.id = fg.guardian_id
  where fg.family_id = p_family_id
  order by (g.id = p_payer_guardian_id) desc, fg.is_primary_contact desc, fg.sort_order
  limit 1;

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
    nullif(btrim(concat_ws(' ', v_payer.first_name, v_payer.last_name)), ''),
    lower(nullif(btrim(v_payer.email), '')),
    nullif(btrim(v_payer.phone), '')
  )
  returning id into v_payment_id;

  insert into public.student_applications (
    child_first_name,
    child_last_name,
    child_birth_date,
    child_gender,
    child_address,
    child_postal_code,
    child_city,
    mother_first_name,
    mother_last_name,
    mother_phone,
    mother_email,
    father_first_name,
    father_last_name,
    father_phone,
    father_email,
    desired_class,
    message,
    terms_accepted,
    family_id,
    payment_id
  ) values (
    btrim(p_child ->> 'child_first_name'),
    btrim(p_child ->> 'child_last_name'),
    (p_child ->> 'child_birth_date')::date,
    p_child ->> 'child_gender',
    btrim(p_address),
    btrim(p_postal_code),
    btrim(p_city),
    nullif(btrim(v_mother.first_name), ''),
    nullif(btrim(v_mother.last_name), ''),
    nullif(btrim(v_mother.phone), ''),
    lower(nullif(btrim(v_mother.email), '')),
    nullif(btrim(v_father.first_name), ''),
    nullif(btrim(v_father.last_name), ''),
    nullif(btrim(v_father.phone), ''),
    lower(nullif(btrim(v_father.email), '')),
    nullif(btrim(p_child ->> 'desired_class'), ''),
    nullif(btrim(p_child ->> 'message'), ''),
    true,
    p_family_id,
    v_payment_id
  )
  returning id into v_application_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'application_id', v_application_id
  );
end
$$;

revoke all on function public.create_portal_sibling_enrollment(
  uuid, uuid, uuid, text, integer, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_portal_sibling_enrollment(
  uuid, uuid, uuid, text, integer, text, text, text, text, jsonb
) to service_role;
