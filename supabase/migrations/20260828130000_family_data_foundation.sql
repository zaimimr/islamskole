create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  address text,
  postal_code text,
  city text,
  origin text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint families_display_name_check
    check (display_name is null or btrim(display_name) <> ''),
  constraint families_origin_check
    check (btrim(origin) <> '')
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardians_identity_check check (
    coalesce(
      nullif(btrim(first_name), ''),
      nullif(btrim(last_name), ''),
      nullif(btrim(email), ''),
      nullif(btrim(phone), '')
    ) is not null
  )
);

create table if not exists public.family_guardians (
  family_id uuid not null references public.families (id) on delete cascade,
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  relationship_label text not null default 'guardian',
  is_primary_contact boolean not null default false,
  is_billing_contact boolean not null default false,
  receives_communication boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, guardian_id),
  constraint family_guardians_relationship_check
    check (btrim(relationship_label) <> ''),
  constraint family_guardians_sort_order_check
    check (sort_order >= 0)
);

alter table public.students
  add column if not exists family_id uuid;

alter table public.student_applications
  add column if not exists family_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_family_id_fkey'
  ) then
    alter table public.students
      add constraint students_family_id_fkey
      foreign key (family_id) references public.families (id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_applications'::regclass
      and conname = 'student_applications_family_id_fkey'
  ) then
    alter table public.student_applications
      add constraint student_applications_family_id_fkey
      foreign key (family_id) references public.families (id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_id_family_id_key'
  ) then
    alter table public.students
      add constraint students_id_family_id_key unique (id, family_id);
  end if;
end;
$$;

create table if not exists public.student_guardians (
  student_id uuid not null,
  family_id uuid not null,
  guardian_id uuid not null,
  relationship_label text not null default 'guardian',
  is_primary boolean not null default false,
  has_legal_guardianship boolean not null default true,
  can_pick_up boolean not null default true,
  receives_communication boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, guardian_id),
  constraint student_guardians_student_family_fkey
    foreign key (student_id, family_id)
    references public.students (id, family_id)
    on update cascade
    on delete cascade,
  constraint student_guardians_family_guardian_fkey
    foreign key (family_id, guardian_id)
    references public.family_guardians (family_id, guardian_id)
    on update cascade
    on delete cascade,
  constraint student_guardians_relationship_check
    check (btrim(relationship_label) <> ''),
  constraint student_guardians_sort_order_check
    check (sort_order >= 0)
);

create table if not exists public.family_data_reviews (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  category text not null,
  source_entity text,
  source_entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_data_reviews_category_check check (
    category in (
      'legacy_address_conflict',
      'legacy_guardian_conflict',
      'possible_duplicate_family',
      'shared_payment_family_conflict'
    )
  ),
  constraint family_data_reviews_source_check check (
    source_entity is null
    or source_entity in ('family', 'student', 'student_application')
  ),
  constraint family_data_reviews_status_check
    check (status in ('open', 'resolved', 'dismissed')),
  constraint family_data_reviews_resolution_check check (
    (status = 'open' and resolved_at is null and resolved_by is null)
    or (status in ('resolved', 'dismissed') and resolved_at is not null)
  )
);

create index if not exists students_family_id_idx
  on public.students (family_id)
  where family_id is not null;
create index if not exists student_applications_family_id_idx
  on public.student_applications (family_id)
  where family_id is not null;
create index if not exists guardians_email_normalized_idx
  on public.guardians (lower(btrim(email)))
  where nullif(btrim(email), '') is not null;
create index if not exists guardians_phone_normalized_idx
  on public.guardians (regexp_replace(phone, '[^0-9+]', '', 'g'))
  where nullif(btrim(phone), '') is not null;
create index if not exists family_guardians_guardian_id_idx
  on public.family_guardians (guardian_id);
create unique index if not exists family_guardians_one_primary_idx
  on public.family_guardians (family_id)
  where is_primary_contact;
create index if not exists student_guardians_family_id_idx
  on public.student_guardians (family_id);
create index if not exists student_guardians_guardian_id_idx
  on public.student_guardians (guardian_id);
create unique index if not exists student_guardians_one_primary_idx
  on public.student_guardians (student_id)
  where is_primary;
create index if not exists family_data_reviews_open_idx
  on public.family_data_reviews (family_id, created_at desc)
  where status = 'open';
create unique index if not exists family_data_reviews_open_unique_idx
  on public.family_data_reviews (
    family_id,
    category,
    coalesce(source_entity, ''),
    coalesce(source_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'open';

drop trigger if exists families_updated_at on public.families;
create trigger families_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

drop trigger if exists guardians_updated_at on public.guardians;
create trigger guardians_updated_at
  before update on public.guardians
  for each row execute function public.set_updated_at();

drop trigger if exists family_guardians_updated_at on public.family_guardians;
create trigger family_guardians_updated_at
  before update on public.family_guardians
  for each row execute function public.set_updated_at();

drop trigger if exists student_guardians_updated_at on public.student_guardians;
create trigger student_guardians_updated_at
  before update on public.student_guardians
  for each row execute function public.set_updated_at();

drop trigger if exists family_data_reviews_updated_at on public.family_data_reviews;
create trigger family_data_reviews_updated_at
  before update on public.family_data_reviews
  for each row execute function public.set_updated_at();

alter table public.families enable row level security;
alter table public.guardians enable row level security;
alter table public.family_guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.family_data_reviews enable row level security;

drop policy if exists "families admin all" on public.families;
create policy "families admin all" on public.families
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "guardians admin all" on public.guardians;
create policy "guardians admin all" on public.guardians
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "family guardians admin all" on public.family_guardians;
create policy "family guardians admin all" on public.family_guardians
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student guardians admin all" on public.student_guardians;
create policy "student guardians admin all" on public.student_guardians
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "family data reviews admin all" on public.family_data_reviews;
create policy "family data reviews admin all" on public.family_data_reviews
  for all using (public.is_admin()) with check (public.is_admin());

create temporary table family_payment_backfill on commit drop as
with application_source as (
  select
    sa.id as application_id,
    sa.family_id,
    nullif(btrim(to_jsonb(sa) ->> 'payment_id'), '') as payment_key
  from public.student_applications sa
),
payment_groups as (
  select
    payment_key,
    (array_agg(family_id order by application_id) filter (where family_id is not null))[1]
      as existing_family_id
  from application_source
  where payment_key is not null
  group by payment_key
)
select
  payment_key,
  coalesce(existing_family_id, gen_random_uuid()) as family_id
from payment_groups;

create temporary table family_application_backfill on commit drop as
with application_source as (
  select
    sa.id as application_id,
    sa.family_id,
    nullif(btrim(to_jsonb(sa) ->> 'payment_id'), '') as payment_key
  from public.student_applications sa
)
select
  source.application_id,
  coalesce(source.family_id, payment.family_id, gen_random_uuid()) as family_id,
  source.payment_key
from application_source source
left join family_payment_backfill payment
  on payment.payment_key = source.payment_key;

insert into public.families (id, origin)
select distinct
  family_id,
  case
    when payment_key is not null then 'legacy_shared_payment'
    else 'legacy_application'
  end
from family_application_backfill
on conflict (id) do nothing;

update public.student_applications application
set family_id = backfill.family_id
from family_application_backfill backfill
where application.id = backfill.application_id
  and application.family_id is null;

update public.students student
set family_id = application.family_id
from public.student_applications application
where student.application_id = application.id
  and student.family_id is null
  and application.family_id is not null;

create temporary table family_student_backfill on commit drop as
select
  student.id as student_id,
  gen_random_uuid() as family_id
from public.students student
where student.family_id is null;

insert into public.families (id, origin)
select family_id, 'legacy_student'
from family_student_backfill
on conflict (id) do nothing;

update public.students student
set family_id = backfill.family_id
from family_student_backfill backfill
where student.id = backfill.student_id
  and student.family_id is null;

insert into public.family_data_reviews (
  family_id,
  category,
  source_entity,
  source_entity_id,
  details
)
with payment_families as (
  select
    nullif(btrim(to_jsonb(application) ->> 'payment_id'), '') as payment_key,
    application.family_id
  from public.student_applications application
  where application.family_id is not null
),
conflicts as (
  select
    payment_key,
    array_agg(distinct family_id order by family_id) as family_ids
  from payment_families
  where payment_key is not null
  group by payment_key
  having count(distinct family_id) > 1
)
select
  family_id,
  'shared_payment_family_conflict',
  'family',
  family_id,
  jsonb_build_object('candidateFamilyIds', to_jsonb(conflicts.family_ids))
from conflicts
cross join lateral unnest(conflicts.family_ids) as family_id
on conflict do nothing;

create temporary table family_address_backfill_source on commit drop as
with records as (
  select
    'student_application'::text as source_entity,
    application.id as source_id,
    application.family_id,
    to_jsonb(application) as data
  from public.student_applications application
  where application.family_id is not null
  union all
  select
    'student'::text,
    student.id,
    student.family_id,
    to_jsonb(student)
  from public.students student
  where student.family_id is not null
),
addresses as (
  select
    source_entity,
    source_id,
    family_id,
    coalesce(
      nullif(btrim(data ->> 'child_address'), ''),
      nullif(btrim(data ->> 'address'), '')
    ) as address,
    coalesce(
      nullif(btrim(data ->> 'child_postal_code'), ''),
      nullif(btrim(data ->> 'postal_code'), '')
    ) as postal_code,
    coalesce(
      nullif(btrim(data ->> 'child_city'), ''),
      nullif(btrim(data ->> 'city'), '')
    ) as city
  from records
)
select
  source_entity,
  source_id,
  family_id,
  address,
  postal_code,
  city,
  concat_ws(
    '|',
    lower(regexp_replace(coalesce(address, ''), '\s+', ' ', 'g')),
    lower(regexp_replace(coalesce(postal_code, ''), '\s+', '', 'g')),
    lower(regexp_replace(coalesce(city, ''), '\s+', ' ', 'g'))
  ) as normalized_key
from addresses
where coalesce(address, postal_code, city) is not null;

with unambiguous as (
  select
    family_id,
    (array_agg(address order by source_entity, source_id) filter (where address is not null))[1]
      as address,
    (array_agg(postal_code order by source_entity, source_id) filter (where postal_code is not null))[1]
      as postal_code,
    (array_agg(city order by source_entity, source_id) filter (where city is not null))[1]
      as city
  from family_address_backfill_source
  group by family_id
  having count(distinct normalized_key) = 1
)
update public.families family
set
  address = coalesce(family.address, unambiguous.address),
  postal_code = coalesce(family.postal_code, unambiguous.postal_code),
  city = coalesce(family.city, unambiguous.city)
from unambiguous
where family.id = unambiguous.family_id;

insert into public.family_data_reviews (
  family_id,
  category,
  source_entity,
  source_entity_id,
  details
)
select
  family_id,
  'legacy_address_conflict',
  'family',
  family_id,
  jsonb_build_object(
    'variantCount', count(distinct normalized_key),
    'sourceCount', count(*)
  )
from family_address_backfill_source
group by family_id
having count(distinct normalized_key) > 1
on conflict do nothing;

create temporary table family_guardian_backfill_source on commit drop as
with records as (
  select
    'student_application'::text as source_entity,
    application.id as source_id,
    application.family_id,
    to_jsonb(application) as data
  from public.student_applications application
  where application.family_id is not null
  union all
  select
    'student'::text,
    student.id,
    student.family_id,
    to_jsonb(student)
  from public.students student
  where student.family_id is not null
),
canonical_candidates as (
  select
    source_entity,
    source_id,
    family_id,
    'mother'::text as relationship_label,
    nullif(btrim(data ->> 'mother_first_name'), '') as first_name,
    nullif(btrim(data ->> 'mother_last_name'), '') as last_name,
    nullif(btrim(data ->> 'mother_email'), '') as email,
    nullif(btrim(data ->> 'mother_phone'), '') as phone
  from records
  union all
  select
    source_entity,
    source_id,
    family_id,
    'father',
    nullif(btrim(data ->> 'father_first_name'), ''),
    nullif(btrim(data ->> 'father_last_name'), ''),
    nullif(btrim(data ->> 'father_email'), ''),
    nullif(btrim(data ->> 'father_phone'), '')
  from records
),
records_without_canonical_guardians as (
  select records.*
  from records
  where not exists (
    select 1
    from canonical_candidates candidate
    where candidate.source_entity = records.source_entity
      and candidate.source_id = records.source_id
      and coalesce(
        candidate.first_name,
        candidate.last_name,
        candidate.email,
        candidate.phone
      ) is not null
  )
),
legacy_primary_candidates as (
  select
    source_entity,
    source_id,
    family_id,
    'guardian'::text as relationship_label,
    nullif(btrim(data ->> 'guardian_name'), '') as first_name,
    null::text as last_name,
    nullif(btrim(data ->> 'email'), '') as email,
    nullif(btrim(data ->> 'phone'), '') as phone
  from records_without_canonical_guardians
),
legacy_secondary_candidates as (
  select
    source_entity,
    source_id,
    family_id,
    'guardian_2',
    nullif(btrim(data ->> 'guardian2_name'), ''),
    null::text,
    nullif(btrim(data ->> 'guardian2_email'), ''),
    nullif(btrim(data ->> 'guardian2_phone'), '')
  from records
),
legacy_candidates as (
  select * from legacy_primary_candidates
  union all
  select * from legacy_secondary_candidates
),
all_candidates as (
  select * from canonical_candidates
  union all
  select * from legacy_candidates
),
present_candidates as (
  select *
  from all_candidates
  where coalesce(first_name, last_name, email, phone) is not null
)
select
  source_entity,
  source_id,
  family_id,
  relationship_label,
  first_name,
  last_name,
  email,
  phone,
  encode(
    digest(
      concat_ws(
        '|',
        relationship_label,
        lower(regexp_replace(coalesce(first_name, ''), '\s+', ' ', 'g')),
        lower(regexp_replace(coalesce(last_name, ''), '\s+', ' ', 'g')),
        lower(btrim(coalesce(email, ''))),
        regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g')
      ),
      'sha256'
    ),
    'hex'
  ) as fingerprint
from present_candidates;

create temporary table family_guardian_backfill_map on commit drop as
select
  family_id,
  fingerprint,
  gen_random_uuid() as guardian_id,
  (array_agg(first_name order by source_entity, source_id) filter (where first_name is not null))[1]
    as first_name,
  (array_agg(last_name order by source_entity, source_id) filter (where last_name is not null))[1]
    as last_name,
  (array_agg(email order by source_entity, source_id) filter (where email is not null))[1]
    as email,
  (array_agg(phone order by source_entity, source_id) filter (where phone is not null))[1]
    as phone,
  min(relationship_label) as relationship_label
from family_guardian_backfill_source
group by family_id, fingerprint;

insert into public.guardians (
  id,
  first_name,
  last_name,
  email,
  phone
)
select
  guardian_id,
  first_name,
  last_name,
  email,
  phone
from family_guardian_backfill_map
on conflict (id) do nothing;

insert into public.family_guardians (
  family_id,
  guardian_id,
  relationship_label,
  receives_communication,
  sort_order
)
select
  family_id,
  guardian_id,
  relationship_label,
  coalesce(email, phone) is not null,
  case relationship_label
    when 'mother' then 0
    when 'father' then 1
    else 2
  end
from family_guardian_backfill_map
on conflict (family_id, guardian_id) do nothing;

with students_with_direct_guardians as (
  select distinct source_id as student_id
  from family_guardian_backfill_source
  where source_entity = 'student'
),
student_sources as (
  select
    source.source_id as student_id,
    source.family_id,
    source.fingerprint,
    source.relationship_label,
    source.email,
    source.phone
  from family_guardian_backfill_source source
  where source.source_entity = 'student'
  union all
  select
    student.id,
    source.family_id,
    source.fingerprint,
    source.relationship_label,
    source.email,
    source.phone
  from family_guardian_backfill_source source
  join public.students student
    on student.application_id = source.source_id
    and student.family_id = source.family_id
  where source.source_entity = 'student_application'
    and not exists (
      select 1
      from students_with_direct_guardians direct
      where direct.student_id = student.id
    )
)
insert into public.student_guardians (
  student_id,
  family_id,
  guardian_id,
  relationship_label,
  receives_communication,
  sort_order
)
select distinct
  source.student_id,
  source.family_id,
  guardian.guardian_id,
  source.relationship_label,
  coalesce(source.email, source.phone) is not null,
  case source.relationship_label
    when 'mother' then 0
    when 'father' then 1
    else 2
  end
from student_sources source
join family_guardian_backfill_map guardian
  on guardian.family_id = source.family_id
  and guardian.fingerprint = source.fingerprint
on conflict (student_id, guardian_id) do nothing;

insert into public.family_data_reviews (
  family_id,
  category,
  source_entity,
  source_entity_id,
  details
)
with role_variants as (
  select
    family_id,
    relationship_label,
    count(distinct fingerprint) as variant_count
  from family_guardian_backfill_source
  group by family_id, relationship_label
  having count(distinct fingerprint) > 1
),
family_conflicts as (
  select
    family_id,
    jsonb_object_agg(relationship_label, variant_count) as variants
  from role_variants
  group by family_id
)
select
  family_id,
  'legacy_guardian_conflict',
  'family',
  family_id,
  jsonb_build_object('variantsByRelationship', variants)
from family_conflicts
on conflict do nothing;

insert into public.family_data_reviews (
  family_id,
  category,
  source_entity,
  source_entity_id,
  details
)
with guardian_contacts as (
  select
    family.family_id,
    concat('email:', lower(btrim(guardian.email))) as contact_key
  from public.family_guardians family
  join public.guardians guardian on guardian.id = family.guardian_id
  where nullif(btrim(guardian.email), '') is not null
  union
  select
    family.family_id,
    concat('phone:', regexp_replace(guardian.phone, '[^0-9+]', '', 'g'))
  from public.family_guardians family
  join public.guardians guardian on guardian.id = family.guardian_id
  where nullif(btrim(guardian.phone), '') is not null
),
cross_family_matches as (
  select distinct
    own.family_id,
    candidate.family_id as candidate_family_id
  from guardian_contacts own
  join guardian_contacts candidate
    on candidate.contact_key = own.contact_key
    and candidate.family_id <> own.family_id
),
family_candidates as (
  select
    family_id,
    array_agg(candidate_family_id order by candidate_family_id) as candidate_family_ids
  from cross_family_matches
  group by family_id
)
select
  family_id,
  'possible_duplicate_family',
  'family',
  family_id,
  jsonb_build_object('candidateFamilyIds', to_jsonb(candidate_family_ids))
from family_candidates
on conflict do nothing;
