create or replace function public.update_family_relationships(
  p_family_id uuid,
  p_family jsonb,
  p_guardians jsonb,
  p_resolve_reviews boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian jsonb;
  v_guardian_id uuid;
  v_position integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.families where id = p_family_id) then
    raise exception 'Family not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_guardians) <> 'array'
    or jsonb_array_length(p_guardians) < 1
    or jsonb_array_length(p_guardians) > 8 then
    raise exception 'Between one and eight guardians are required'
      using errcode = '22023';
  end if;

  update public.families
  set
    display_name = nullif(btrim(p_family ->> 'display_name'), ''),
    address = nullif(btrim(p_family ->> 'address'), ''),
    postal_code = nullif(btrim(p_family ->> 'postal_code'), ''),
    city = nullif(btrim(p_family ->> 'city'), '')
  where id = p_family_id;

  update public.family_guardians
  set
    is_primary_contact = false,
    is_billing_contact = false
  where family_id = p_family_id
    and (is_primary_contact or is_billing_contact);

  for v_guardian, v_position in
    select value, ordinality::integer
    from jsonb_array_elements(p_guardians) with ordinality
  loop
    if nullif(
      btrim(concat_ws(
        ' ',
        v_guardian ->> 'first_name',
        v_guardian ->> 'last_name'
      )),
      ''
    ) is null then
      raise exception 'Guardian name is required' using errcode = '22023';
    end if;

    if coalesce(v_guardian ->> 'role', '') not in (
      'foresatt',
      'guardian',
      'mor',
      'far',
      'steforelder',
      'verge',
      'annet'
    ) then
      raise exception 'Invalid guardian role' using errcode = '22023';
    end if;

    v_guardian_id := nullif(v_guardian ->> 'id', '')::uuid;

    if v_guardian_id is null then
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
        p_family_id,
        v_guardian_id,
        v_guardian ->> 'role',
        v_position = 1,
        v_position = 1,
        true,
        v_position - 1
      );
    else
      if not exists (
        select 1
        from public.family_guardians
        where family_id = p_family_id
          and guardian_id = v_guardian_id
      ) then
        raise exception 'Guardian does not belong to family'
          using errcode = '23503';
      end if;

      update public.guardians
      set
        first_name = nullif(btrim(v_guardian ->> 'first_name'), ''),
        last_name = nullif(btrim(v_guardian ->> 'last_name'), ''),
        email = lower(nullif(btrim(v_guardian ->> 'email'), '')),
        phone = nullif(btrim(v_guardian ->> 'phone'), '')
      where id = v_guardian_id;

      update public.family_guardians
      set
        relationship_label = v_guardian ->> 'role',
        is_primary_contact = v_position = 1,
        is_billing_contact = v_position = 1,
        sort_order = v_position - 1
      where family_id = p_family_id
        and guardian_id = v_guardian_id;
    end if;
  end loop;

  with contacts as (
    select
      guardian.first_name,
      guardian.last_name,
      guardian.phone,
      guardian.email,
      row_number() over (
        order by family.is_primary_contact desc, family.sort_order, guardian.id
      ) as position
    from public.family_guardians family
    join public.guardians guardian on guardian.id = family.guardian_id
    where family.family_id = p_family_id
  )
  update public.students student
  set
    mother_first_name = (select first_name from contacts where position = 1),
    mother_last_name = (select last_name from contacts where position = 1),
    mother_phone = (select phone from contacts where position = 1),
    mother_email = (select email from contacts where position = 1),
    father_first_name = (select first_name from contacts where position = 2),
    father_last_name = (select last_name from contacts where position = 2),
    father_phone = (select phone from contacts where position = 2),
    father_email = (select email from contacts where position = 2)
  where student.family_id = p_family_id;

  if p_resolve_reviews then
    update public.family_data_reviews
    set
      status = 'resolved',
      resolved_at = now(),
      resolved_by = case
        when exists (
          select 1 from public.profiles where id = auth.uid()
        ) then auth.uid()
        else null
      end
    where family_id = p_family_id
      and status = 'open';
  end if;
end
$$;

revoke all on function public.update_family_relationships(
  uuid,
  jsonb,
  jsonb,
  boolean
) from public;
revoke all on function public.update_family_relationships(
  uuid,
  jsonb,
  jsonb,
  boolean
) from anon;
grant execute on function public.update_family_relationships(
  uuid,
  jsonb,
  jsonb,
  boolean
) to authenticated;
grant execute on function public.update_family_relationships(
  uuid,
  jsonb,
  jsonb,
  boolean
) to service_role;
