alter table public.student_applications
  add column if not exists birth_date date;
