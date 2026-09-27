create unique index if not exists school_years_one_active
  on public.school_years ((true))
  where is_active;

create or replace function public.set_active_school_year(p_school_year_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Du har ikke tilgang til å gjøre dette.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.school_years where id = p_school_year_id) then
    raise exception 'Fant ikke skoleåret.' using errcode = 'P0001';
  end if;

  update public.school_years
  set is_active = false
  where is_active
    and id <> p_school_year_id;

  update public.school_years
  set is_active = true
  where id = p_school_year_id
    and not is_active;
end;
$$;

revoke execute on function public.set_active_school_year(uuid) from public, anon;
grant execute on function public.set_active_school_year(uuid) to authenticated;
