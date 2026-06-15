alter table public.classes
  add column if not exists price int;

update public.student_applications
  set status = 'akseptert'
  where status = 'betaling';

alter table public.student_applications
  drop constraint if exists student_applications_status_check;

alter table public.student_applications
  add constraint student_applications_status_check
  check (status in ('ny', 'kontaktet', 'akseptert', 'avslatt', 'arkivert'));
