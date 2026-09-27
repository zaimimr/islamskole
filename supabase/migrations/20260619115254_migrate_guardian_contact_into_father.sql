update public.student_applications set
  father_email = coalesce(nullif(btrim(father_email), ''), nullif(btrim(email), '')),
  father_phone = coalesce(nullif(btrim(father_phone), ''), nullif(btrim(phone), ''))
where coalesce(btrim(father_first_name), '') <> ''
  and coalesce(btrim(father_email), '') = ''
  and coalesce(btrim(mother_first_name), '') = ''
  and coalesce(btrim(mother_email), '') = '';

update public.students set
  father_email = coalesce(nullif(btrim(father_email), ''), nullif(btrim(email), '')),
  father_phone = coalesce(nullif(btrim(father_phone), ''), nullif(btrim(phone), ''))
where coalesce(btrim(father_first_name), '') <> ''
  and coalesce(btrim(father_email), '') = ''
  and coalesce(btrim(mother_first_name), '') = ''
  and coalesce(btrim(mother_email), '') = '';
