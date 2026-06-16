create index if not exists payments_status_idx on public.payments (status);
create index if not exists enrollments_status_idx on public.enrollments (status);
create index if not exists student_applications_status_created_idx
  on public.student_applications (status, created_at desc);
create index if not exists teacher_applications_status_created_idx
  on public.teacher_applications (status, created_at desc);
create index if not exists students_created_idx on public.students (created_at desc);
