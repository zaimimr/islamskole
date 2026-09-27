create table if not exists public.payment_targets (
  payment_id uuid not null references public.payments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (payment_id, student_id)
);

create index if not exists payment_targets_student_idx
  on public.payment_targets (student_id);

alter table public.payment_targets enable row level security;

drop policy if exists "admin all" on public.payment_targets;
create policy "admin all" on public.payment_targets
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.payment_allocation_locks (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  locked_at timestamptz not null default now(),
  locked_by text
);

alter table public.payment_allocation_locks enable row level security;

drop policy if exists "admin all" on public.payment_allocation_locks;
create policy "admin all" on public.payment_allocation_locks
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.payment_reconciliation_issues (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  kind text not null check (kind in ('refund_mismatch')),
  local_amount integer not null,
  provider_amount integer not null,
  flagged_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.payment_reconciliation_issues enable row level security;

drop policy if exists "admin all" on public.payment_reconciliation_issues;
create policy "admin all" on public.payment_reconciliation_issues
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.families
  add column if not exists preferred_language text not null default 'no';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'families_preferred_language_check'
  ) then
    alter table public.families
      add constraint families_preferred_language_check
      check (preferred_language in ('no', 'en'));
  end if;
end
$$;

create or replace function public.replace_payment_allocations(
  p_payment_id uuid,
  p_allocations jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_targets uuid[] := array[]::uuid[];
  v_planned integer[];
  v_target uuid;
  v_row jsonb;
  v_share integer;
  v_remaining integer;
  v_left integer;
  v_total bigint := 0;
  v_count integer := 0;
  v_idx integer;
  v_mode text;
  v_locked_total bigint;
  v_locked_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not coalesce(public.is_admin(), false) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  if v_payment.school_year_id is null then
    raise exception 'Payment has no school year' using errcode = '23502';
  end if;

  v_left := case
    when v_payment.voided_at is null then v_payment.captured_amount
    else 0
  end;

  if p_allocations is null
    and exists (
      select 1 from public.payment_allocation_locks lock
      where lock.payment_id = p_payment_id
    ) then
    select coalesce(sum(allocation.amount), 0), count(*)
    into v_locked_total, v_locked_rows
    from public.payment_allocations allocation
    where allocation.payment_id = p_payment_id;

    if v_locked_rows > 0 and v_locked_total <= v_left then
      return v_locked_rows;
    end if;

    delete from public.payment_allocation_locks
    where payment_id = p_payment_id;
  end if;

  if p_allocations is not null then
    if jsonb_typeof(p_allocations) <> 'array' then
      raise exception 'Allocations must be a JSON array' using errcode = '22023';
    end if;

    for v_row in select value from jsonb_array_elements(p_allocations)
    loop
      begin
        if jsonb_typeof(v_row) <> 'object'
          or jsonb_typeof(v_row -> 'amount') <> 'number' then
          raise exception 'Invalid allocation';
        end if;
        v_target := (v_row ->> 'student_id')::uuid;
        v_share := (v_row ->> 'amount')::integer;
      exception when others then
        raise exception 'Invalid allocation row' using errcode = '22023';
      end;

      if v_share <= 0 then
        raise exception 'Allocation amount must be positive' using errcode = '22023';
      end if;
      if v_target = any(v_targets) then
        raise exception 'Duplicate allocation student' using errcode = '23505';
      end if;

      v_targets := array_append(v_targets, v_target);
      v_total := v_total + v_share;
    end loop;

    if v_total > v_left then
      raise exception 'Allocated amount exceeds captured amount' using errcode = '23514';
    end if;

    select count(*)
    into v_count
    from public.students
    where id = any(v_targets);

    if v_count <> cardinality(v_targets) then
      raise exception 'Allocation student not found' using errcode = '23503';
    end if;

    v_mode := 'manual';
  else
    select
      coalesce(array_agg(grouped.student_id), array[]::uuid[]),
      coalesce(array_agg(grouped.total), array[]::integer[])
    into v_targets, v_planned
    from (
      select i.student_id, sum(i.amount)::integer as total
      from public.installments i
      where i.payment_id = p_payment_id
      group by i.student_id
      order by i.student_id
    ) grouped;

    if cardinality(v_targets) = 0 then
      select
        coalesce(array_agg(t.student_id order by t.created_at, t.student_id), array[]::uuid[]),
        coalesce(array_agg(t.amount order by t.created_at, t.student_id), array[]::integer[])
      into v_targets, v_planned
      from public.payment_targets t
      where t.payment_id = p_payment_id;
    end if;

    if cardinality(v_targets) = 0 then
      v_planned := null;
      if v_payment.student_id is not null then
        v_targets := array[v_payment.student_id];
      else
        select coalesce(array_agg(s.id order by s.id), array[]::uuid[])
        into v_targets
        from public.students s
        where exists (
          select 1
          from public.student_applications a
          where a.id = s.application_id
            and a.payment_id = p_payment_id
        );
      end if;
    end if;

    v_mode := 'automatic';
  end if;

  foreach v_target in array v_targets
  loop
    insert into public.student_fees (
      student_id,
      school_year_id,
      amount
    )
    select
      v_target,
      v_payment.school_year_id,
      coalesce(e.price_snapshot, c.price, y.fee, 0) * 100
    from public.school_years y
    left join lateral (
      select enrollment.price_snapshot, enrollment.class_id
      from public.enrollments enrollment
      where enrollment.student_id = v_target
        and enrollment.school_year_id = v_payment.school_year_id
        and enrollment.status = 'aktiv'
      order by enrollment.created_at
      limit 1
    ) e on true
    left join public.classes c on c.id = e.class_id
    where y.id = v_payment.school_year_id
    on conflict (student_id, school_year_id) do nothing;
  end loop;

  delete from public.payment_allocations
  where payment_id = p_payment_id;

  if p_allocations is not null then
    insert into public.payment_allocations (
      payment_id,
      student_id,
      school_year_id,
      amount
    )
    select
      p_payment_id,
      (item ->> 'student_id')::uuid,
      v_payment.school_year_id,
      (item ->> 'amount')::integer
    from jsonb_array_elements(p_allocations) item;

    get diagnostics v_count = row_count;

    insert into public.payment_allocation_locks (payment_id, locked_by)
    values (p_payment_id, auth.jwt() ->> 'email')
    on conflict (payment_id) do update
      set locked_at = now(), locked_by = excluded.locked_by;
  elsif v_left > 0 and cardinality(v_targets) > 0 then
    for v_idx in 1..cardinality(v_targets)
    loop
      exit when v_left <= 0;
      v_target := v_targets[v_idx];

      select coalesce(balance.remaining, 0)
      into v_remaining
      from public.student_balances balance
      where balance.student_id = v_target
        and balance.school_year_id = v_payment.school_year_id;

      v_share := least(greatest(coalesce(v_remaining, 0), 0), v_left);

      if v_planned is not null then
        v_share := least(v_share, greatest(v_planned[v_idx], 0));
      end if;

      if v_share > 0 then
        insert into public.payment_allocations (
          payment_id,
          student_id,
          school_year_id,
          amount
        ) values (
          p_payment_id,
          v_target,
          v_payment.school_year_id,
          v_share
        );
        v_left := v_left - v_share;
        v_count := v_count + 1;
      end if;
    end loop;

    if v_left > 0 and v_planned is not null then
      foreach v_target in array v_targets
      loop
        exit when v_left <= 0;

        select coalesce(balance.remaining, 0)
        into v_remaining
        from public.student_balances balance
        where balance.student_id = v_target
          and balance.school_year_id = v_payment.school_year_id;

        v_share := least(greatest(coalesce(v_remaining, 0), 0), v_left);

        if v_share > 0 then
          insert into public.payment_allocations (
            payment_id,
            student_id,
            school_year_id,
            amount
          ) values (
            p_payment_id,
            v_target,
            v_payment.school_year_id,
            v_share
          )
          on conflict (payment_id, student_id)
          do update set amount = public.payment_allocations.amount + excluded.amount;

          v_left := v_left - v_share;
          v_count := v_count + 1;
        end if;
      end loop;
    end if;

    if v_left > 0 then
      insert into public.payment_allocations (
        payment_id,
        student_id,
        school_year_id,
        amount
      ) values (
        p_payment_id,
        v_targets[1],
        v_payment.school_year_id,
        v_left
      )
      on conflict (payment_id, student_id)
      do update set amount = public.payment_allocations.amount + excluded.amount;

      if v_count = 0 then
        v_count := 1;
      end if;
      v_left := 0;
    end if;
  end if;

  insert into public.audit_log (
    actor_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'payment.allocate',
    'payment',
    p_payment_id::text,
    jsonb_build_object(
      'mode', v_mode,
      'rows', v_count,
      'allocatedAmount', case
        when p_allocations is null then v_payment.captured_amount - v_left
        else v_total
      end,
      'netPaidAmount', v_payment.net_paid_amount
    )
  );

  return v_count;
end
$$;

revoke all on function public.replace_payment_allocations(uuid, jsonb) from public;
revoke all on function public.replace_payment_allocations(uuid, jsonb) from anon;
grant execute on function public.replace_payment_allocations(uuid, jsonb) to authenticated;
grant execute on function public.replace_payment_allocations(uuid, jsonb) to service_role;
