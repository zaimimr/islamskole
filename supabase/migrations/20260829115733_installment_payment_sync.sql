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
    when v_payment.voided_at is null then v_payment.net_paid_amount
    else 0
  end;

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
      raise exception 'Allocated amount exceeds net paid amount' using errcode = '23514';
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
        when p_allocations is null then v_payment.net_paid_amount - v_left
        else v_total
      end,
      'netPaidAmount', v_payment.net_paid_amount
    )
  );

  return v_count;
end
$$;

create or replace function public.sync_installments_with_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'fanget' and old.status is distinct from 'fanget' then
    update public.installments
    set status = 'betalt'
    where payment_id = new.id
      and status in ('planlagt', 'sendt');
  elsif new.status in ('avbrutt', 'feilet')
    and old.status not in ('avbrutt', 'feilet') then
    update public.installments
    set status = 'planlagt', payment_id = null
    where payment_id = new.id
      and status = 'sendt';
  end if;

  return new;
end
$$;

drop trigger if exists payments_sync_installments on public.payments;
create trigger payments_sync_installments
  after update of status on public.payments
  for each row execute function public.sync_installments_with_payment();
