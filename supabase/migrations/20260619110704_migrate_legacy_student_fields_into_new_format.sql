update public.student_applications set
  child_first_name = coalesce(nullif(btrim(child_first_name), ''), split_part(btrim(child_name), ' ', 1)),
  child_last_name = coalesce(
    nullif(btrim(child_last_name), ''),
    case when btrim(child_name) like '% %'
      then btrim(substring(btrim(child_name) from position(' ' in btrim(child_name)) + 1))
      else null end)
where child_name is not null and btrim(child_name) <> '';

update public.student_applications set
  father_first_name = split_part(btrim(guardian_name), ' ', 1),
  father_last_name = case when btrim(guardian_name) like '% %'
    then btrim(substring(btrim(guardian_name) from position(' ' in btrim(guardian_name)) + 1))
    else null end
where guardian_name is not null and btrim(guardian_name) <> ''
  and coalesce(btrim(father_first_name), '') = ''
  and coalesce(btrim(father_last_name), '') = '';

update public.student_applications set
  mother_first_name = split_part(btrim(guardian_name), ' ', 1),
  mother_last_name = case when btrim(guardian_name) like '% %'
    then btrim(substring(btrim(guardian_name) from position(' ' in btrim(guardian_name)) + 1))
    else null end
where guardian_name is not null and btrim(guardian_name) <> ''
  and (coalesce(btrim(father_first_name), '') <> '' or coalesce(btrim(father_last_name), '') <> '')
  and coalesce(btrim(mother_first_name), '') = ''
  and coalesce(btrim(mother_last_name), '') = '';

update public.student_applications set
  message = nullif(concat_ws(E'\n', nullif(btrim(message), ''), 'Alder ved påmelding: ' || child_age), '')
where child_age is not null;

update public.students set
  child_first_name = coalesce(nullif(btrim(child_first_name), ''), split_part(btrim(full_name), ' ', 1)),
  child_last_name = coalesce(
    nullif(btrim(child_last_name), ''),
    case when btrim(full_name) like '% %'
      then btrim(substring(btrim(full_name) from position(' ' in btrim(full_name)) + 1))
      else null end)
where full_name is not null and btrim(full_name) <> '';

update public.students set
  father_first_name = split_part(btrim(guardian_name), ' ', 1),
  father_last_name = case when btrim(guardian_name) like '% %'
    then btrim(substring(btrim(guardian_name) from position(' ' in btrim(guardian_name)) + 1))
    else null end
where guardian_name is not null and btrim(guardian_name) <> ''
  and coalesce(btrim(father_first_name), '') = ''
  and coalesce(btrim(father_last_name), '') = '';

update public.students set
  mother_first_name = split_part(btrim(guardian_name), ' ', 1),
  mother_last_name = case when btrim(guardian_name) like '% %'
    then btrim(substring(btrim(guardian_name) from position(' ' in btrim(guardian_name)) + 1))
    else null end
where guardian_name is not null and btrim(guardian_name) <> ''
  and (coalesce(btrim(father_first_name), '') <> '' or coalesce(btrim(father_last_name), '') <> '')
  and coalesce(btrim(mother_first_name), '') = ''
  and coalesce(btrim(mother_last_name), '') = '';

update public.students set
  notes = nullif(concat_ws(E'\n', nullif(btrim(notes), ''), 'Alder ved påmelding: ' || child_age), '')
where child_age is not null;
