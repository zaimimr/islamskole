begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(9);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.families (id, origin)
values
  ('10000000-0000-0000-0000-000000000001', 'test'),
  ('10000000-0000-0000-0000-000000000002', 'test');

insert into public.guardians (id, first_name)
values
  ('20000000-0000-0000-0000-000000000001', 'Foresatt En'),
  ('20000000-0000-0000-0000-000000000002', 'Foresatt To'),
  ('20000000-0000-0000-0000-000000000003', 'Foresatt Tre');

insert into public.family_guardians (
  family_id,
  guardian_id,
  relationship_label,
  is_primary_contact
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'guardian',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'guardian',
    false
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'guardian',
    true
  );

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'child_first_name'
  ) then
    execute $insert$
      insert into public.students (id, family_id, child_first_name)
      values (
        '30000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'Elev'
      )
    $insert$;
  else
    execute $insert$
      insert into public.students (id, family_id, full_name, guardian_name)
      values (
        '30000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'Elev',
        'Foresatt'
      )
    $insert$;
  end if;
end;
$$;

select ok(
  exists (
    select 1
    from public.student_guardians
    where student_id = '30000000-0000-0000-0000-000000000001'
      and family_id = '10000000-0000-0000-0000-000000000001'
      and guardian_id = '20000000-0000-0000-0000-000000000001'
      and is_primary
  ),
  'automatically links the primary family guardian'
);

select throws_ok(
  $$
    insert into public.student_guardians (
      student_id,
      family_id,
      guardian_id
    )
    values (
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000003'
    )
  $$,
  '23503',
  'insert or update on table "student_guardians" violates foreign key constraint "student_guardians_family_guardian_fkey"',
  'rejects a guardian from another family'
);

select throws_ok(
  $$
    update public.student_guardians
    set is_primary = true
    where student_id = '30000000-0000-0000-0000-000000000001'
      and guardian_id = '20000000-0000-0000-0000-000000000002'
  $$,
  '23505',
  'duplicate key value violates unique constraint "student_guardians_one_primary_idx"',
  'allows only one primary guardian per student'
);

select throws_ok(
  $$
    insert into public.family_data_reviews (
      family_id,
      category,
      status,
      resolved_at
    )
    values (
      '10000000-0000-0000-0000-000000000001',
      'possible_duplicate_family',
      'open',
      now()
    )
  $$,
  '23514',
  'new row for relation "family_data_reviews" violates check constraint "family_data_reviews_resolution_check"',
  'keeps open review items unresolved'
);

insert into public.family_data_reviews (
  family_id,
  category,
  details
) values (
  '10000000-0000-0000-0000-000000000001',
  'possible_duplicate_family',
  '{}'::jsonb
);

select lives_ok(
  $$
    select public.update_family_relationships(
      '10000000-0000-0000-0000-000000000001',
      jsonb_build_object(
        'display_name', 'Familien Test',
        'address', 'Nyveien 4',
        'postal_code', '1300',
        'city', 'Sandvika'
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', '20000000-0000-0000-0000-000000000002',
          'first_name', 'Foresatt',
          'last_name', 'To',
          'email', 'to@example.no',
          'phone', '+4790000002',
          'role', 'verge'
        ),
        jsonb_build_object(
          'id', '20000000-0000-0000-0000-000000000001',
          'first_name', 'Foresatt',
          'last_name', 'En',
          'email', 'en@example.no',
          'phone', '+4790000001',
          'role', 'foresatt'
        ),
        jsonb_build_object(
          'first_name', 'Foresatt',
          'last_name', 'Fire',
          'email', 'fire@example.no',
          'phone', '+4790000004',
          'role', 'steforelder'
        )
      ),
      true
    )
  $$,
  'updates family details and relationships atomically'
);

select is(
  (
    select display_name
    from public.families
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'Familien Test',
  'stores a deliberate family name override'
);

select ok(
  exists (
    select 1
    from public.family_guardians
    where family_id = '10000000-0000-0000-0000-000000000001'
      and guardian_id = '20000000-0000-0000-0000-000000000002'
      and is_primary_contact
      and relationship_label = 'verge'
  ),
  'changes the primary contact and relationship'
);

select is(
  (
    select count(*)
    from public.family_guardians
    where family_id = '10000000-0000-0000-0000-000000000001'
  ),
  3::bigint,
  'adds a new guardian to the family'
);

select is(
  (
    select status
    from public.family_data_reviews
    where family_id = '10000000-0000-0000-0000-000000000001'
      and category = 'possible_duplicate_family'
  ),
  'resolved',
  'resolves reviewed family data after confirmation'
);

select * from finish();

rollback;
