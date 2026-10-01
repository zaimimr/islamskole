alter table public.sms_login_codes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists sms_login_codes_user_id_idx
  on public.sms_login_codes (user_id)
  where user_id is not null;

create table if not exists public.sms_login_phones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  verified_at timestamptz not null default now()
);

alter table public.sms_login_phones enable row level security;
revoke all on public.sms_login_phones from public, anon, authenticated;

drop function if exists public.sms_login_lookup(text);

create or replace function public.sms_login_lookup(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(u.email))
  from public.sms_login_phones p
  join auth.users u on u.id = p.user_id
  where p_phone is not null
    and p.phone = p_phone
    and nullif(trim(u.email), '') is not null
    and lower(trim(u.email)) <> 'mangler@islamskole.no'
  limit 1;
$$;

revoke all on function public.sms_login_lookup(text) from public, anon, authenticated;
grant execute on function public.sms_login_lookup(text) to service_role;

drop function if exists public.sms_login_issue(text, text, integer);

create or replace function public.sms_login_issue(
  p_phone text,
  p_code_hash text,
  p_ttl_seconds integer,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_attempts integer;
begin
  select coalesce(max(attempts), 0) into v_attempts
  from public.sms_login_codes
  where phone = p_phone
    and user_id is not distinct from p_user_id
    and consumed_at is null
    and expires_at > now();

  update public.sms_login_codes
  set consumed_at = now()
  where phone = p_phone
    and user_id is not distinct from p_user_id
    and consumed_at is null;

  insert into public.sms_login_codes (phone, code_hash, expires_at, attempts, user_id)
  values (p_phone, p_code_hash, now() + make_interval(secs => p_ttl_seconds), v_attempts, p_user_id)
  returning id into v_id;

  delete from public.sms_login_codes
  where created_at < now() - interval '1 day';

  return v_id;
end;
$$;

revoke all on function public.sms_login_issue(text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.sms_login_issue(text, text, integer, uuid) to service_role;

drop function if exists public.sms_login_verify(text, text, integer);

create or replace function public.sms_login_verify(
  p_phone text,
  p_code_hash text,
  p_max_attempts integer,
  p_user_id uuid default null
)
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
  where phone = p_phone
    and user_id is not distinct from p_user_id
    and consumed_at is null
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

revoke all on function public.sms_login_verify(text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.sms_login_verify(text, text, integer, uuid) to service_role;

create or replace function public.sms_login_link_phone(
  p_user_id uuid,
  p_phone text,
  p_code_hash text,
  p_max_attempts integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_user_id is null or public.normalize_no_mobile(p_phone) is distinct from p_phone then
    return 'invalid';
  end if;

  v_status := public.sms_login_verify(p_phone, p_code_hash, p_max_attempts, p_user_id);
  if v_status <> 'ok' then
    return v_status;
  end if;

  delete from public.sms_login_phones where phone = p_phone and user_id <> p_user_id;

  insert into public.sms_login_phones (user_id, phone, verified_at)
  values (p_user_id, p_phone, now())
  on conflict (user_id) do update
    set phone = excluded.phone,
        verified_at = excluded.verified_at;

  return 'ok';
end;
$$;

revoke all on function public.sms_login_link_phone(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.sms_login_link_phone(uuid, text, text, integer) to service_role;
