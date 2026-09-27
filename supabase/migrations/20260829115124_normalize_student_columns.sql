do $$
declare
  column_pair text[];
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_applications'
      and column_name = 'child_name'
  ) then
    execute $statement$
      update public.student_applications
      set
        child_first_name = coalesce(
          nullif(btrim(child_first_name), ''),
          split_part(btrim(child_name), ' ', 1)
        ),
        child_last_name = coalesce(
          nullif(btrim(child_last_name), ''),
          case
            when btrim(child_name) like '% %' then
              btrim(substring(btrim(child_name) from position(' ' in btrim(child_name)) + 1))
            else null
          end
        )
      where nullif(btrim(child_name), '') is not null
    $statement$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_applications'
      and column_name = 'guardian_name'
  ) then
    execute $statement$
      update public.student_applications
      set
        mother_first_name = coalesce(
          nullif(btrim(mother_first_name), ''),
          split_part(btrim(guardian_name), ' ', 1)
        ),
        mother_last_name = coalesce(
          nullif(btrim(mother_last_name), ''),
          case
            when btrim(guardian_name) like '% %' then
              btrim(substring(btrim(guardian_name) from position(' ' in btrim(guardian_name)) + 1))
            else null
          end
        ),
        mother_email = coalesce(nullif(btrim(mother_email), ''), nullif(btrim(email), '')),
        mother_phone = coalesce(nullif(btrim(mother_phone), ''), nullif(btrim(phone), ''))
      where nullif(btrim(guardian_name), '') is not null
        and nullif(
          btrim(concat_ws(' ', mother_first_name, mother_last_name)),
          ''
        ) is null
        and nullif(
          btrim(concat_ws(' ', father_first_name, father_last_name)),
          ''
        ) is null
    $statement$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_applications'
      and column_name = 'child_age'
  ) then
    execute $statement$
      update public.student_applications
      set message = nullif(
        concat_ws(
          E'\n',
          nullif(btrim(message), ''),
          'Alder ved påmelding: ' || child_age
        ),
        ''
      )
      where child_age is not null
    $statement$;
  end if;

  foreach column_pair slice 1 in array array[
    array['birth_date', 'child_birth_date'],
    array['gender', 'child_gender'],
    array['address', 'child_address'],
    array['postal_code', 'child_postal_code'],
    array['city', 'child_city'],
    array['email', 'child_email'],
    array['phone', 'child_phone'],
    array['level_quran', 'child_level_quran'],
    array['level_arabic', 'child_level_arabic'],
    array['level_islam', 'child_level_islam']
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'student_applications'
        and column_name = column_pair[1]
    ) then
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'student_applications'
          and column_name = column_pair[2]
      ) then
        execute format(
          'update public.student_applications set %I = coalesce(%I, %I)',
          column_pair[2],
          column_pair[2],
          column_pair[1]
        );
        execute format(
          'alter table public.student_applications drop column %I',
          column_pair[1]
        );
      else
        execute format(
          'alter table public.student_applications rename column %I to %I',
          column_pair[1],
          column_pair[2]
        );
      end if;
    end if;
  end loop;

  alter table public.student_applications
    drop column if exists child_name,
    drop column if exists child_age,
    drop column if exists guardian_name;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_applications'
      and column_name = 'child_email'
  ) then
    alter table public.student_applications
      alter column child_email drop not null;
  end if;
end
$$;

do $$
declare
  column_pair text[];
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'full_name'
  ) then
    execute $statement$
      update public.students
      set
        child_first_name = coalesce(
          nullif(btrim(child_first_name), ''),
          split_part(btrim(full_name), ' ', 1)
        ),
        child_last_name = coalesce(
          nullif(btrim(child_last_name), ''),
          case
            when btrim(full_name) like '% %' then
              btrim(substring(btrim(full_name) from position(' ' in btrim(full_name)) + 1))
            else null
          end
        )
      where nullif(btrim(full_name), '') is not null
    $statement$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'guardian_name'
  ) then
    execute $statement$
      update public.students
      set
        mother_first_name = coalesce(
          nullif(btrim(mother_first_name), ''),
          split_part(btrim(guardian_name), ' ', 1)
        ),
        mother_last_name = coalesce(
          nullif(btrim(mother_last_name), ''),
          case
            when btrim(guardian_name) like '% %' then
              btrim(substring(btrim(guardian_name) from position(' ' in btrim(guardian_name)) + 1))
            else null
          end
        ),
        mother_email = coalesce(nullif(btrim(mother_email), ''), nullif(btrim(email), '')),
        mother_phone = coalesce(nullif(btrim(mother_phone), ''), nullif(btrim(phone), ''))
      where nullif(btrim(guardian_name), '') is not null
        and nullif(
          btrim(concat_ws(' ', mother_first_name, mother_last_name)),
          ''
        ) is null
        and nullif(
          btrim(concat_ws(' ', father_first_name, father_last_name)),
          ''
        ) is null
    $statement$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'child_age'
  ) then
    execute $statement$
      update public.students
      set notes = nullif(
        concat_ws(
          E'\n',
          nullif(btrim(notes), ''),
          'Alder ved påmelding: ' || child_age
        ),
        ''
      )
      where child_age is not null
    $statement$;
  end if;

  foreach column_pair slice 1 in array array[
    array['birth_date', 'child_birth_date'],
    array['gender', 'child_gender'],
    array['address', 'child_address'],
    array['postal_code', 'child_postal_code'],
    array['city', 'child_city'],
    array['email', 'child_email'],
    array['phone', 'child_phone'],
    array['level_quran', 'child_level_quran'],
    array['level_arabic', 'child_level_arabic'],
    array['level_islam', 'child_level_islam']
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'students'
        and column_name = column_pair[1]
    ) then
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'students'
          and column_name = column_pair[2]
      ) then
        execute format(
          'update public.students set %I = coalesce(%I, %I)',
          column_pair[2],
          column_pair[2],
          column_pair[1]
        );
        execute format(
          'alter table public.students drop column %I',
          column_pair[1]
        );
      else
        execute format(
          'alter table public.students rename column %I to %I',
          column_pair[1],
          column_pair[2]
        );
      end if;
    end if;
  end loop;

  alter table public.students
    drop column if exists full_name,
    drop column if exists child_age,
    drop column if exists guardian_name,
    drop column if exists guardian2_name,
    drop column if exists guardian2_email,
    drop column if exists guardian2_phone,
    drop column if exists student_email,
    drop column if exists student_phone;
end
$$;
