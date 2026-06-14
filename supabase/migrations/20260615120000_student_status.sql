alter table public.student_applications
  drop constraint if exists student_applications_status_check;

alter table public.student_applications
  add constraint student_applications_status_check
  check (status in ('ny', 'kontaktet', 'betaling', 'akseptert', 'arkivert'));
