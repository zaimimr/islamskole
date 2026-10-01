drop function if exists public.sms_login_lookup(text);
drop function if exists public.sms_login_issue(text, text, integer, uuid);
drop function if exists public.sms_login_verify(text, text, integer, uuid);
drop function if exists public.sms_login_link_phone(uuid, text, text, integer);
drop function if exists public.sms_login_issue(text, text, integer);
drop function if exists public.sms_login_verify(text, text, integer);
drop function if exists public.normalize_no_mobile(text);
drop table if exists public.sms_login_codes;
drop table if exists public.sms_login_phones;
