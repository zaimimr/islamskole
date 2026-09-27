do $$
begin
  if not exists (
    select 1
    from public.enrollments
    where status = 'aktiv'
    group by student_id, school_year_id
    having count(*) > 1
  ) then
    create unique index if not exists enrollments_one_active_per_year
      on public.enrollments (student_id, school_year_id)
      where status = 'aktiv';
  else
    raise notice 'enrollments_one_active_per_year skipped: duplicate active enrollments exist';
  end if;
end
$$;

create or replace function public.rollover_enrollments(
  p_from_year uuid,
  p_to_year uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee integer;
  v_row jsonb;
  v_student uuid;
  v_class uuid;
  v_class_price integer;
  v_price integer;
  v_enrollment uuid;
  v_created jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  v_actor uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Du har ikke tilgang til å gjøre dette'
      using errcode = '42501';
  end if;

  if p_from_year is null or p_to_year is null or p_from_year = p_to_year then
    raise exception 'Velg to ulike skoleår'
      using errcode = 'P0001';
  end if;

  select fee into v_fee from public.school_years where id = p_to_year;
  if not found then
    raise exception 'Fant ikke skoleåret'
      using errcode = 'P0001';
  end if;
  if v_fee is null then
    raise exception 'Sett årspris for skoleåret før du flytter elever'
      using errcode = 'P0001';
  end if;

  for v_row in
    select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_student := (v_row ->> 'student_id')::uuid;
    v_class := (v_row ->> 'class_id')::uuid;

    if not exists (
      select 1
      from public.enrollments
      where student_id = v_student
        and school_year_id = p_from_year
        and status = 'aktiv'
    ) then
      raise exception 'En av elevene har ikke plass i skoleåret det flyttes fra'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.enrollments
      where student_id = v_student
        and school_year_id = p_to_year
        and status = 'aktiv'
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select price into v_class_price from public.classes where id = v_class;
    if not found then
      raise exception 'Fant ikke klassen'
        using errcode = 'P0001';
    end if;
    v_price := coalesce(v_class_price, v_fee);

    insert into public.enrollments (
      student_id,
      class_id,
      school_year_id,
      status,
      price_snapshot
    )
    values (v_student, v_class, p_to_year, 'aktiv', v_price)
    on conflict (student_id, class_id, school_year_id)
      do update set
        status = 'aktiv',
        price_snapshot = excluded.price_snapshot,
        updated_at = now()
    returning id into v_enrollment;

    insert into public.student_fees (student_id, school_year_id, amount)
    values (v_student, p_to_year, v_price * 100)
    on conflict (student_id, school_year_id) do nothing;

    insert into public.audit_log (
      actor_id,
      actor_email,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      v_actor,
      v_email,
      'enrollment.rollover',
      'student_enrollments',
      v_enrollment::text,
      jsonb_build_object(
        'studentId', v_student,
        'classId', v_class,
        'fromSchoolYearId', p_from_year,
        'schoolYearId', p_to_year,
        'priceSnapshot', v_price
      )
    );

    v_created := v_created || jsonb_build_object(
      'student_id', v_student,
      'enrollment_id', v_enrollment
    );
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end
$$;

revoke all on function public.rollover_enrollments(uuid, uuid, jsonb) from public;
revoke all on function public.rollover_enrollments(uuid, uuid, jsonb) from anon;
grant execute on function public.rollover_enrollments(uuid, uuid, jsonb) to authenticated;
grant execute on function public.rollover_enrollments(uuid, uuid, jsonb) to service_role;
