alter table public.student_applications
  add column if not exists payment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_applications_payment_id_fkey'
      and conrelid = 'public.student_applications'::regclass
  ) then
    alter table public.student_applications
      add constraint student_applications_payment_id_fkey
      foreign key (payment_id) references public.payments (id) on delete set null;
  end if;
end
$$;

create index if not exists student_applications_payment_idx
  on public.student_applications (payment_id);

alter table public.payments
  alter column student_id drop not null,
  add column if not exists authorized_amount integer not null default 0,
  add column if not exists captured_amount integer not null default 0,
  add column if not exists refunded_amount integer not null default 0;

update public.payments
set
  authorized_amount = case
    when status in ('autorisert', 'fanget', 'refundert') then amount
    else 0
  end,
  captured_amount = case
    when status in ('fanget', 'refundert') then amount
    else 0
  end,
  refunded_amount = case
    when status = 'refundert' then amount
    else 0
  end
where authorized_amount = 0
  and captured_amount = 0
  and refunded_amount = 0;

alter table public.payments
  add column if not exists net_paid_amount integer
  generated always as (greatest(captured_amount - refunded_amount, 0)) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_authorized_amount_nonnegative'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_authorized_amount_nonnegative
      check (authorized_amount >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_captured_amount_nonnegative'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_captured_amount_nonnegative
      check (captured_amount >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_refunded_amount_valid'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_refunded_amount_valid
      check (refunded_amount >= 0 and refunded_amount <= captured_amount) not valid;
  end if;
end
$$;

alter table public.payments
  validate constraint payments_authorized_amount_nonnegative;
alter table public.payments
  validate constraint payments_captured_amount_nonnegative;
alter table public.payments
  validate constraint payments_refunded_amount_valid;

create or replace function public.audit_payment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_entity_id text;
  v_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'payment.create';
    v_entity_id := new.id::text;
    v_metadata := jsonb_build_object(
      'status', new.status,
      'amount', new.amount,
      'authorizedAmount', new.authorized_amount,
      'capturedAmount', new.captured_amount,
      'refundedAmount', new.refunded_amount,
      'method', new.method
    );
  elsif tg_op = 'DELETE' then
    v_action := 'payment.delete';
    v_entity_id := old.id::text;
    v_metadata := jsonb_build_object(
      'status', old.status,
      'amount', old.amount,
      'authorizedAmount', old.authorized_amount,
      'capturedAmount', old.captured_amount,
      'refundedAmount', old.refunded_amount,
      'method', old.method
    );
  else
    if not (
      old.status is distinct from new.status
      or old.amount is distinct from new.amount
      or old.authorized_amount is distinct from new.authorized_amount
      or old.captured_amount is distinct from new.captured_amount
      or old.refunded_amount is distinct from new.refunded_amount
      or old.method is distinct from new.method
      or old.reference is distinct from new.reference
      or old.psp_reference is distinct from new.psp_reference
      or old.student_id is distinct from new.student_id
      or old.school_year_id is distinct from new.school_year_id
      or old.voided_at is distinct from new.voided_at
      or old.void_reason is distinct from new.void_reason
      or old.duplicate_of_payment_id is distinct from new.duplicate_of_payment_id
    ) then
      return new;
    end if;

    v_action := 'payment.mutate';
    v_entity_id := new.id::text;
    v_metadata := jsonb_build_object(
      'previousStatus', old.status,
      'status', new.status,
      'previousAuthorizedAmount', old.authorized_amount,
      'authorizedAmount', new.authorized_amount,
      'previousCapturedAmount', old.captured_amount,
      'capturedAmount', new.captured_amount,
      'previousRefundedAmount', old.refunded_amount,
      'refundedAmount', new.refunded_amount,
      'voided', new.voided_at is not null,
      'duplicateOfPaymentId', new.duplicate_of_payment_id
    );
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
    v_action,
    'payment',
    v_entity_id,
    v_metadata
  );

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function public.audit_payment_integrity() from public;

drop trigger if exists payments_integrity_audit on public.payments;
create trigger payments_integrity_audit
  after insert or update or delete on public.payments
  for each row execute function public.audit_payment_integrity();

create or replace function public.protect_captured_vipps_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.method = 'vipps'
      and old.reference not like 'manual-%'
      and (old.captured_amount > 0 or old.status in ('fanget', 'refundert')) then
      raise exception 'Captured Vipps payments cannot be deleted'
        using errcode = '23503';
    end if;
    return old;
  end if;

  if old.voided_at is null
    and new.voided_at is not null
    and old.method = 'vipps'
    and old.reference not like 'manual-%'
    and (old.captured_amount > 0 or old.status in ('fanget', 'refundert')) then
    raise exception 'Captured Vipps payments cannot be voided locally'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists payments_protect_captured_vipps on public.payments;
create trigger payments_protect_captured_vipps
  before update of voided_at or delete on public.payments
  for each row execute function public.protect_captured_vipps_payment();

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
  v_target uuid;
  v_row jsonb;
  v_share integer;
  v_remaining integer;
  v_left integer;
  v_total bigint := 0;
  v_count integer := 0;
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
        );
        v_left := v_left - v_share;
        v_count := v_count + 1;
      end if;
    end loop;

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

revoke all on function public.replace_payment_allocations(uuid, jsonb) from public;
revoke all on function public.replace_payment_allocations(uuid, jsonb) from anon;
grant execute on function public.replace_payment_allocations(uuid, jsonb) to authenticated;
grant execute on function public.replace_payment_allocations(uuid, jsonb) to service_role;

create or replace view public.student_balances
with (security_invoker = true) as
with effective_allocations as (
  select
    allocation.student_id,
    allocation.school_year_id,
    greatest(
      least(
        allocation.amount::bigint,
        greatest(
          case
            when payment.voided_at is null then payment.net_paid_amount::bigint
            else 0::bigint
          end - coalesce(
            sum(allocation.amount) over (
              partition by allocation.payment_id
              order by allocation.created_at, allocation.id
              rows between unbounded preceding and 1 preceding
            ),
            0
          ),
          0
        )
      ),
      0
    )::integer as amount
  from public.payment_allocations allocation
  join public.payments payment on payment.id = allocation.payment_id
)
select
  fee.student_id,
  fee.school_year_id,
  greatest(fee.amount - fee.discount, 0) as owed,
  coalesce(settled.total, 0) as paid,
  greatest(
    greatest(fee.amount - fee.discount, 0) - coalesce(settled.total, 0),
    0
  ) as remaining,
  case
    when greatest(fee.amount - fee.discount, 0) = 0 then 'betalt'
    when coalesce(settled.total, 0) >= greatest(fee.amount - fee.discount, 0) then 'betalt'
    when coalesce(settled.total, 0) > 0 then 'delvis'
    else 'ubetalt'
  end as state
from public.student_fees fee
left join (
  select
    student_id,
    school_year_id,
    sum(amount) as total
  from effective_allocations
  group by student_id, school_year_id
) settled
  on settled.student_id = fee.student_id
  and settled.school_year_id = fee.school_year_id;
