drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select
  using (((select auth.uid()) = id) or (select public.is_admin()));

drop index if exists public.idx_student_applications_payment_id;
