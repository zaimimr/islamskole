alter table public.guardians
  add column if not exists is_teacher boolean not null default false,
  add column if not exists is_volunteer boolean not null default false,
  add column if not exists teacher_note text,
  add column if not exists source_application_id uuid references public.teacher_applications(id) on delete set null;

create index if not exists guardians_is_teacher_idx
  on public.guardians (is_teacher)
  where is_teacher;

create index if not exists guardians_is_volunteer_idx
  on public.guardians (is_volunteer)
  where is_volunteer;

create index if not exists guardians_source_application_idx
  on public.guardians (source_application_id)
  where source_application_id is not null;
