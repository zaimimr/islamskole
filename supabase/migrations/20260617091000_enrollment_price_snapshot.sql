alter table public.enrollments
  add column if not exists price_snapshot int;

update public.enrollments e
  set price_snapshot = coalesce(c.price, sy.fee)
  from public.classes c, public.school_years sy
  where e.class_id = c.id
    and e.school_year_id = sy.id
    and e.price_snapshot is null;
