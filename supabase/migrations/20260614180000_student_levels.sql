alter table public.student_applications
  add column if not exists level_quran text,
  add column if not exists level_arabic text,
  add column if not exists level_islam text;
