begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(4);

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
  relationship_label
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'guardian'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'guardian'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'guardian'
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

select lives_ok(
  $$
    insert into public.student_guardians (
      student_id,
      family_id,
      guardian_id,
      is_primary
    )
    values (
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      true
    )
  $$,
  'accepts a guardian linked to the student family'
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
    insert into public.student_guardians (
      student_id,
      family_id,
      guardian_id,
      is_primary
    )
    values (
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      true
    )
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

select * from finish();

rollback;
