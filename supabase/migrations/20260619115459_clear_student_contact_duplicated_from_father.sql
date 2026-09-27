update public.students set
  email = null
where coalesce(btrim(email), '') <> ''
  and btrim(email) = coalesce(btrim(father_email), '')
  and coalesce(btrim(mother_first_name), '') = '';

update public.students set
  phone = null
where coalesce(btrim(phone), '') <> ''
  and btrim(phone) = coalesce(btrim(father_phone), '')
  and coalesce(btrim(mother_first_name), '') = '';
