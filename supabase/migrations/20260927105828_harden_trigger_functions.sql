alter function public.set_updated_at() set search_path = '';

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.maintain_payment_refunded_amount() from public, anon, authenticated;
revoke all on function public.sync_installments_with_payment() from public, anon, authenticated;
revoke all on function public.audit_payment_integrity() from public, anon, authenticated;
revoke all on function public.propagate_family_guardian() from public, anon, authenticated;
revoke all on function public.sync_student_family_guardians() from public, anon, authenticated;
revoke all on function public.protect_captured_vipps_payment() from public, anon, authenticated;
