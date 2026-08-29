begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(11);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.school_years (id, label, fee)
values (
  '70000000-0000-0000-0000-000000000001',
  '2097/2098',
  750
);

create temporary table public_family_enrollment_result as
select public.create_public_family_enrollment(
  '70000000-0000-0000-0000-000000000001',
  'isk-family-enrollment-test',
  150000,
  'Innmelding 2097/2098 - 2 barn',
  'Skoleveien 1',
  '1300',
  'Sandvika',
  jsonb_build_array(
    jsonb_build_object(
      'first_name', 'Amina',
      'last_name', 'Rahman',
      'email', 'amina@example.no',
      'phone', '+4790000001',
      'role', 'mor'
    ),
    jsonb_build_object(
      'first_name', 'Karim',
      'last_name', 'Rahman',
      'email', 'karim@example.no',
      'phone', '+4790000002',
      'role', 'far'
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'child_first_name', 'Noor',
      'child_last_name', 'Rahman',
      'child_birth_date', '2016-04-05',
      'child_gender', 'jente',
      'mother_first_name', 'Amina',
      'mother_last_name', 'Rahman',
      'mother_email', 'amina@example.no',
      'mother_phone', '+4790000001',
      'father_first_name', 'Karim',
      'father_last_name', 'Rahman',
      'father_email', 'karim@example.no',
      'father_phone', '+4790000002',
      'terms_accepted', true
    ),
    jsonb_build_object(
      'child_first_name', 'Omar',
      'child_last_name', 'Rahman',
      'child_birth_date', '2018-07-08',
      'child_gender', 'gutt',
      'mother_first_name', 'Amina',
      'mother_last_name', 'Rahman',
      'mother_email', 'amina@example.no',
      'mother_phone', '+4790000001',
      'father_first_name', 'Karim',
      'father_last_name', 'Rahman',
      'father_email', 'karim@example.no',
      'father_phone', '+4790000002',
      'terms_accepted', true
    )
  )
) as result;

select is(
  (
    select count(*)
    from public.families family
    join public_family_enrollment_result intake
      on family.id = (intake.result ->> 'family_id')::uuid
  ),
  1::bigint,
  'creates one family'
);

select is(
  (
    select count(*)
    from public.family_guardians membership
    join public_family_enrollment_result intake
      on membership.family_id = (intake.result ->> 'family_id')::uuid
  ),
  2::bigint,
  'links both guardians to the family'
);

select is(
  (
    select count(*)
    from public.family_guardians membership
    join public_family_enrollment_result intake
      on membership.family_id = (intake.result ->> 'family_id')::uuid
    where membership.is_primary_contact
      and membership.is_billing_contact
  ),
  1::bigint,
  'selects one primary billing contact'
);

select is(
  (
    select count(*)
    from public.student_applications application
    join public_family_enrollment_result intake
      on application.family_id = (intake.result ->> 'family_id')::uuid
      and application.payment_id = (intake.result ->> 'payment_id')::uuid
  ),
  2::bigint,
  'links both siblings to one family and payment'
);

select is(
  (
    select count(*)
    from public.payments payment
    join public_family_enrollment_result intake
      on payment.id = (intake.result ->> 'payment_id')::uuid
    where payment.payer_email = 'amina@example.no'
  ),
  1::bigint,
  'stores the primary payer on the payment'
);

insert into public.students (
  application_id,
  family_id,
  child_first_name,
  child_last_name
)
select
  application.id,
  application.family_id,
  application.child_first_name,
  application.child_last_name
from public.student_applications application
join public_family_enrollment_result intake
  on application.family_id = (intake.result ->> 'family_id')::uuid
order by application.created_at, application.id
limit 1;

select is(
  (
    select count(*)
    from public.student_guardians relationship
    join public.students student on student.id = relationship.student_id
    join public_family_enrollment_result intake
      on student.family_id = (intake.result ->> 'family_id')::uuid
  ),
  2::bigint,
  'links the accepted student to both family guardians'
);

select is(
  (
    select count(*)
    from public.student_guardians relationship
    join public.students student on student.id = relationship.student_id
    join public_family_enrollment_result intake
      on student.family_id = (intake.result ->> 'family_id')::uuid
    where relationship.is_primary
  ),
  1::bigint,
  'keeps one primary guardian on the student'
);

create temporary table manual_family_student_result as
select public.create_manual_family_student(
  jsonb_build_object(
    'child_first_name', 'Lina',
    'child_last_name', 'Hassan',
    'child_birth_date', '2017-09-10',
    'child_gender', 'jente',
    'child_address', 'Rådhusgata 2',
    'child_postal_code', '1337',
    'child_city', 'Sandvika',
    'mother_first_name', 'Sara',
    'mother_last_name', 'Hassan',
    'mother_email', 'sara@example.no',
    'mother_phone', '+4790000003'
  )
) as student_id;

select is(
  (
    select count(*)
    from public.students student
    join manual_family_student_result result
      on student.id = result.student_id
    where student.family_id is not null
  ),
  1::bigint,
  'creates a family for a manually entered student'
);

select is(
  (
    select count(*)
    from public.student_guardians relationship
    join manual_family_student_result result
      on relationship.student_id = result.student_id
  ),
  1::bigint,
  'links a manual student to the entered guardian'
);

create temporary table flexible_manual_family_student_result as
select public.create_manual_family_student(
  jsonb_build_object(
    'child_first_name', 'Ilyas',
    'child_last_name', 'Nilsen',
    'guardians', jsonb_build_array(
      jsonb_build_object(
        'first_name', 'Samira',
        'last_name', 'Nilsen',
        'email', 'samira@example.no',
        'phone', '+4790000004',
        'role', 'verge'
      ),
      jsonb_build_object(
        'first_name', 'Adam',
        'last_name', 'Nilsen',
        'email', 'adam@example.no',
        'phone', '+4790000005',
        'role', 'steforelder'
      )
    )
  )
) as student_id;

select is(
  (
    select count(*)
    from public.student_guardians relationship
    join flexible_manual_family_student_result result
      on relationship.student_id = result.student_id
  ),
  2::bigint,
  'links flexible manual guardians without assuming mother and father'
);

select ok(
  exists (
    select 1
    from public.student_guardians relationship
    join flexible_manual_family_student_result result
      on relationship.student_id = result.student_id
    where relationship.relationship_label = 'verge'
      and relationship.is_primary
  ),
  'preserves the selected relationship for the primary manual guardian'
);

select * from finish();

rollback;
