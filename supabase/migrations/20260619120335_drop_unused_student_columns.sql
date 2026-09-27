alter table public.students
  drop column if exists full_name,
  drop column if exists guardian2_name,
  drop column if exists guardian2_email,
  drop column if exists guardian2_phone,
  drop column if exists student_email,
  drop column if exists student_phone;
