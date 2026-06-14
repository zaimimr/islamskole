create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_no text not null,
  name_en text not null,
  age_min int,
  age_max int,
  capacity int,
  description_no text,
  description_en text,
  curriculum_no text,
  curriculum_en text,
  image_url text,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_no text not null,
  title_en text not null,
  excerpt_no text,
  excerpt_en text,
  body_no text,
  body_en text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_starts_at_idx on public.events (starts_at);

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create table public.info_blocks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title_no text,
  title_en text,
  body_no text,
  body_en text,
  image_url text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger info_blocks_updated_at
  before update on public.info_blocks
  for each row execute function public.set_updated_at();

create table public.site_settings (
  id boolean primary key default true check (id),
  contact_email text,
  enroll_email text,
  address text,
  hours text,
  facebook_url text,
  instagram_url text,
  updated_at timestamptz not null default now()
);

create trigger site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (id, contact_email, enroll_email, address, hours)
values (true, 'baerum@islamskole.no', 'opptak@islamskole.no', 'Skuiveien 40, 1339 Vøyenenga', 'Søndager 10:00–14:00')
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.events enable row level security;
alter table public.info_blocks enable row level security;
alter table public.site_settings enable row level security;

create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

create policy "classes public read" on public.classes
  for select using (published or public.is_admin());
create policy "classes admin write" on public.classes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "events public read" on public.events
  for select using (published or public.is_admin());
create policy "events admin write" on public.events
  for all using (public.is_admin()) with check (public.is_admin());

create policy "info public read" on public.info_blocks
  for select using (true);
create policy "info admin write" on public.info_blocks
  for all using (public.is_admin()) with check (public.is_admin());

create policy "settings public read" on public.site_settings
  for select using (true);
create policy "settings admin write" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');
create policy "media admin insert" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_admin());
create policy "media admin update" on storage.objects
  for update using (bucket_id = 'media' and public.is_admin());
create policy "media admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());
