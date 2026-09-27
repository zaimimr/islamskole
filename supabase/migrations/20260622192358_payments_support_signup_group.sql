alter table payments alter column student_id drop not null;

alter table student_applications
  add column if not exists payment_id uuid references payments(id) on delete set null;

create index if not exists idx_student_applications_payment_id
  on student_applications(payment_id);
