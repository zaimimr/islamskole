create or replace function public.portal_my_economy()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_year as (
    select sy.id, sy.label
    from public.school_years sy
    where sy.is_active
    order by sy.starts_on desc nulls last
    limit 1
  ),
  my_families as (
    select f.id, f.display_name
    from public.families f
    where f.id in (select public.portal_my_family_ids())
  ),
  family_students as (
    select s.id, s.family_id, concat_ws(' ', s.child_first_name, s.child_last_name) as name
    from public.students s
    where s.family_id in (select id from my_families)
  ),
  family_payments as (
    select distinct fs.family_id, p.id
    from public.payments p
    join active_year ay on ay.id = p.school_year_id
    join family_students fs on fs.id = p.student_id
      or exists (select 1 from public.payment_targets t where t.payment_id = p.id and t.student_id = fs.id)
      or exists (select 1 from public.payment_allocations a where a.payment_id = p.id and a.student_id = fs.id)
      or exists (select 1 from public.installments i where i.payment_id = p.id and i.student_id = fs.id)
    where p.voided_at is null
      and p.status in ('autorisert', 'fanget', 'refundert')
  ),
  installment_groups as (
    select
      fs.family_id,
      (array_agg(i.id order by i.id))[1] as id,
      i.due_date,
      i.status,
      i.payment_id,
      sum(i.amount)::integer as amount,
      jsonb_agg(fs.name order by fs.name) as children
    from public.installments i
    join active_year ay on ay.id = i.school_year_id
    join family_students fs on fs.id = i.student_id
    where i.status in ('planlagt', 'sendt', 'betalt')
    group by fs.family_id, i.due_date, i.status, i.payment_id
  )
  select coalesce(jsonb_agg(family_row order by family_row ->> 'display_name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'family_id', f.id,
      'display_name', f.display_name,
      'school_year_id', (select id from active_year),
      'school_year_label', (select label from active_year),
      'children', coalesce((
        select jsonb_agg(jsonb_build_object(
          'student_id', fs.id,
          'name', fs.name,
          'owed', b.owed,
          'paid', b.paid,
          'remaining', b.remaining
        ) order by fs.name)
        from family_students fs
        join public.student_balances b on b.student_id = fs.id
        join active_year ay on ay.id = b.school_year_id
        where fs.family_id = f.id
      ), '[]'::jsonb),
      'total_remaining', coalesce((
        select sum(b.remaining)::integer
        from family_students fs
        join public.student_balances b on b.student_id = fs.id
        join active_year ay on ay.id = b.school_year_id
        where fs.family_id = f.id
      ), 0),
      'installments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', g.id,
          'due_date', g.due_date,
          'amount', g.amount,
          'status', g.status,
          'payment_id', g.payment_id,
          'children', g.children
        ) order by (g.status = 'betalt'), case when g.status = 'betalt' then null else g.due_date end, g.due_date desc)
        from installment_groups g
        where g.family_id = f.id
      ), '[]'::jsonb),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'created_at', p.created_at,
          'paid_at', coalesce(p.paid_at, p.captured_at),
          'amount', coalesce(nullif(p.captured_amount, 0), p.amount),
          'refunded_amount', p.refunded_amount,
          'method', p.method,
          'status', p.status,
          'children', coalesce((
            select jsonb_agg(jsonb_build_object('name', fs.name, 'amount', a.amount) order by fs.name)
            from public.payment_allocations a
            join family_students fs on fs.id = a.student_id and fs.family_id = f.id
            where a.payment_id = p.id
          ), '[]'::jsonb)
        ) order by coalesce(p.paid_at, p.captured_at, p.created_at) desc)
        from family_payments fp
        join public.payments p on p.id = fp.id
        where fp.family_id = f.id
      ), '[]'::jsonb)
    ) as family_row
    from my_families f
  ) rows;
$$;

revoke all on function public.portal_my_economy() from public, anon;
grant execute on function public.portal_my_economy() to authenticated;
