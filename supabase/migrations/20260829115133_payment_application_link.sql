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
  alter column student_id drop not null;
