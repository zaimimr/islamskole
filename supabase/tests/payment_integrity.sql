begin;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  v_year uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
  v_manual uuid := gen_random_uuid();
  v_paid bigint;
  v_rows integer;
begin
  insert into public.school_years (id, label, fee)
  values (v_year, '2098/2099', 100);

  insert into public.students (
    id,
    child_first_name,
    child_last_name
  ) values (
    v_student,
    'Payment Integrity',
    'Student'
  );

  insert into public.student_fees (
    student_id,
    school_year_id,
    amount
  ) values (
    v_student,
    v_year,
    10000
  );

  insert into public.payments (
    id,
    student_id,
    school_year_id,
    reference,
    amount,
    status,
    method,
    authorized_amount,
    captured_amount,
    refunded_amount
  ) values (
    v_payment,
    v_student,
    v_year,
    'isk-integrity-2099',
    10000,
    'fanget',
    'vipps',
    10000,
    10000,
    0
  );

  select public.replace_payment_allocations(v_payment, null)
  into v_rows;

  if v_rows <> 1 then
    raise exception 'Expected one automatic allocation row';
  end if;

  select paid
  into v_paid
  from public.student_balances
  where student_id = v_student
    and school_year_id = v_year;

  if v_paid <> 10000 then
    raise exception 'Expected full captured balance';
  end if;

  update public.payments
  set refunded_amount = 2500
  where id = v_payment;

  perform public.replace_payment_allocations(v_payment, null);

  select paid
  into v_paid
  from public.student_balances
  where student_id = v_student
    and school_year_id = v_year;

  if v_paid <> 7500 then
    raise exception 'Expected partial refund to reduce paid balance';
  end if;

  begin
    perform public.replace_payment_allocations(
      v_payment,
      jsonb_build_array(
        jsonb_build_object('student_id', v_student, 'amount', 8000)
      )
    );
    raise exception 'Expected over-allocation to fail';
  exception when check_violation then
    null;
  end;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payment_allocations
  where payment_id = v_payment;

  if v_paid <> 7500 then
    raise exception 'Failed replacement changed existing allocations';
  end if;

  begin
    delete from public.payments where id = v_payment;
    raise exception 'Expected captured Vipps deletion to fail';
  exception when foreign_key_violation then
    null;
  end;

  begin
    update public.payments
    set voided_at = now()
    where id = v_payment;
    raise exception 'Expected captured Vipps void to fail';
  exception when check_violation then
    null;
  end;

  update public.payments
  set
    status = 'refundert',
    refunded_amount = 10000
  where id = v_payment;

  perform public.replace_payment_allocations(v_payment, null);

  select paid
  into v_paid
  from public.student_balances
  where student_id = v_student
    and school_year_id = v_year;

  if v_paid <> 0 then
    raise exception 'Expected full refund to clear paid balance';
  end if;

  insert into public.payments (
    id,
    student_id,
    school_year_id,
    reference,
    amount,
    status,
    method,
    authorized_amount,
    captured_amount,
    refunded_amount
  ) values (
    v_manual,
    v_student,
    v_year,
    'manual-integrity-2099',
    1000,
    'fanget',
    'vipps',
    1000,
    1000,
    0
  );

  update public.payments
  set voided_at = now()
  where id = v_manual;

  if not exists (
    select 1
    from public.audit_log
    where entity_type = 'payment'
      and entity_id = v_payment::text
  ) then
    raise exception 'Expected payment mutation audit records';
  end if;
end
$$;

rollback;
