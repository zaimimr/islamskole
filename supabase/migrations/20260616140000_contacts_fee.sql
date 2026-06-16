alter table public.school_years
  add column if not exists fee int;

alter table public.students
  add column if not exists guardian2_name text,
  add column if not exists guardian2_email text,
  add column if not exists guardian2_phone text,
  add column if not exists student_email text,
  add column if not exists student_phone text;
