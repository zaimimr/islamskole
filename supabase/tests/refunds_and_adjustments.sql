begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(6);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  v_year uuid := gen_random_uuid();
  v_family uuid := gen_random_uuid();
  v_child_a uuid := gen_random_uuid();
  v_child_b uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
  v_paid_a bigint;
  v_paid_b bigint;
  v_refunded integer;
begin
  insert into public.school_years (id, label, fee)
  values (v_year, '2097/2098', 50);

  insert into public.families (id, display_name, origin)
  values (v_family, 'Refundfamilie', 'manual');

  insert into public.students (id, family_id, child_first_name, child_last_name)
  values
    (v_child_a, v_family, 'Barn', 'A'),
    (v_child_b, v_family, 'Barn', 'B');

  insert into public.student_fees (student_id, school_year_id, amount)
  values (v_child_a, v_year, 5000), (v_child_b, v_year, 5000);

  insert into public.payments (
    id, school_year_id, reference, amount, status, method,
    authorized_amount, captured_amount, refunded_amount
  ) values (
    v_payment, v_year, 'isk-refund-test', 10000, 'fanget', 'vipps',
    10000, 10000, 0
  );

  perform public.replace_payment_allocations(
    v_payment,
    jsonb_build_array(
      jsonb_build_object('student_id', v_child_a, 'amount', 5000),
      jsonb_build_object('student_id', v_child_b, 'amount', 5000)
    )
  );

  insert into public.refunds (payment_id, student_id, school_year_id, amount, method, reason, refunded_by)
  values (v_payment, v_child_a, v_year, 2000, 'vipps', 'Test delrefusjon', 'test');

  select refunded_amount into v_refunded
  from public.payments where id = v_payment;

  if v_refunded <> 2000 then
    raise exception 'Expected refunded_amount 2000, got %', v_refunded;
  end if;

  select paid into v_paid_a from public.student_balances
  where student_id = v_child_a and school_year_id = v_year;
  select paid into v_paid_b from public.student_balances
  where student_id = v_child_b and school_year_id = v_year;

  if v_paid_a <> 3000 then
    raise exception 'Expected child A paid 3000 after attributed refund, got %', v_paid_a;
  end if;
  if v_paid_b <> 5000 then
    raise exception 'Expected child B paid untouched at 5000, got %', v_paid_b;
  end if;
end $$;

select ok(true, 'attributed partial refund reduces only the refunded child');

do $$
declare
  v_payment uuid;
  v_blocked boolean := false;
begin
  select id into v_payment from public.payments where reference = 'isk-refund-test';

  begin
    insert into public.refunds (payment_id, amount, method, reason, refunded_by)
    values (v_payment, 9000, 'vipps', 'For mye', 'test');
  exception when check_violation then
    v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Expected over-refund to be blocked by refunded_amount check';
  end if;
end $$;

select ok(true, 'over-refund beyond captured amount is rejected');

do $$
declare
  v_year uuid;
  v_child uuid;
  v_owed bigint;
begin
  select school_year_id, student_id into v_year, v_child
  from public.student_fees
  limit 1;

  insert into public.student_fee_adjustments
    (student_id, school_year_id, type, amount, note, granted_by)
  values (v_child, v_year, 'soskenrabatt', 150000, 'Søskenrabatt test', 'test');

  select owed into v_owed from public.student_balances
  where student_id = v_child and school_year_id = v_year;

  if v_owed <> 0 then
    raise exception 'Expected owed 0 after 1500 kr adjustment on 50 kr fee, got %', v_owed;
  end if;

  update public.student_fee_adjustments
  set revoked_at = now(), revoked_by = 'test', revoke_reason = 'angret'
  where student_id = v_child and school_year_id = v_year;

  select owed into v_owed from public.student_balances
  where student_id = v_child and school_year_id = v_year;

  if v_owed <> 5000 then
    raise exception 'Expected owed restored to 5000 after revoke, got %', v_owed;
  end if;
end $$;

select ok(true, 'active adjustments reduce owed and revoked adjustments do not');

do $$
declare
  v_year uuid;
  v_child uuid;
  v_payment uuid := gen_random_uuid();
  v_paid bigint;
  v_count integer;
begin
  select school_year_id, student_id into v_year, v_child
  from public.student_fees
  offset 1 limit 1;

  insert into public.payments (
    id, student_id, school_year_id, reference, amount, status, method,
    authorized_amount, captured_amount, refunded_amount, paid_at, captured_at
  ) values (
    v_payment, v_child, v_year, 'sadaqa-' || gen_random_uuid(), 3000, 'fanget', 'sadaqa',
    3000, 3000, 0, now(), now()
  );

  perform public.replace_payment_allocations(v_payment, null);

  select count(*) into v_count
  from public.sadaqa_disbursements
  where payment_id = v_payment and student_id = v_child;

  if v_count <> 1 then
    raise exception 'Expected sadaqa disbursement row, got %', v_count;
  end if;
end $$;

select ok(true, 'sadaqa payments allocate and appear in sadaqa_disbursements');

do $$
declare
  v_year uuid := gen_random_uuid();
  v_family uuid := gen_random_uuid();
  v_child_a uuid := gen_random_uuid();
  v_child_b uuid := gen_random_uuid();
  v_plan uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
  v_alloc_a integer;
begin
  insert into public.school_years (id, label, fee)
  values (v_year, '2096/2097', 50);

  insert into public.families (id, display_name, origin)
  values (v_family, 'Avdragsfamilie', 'manual');

  insert into public.students (id, family_id, child_first_name, child_last_name)
  values
    (v_child_a, v_family, 'Avdrag', 'A'),
    (v_child_b, v_family, 'Avdrag', 'B');

  insert into public.student_fees (student_id, school_year_id, amount)
  values (v_child_a, v_year, 5000), (v_child_b, v_year, 5000);

  insert into public.payment_plans (id, family_id, school_year_id, plan_type, created_by)
  values (v_plan, v_family, v_year, 'semester', 'test');

  insert into public.payments (
    id, school_year_id, reference, amount, status, method,
    authorized_amount, captured_amount, refunded_amount
  ) values (
    v_payment, v_year, 'isk-installment-test', 6000, 'opprettet', 'vipps',
    0, 0, 0
  );

  insert into public.installments (plan_id, student_id, school_year_id, due_date, amount, status, payment_id, sent_at)
  values
    (v_plan, v_child_a, v_year, current_date, 3000, 'sendt', v_payment, now()),
    (v_plan, v_child_b, v_year, current_date, 3000, 'sendt', v_payment, now());

  update public.payments
  set status = 'fanget', authorized_amount = 6000, captured_amount = 6000
  where id = v_payment;

  perform public.replace_payment_allocations(v_payment, null);

  select amount into v_alloc_a
  from public.payment_allocations
  where payment_id = v_payment and student_id = v_child_a;

  if coalesce(v_alloc_a, 0) <> 3000 then
    raise exception 'Expected installment payment allocated 3000 to child A, got %', v_alloc_a;
  end if;

  if exists (
    select 1 from public.installments
    where payment_id = v_payment and status <> 'betalt'
  ) then
    raise exception 'Expected installments marked betalt after capture';
  end if;
end $$;

select ok(true, 'installment payments allocate to installment students and flip to betalt on capture');

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.teacher_gift_report;

  if v_count is null then
    raise exception 'teacher_gift_report view not queryable';
  end if;
end $$;

select ok(true, 'reporting views are queryable');

select finish();

rollback;
