alter table public.student_applications
  drop column if exists child_name,
  drop column if exists child_age,
  drop column if exists guardian_name;

alter table public.students
  drop column if exists child_age,
  drop column if exists guardian_name;
