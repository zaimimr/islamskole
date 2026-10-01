create table if not exists public.sms_login_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sms_login_codes_phone_idx
  on public.sms_login_codes (phone, created_at desc);

alter table public.sms_login_codes enable row level security;
revoke all on public.sms_login_codes from public, anon, authenticated;

create or replace function public.normalize_no_mobile(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when d ~ '^[49][0-9]{7}$' then '+47' || d
    when d ~ '^(\+47|0047|47)[49][0-9]{7}$' then '+47' || right(d, 8)
    else null
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g') as d) s;
$$;

revoke all on function public.normalize_no_mobile(text) from public, anon, authenticated;
grant execute on function public.normalize_no_mobile(text) to service_role;

create or replace function public.sms_login_lookup(p_phone text)
returns table (email text, source text)
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(x.email)), x.source
  from (
    select g.email, 'guardian'::text as source, 0 as rank, g.created_at
    from public.guardians g
    where public.normalize_no_mobile(g.phone) = p_phone
    union all
    select s.child_email, 'student'::text, 1, s.created_at
    from public.students s
    where public.normalize_no_mobile(s.child_phone) = p_phone
  ) x
  where p_phone is not null
    and nullif(trim(x.email), '') is not null
    and lower(trim(x.email)) <> 'mangler@islamskole.no'
  order by x.rank, x.created_at;
$$;

revoke all on function public.sms_login_lookup(text) from public, anon, authenticated;
grant execute on function public.sms_login_lookup(text) to service_role;

create or replace function public.sms_login_issue(p_phone text, p_code_hash text, p_ttl_seconds integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.sms_login_codes
  set consumed_at = now()
  where phone = p_phone and consumed_at is null;

  insert into public.sms_login_codes (phone, code_hash, expires_at)
  values (p_phone, p_code_hash, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  delete from public.sms_login_codes
  where created_at < now() - interval '1 day';

  return v_id;
end;
$$;

revoke all on function public.sms_login_issue(text, text, integer) from public, anon, authenticated;
grant execute on function public.sms_login_issue(text, text, integer) to service_role;

create or replace function public.sms_login_verify(p_phone text, p_code_hash text, p_max_attempts integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.sms_login_codes;
begin
  select * into v_row
  from public.sms_login_codes
  where phone = p_phone and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return 'missing';
  end if;
  if v_row.expires_at <= now() then
    return 'expired';
  end if;
  if v_row.attempts >= p_max_attempts then
    return 'locked';
  end if;
  if v_row.code_hash = p_code_hash then
    update public.sms_login_codes set consumed_at = now() where id = v_row.id;
    return 'ok';
  end if;

  update public.sms_login_codes set attempts = attempts + 1 where id = v_row.id;
  if v_row.attempts + 1 >= p_max_attempts then
    return 'locked';
  end if;
  return 'invalid';
end;
$$;

revoke all on function public.sms_login_verify(text, text, integer) from public, anon, authenticated;
grant execute on function public.sms_login_verify(text, text, integer) to service_role;
