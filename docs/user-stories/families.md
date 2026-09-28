# Families, guardians and students: audit and user stories

Scope: admin/familier, admin/elever (list, ny, [id]), admin/register, src/lib/families, /pamelding, /min-side and /min-side/barn/[studentId]. I only read code and ran SELECT queries against prod (2026-09-29). Nothing was changed.

Paths are shortened: `A/` = `src/app/[locale]/admin/`, `M/` = `supabase/migrations/`.

## 1. Current behavior

### Data model
- `families` 1-n `family_guardians` n-1 `guardians`. `students.family_id` and `student_applications.family_id` both point at `families` with ON DELETE RESTRICT (`M/20260829115250_family_data_foundation.sql:65-78`).
- `student_guardians` is derived from the family. It is kept in sync by the triggers `students_sync_family_guardians` (after insert/update of `family_id` on students) and `family_guardians_propagate` (after insert/update/delete on family_guardians) (`M/20260829115500_public_family_enrollment.sql:1-114`). Both triggers are present in prod. Every guardian in a family becomes a guardian of every child in that family. The columns `has_legal_guardianship` and `can_pick_up` exist but nothing sets them.
- There are four copies of guardian contact data: `guardians`, `students.mother_*/father_*`, `student_applications.mother_*/father_*` and `payments.payer_*`.

### Enrollment (/pamelding)
- `createStudentEnrollment` (`A/actions.ts:563-832`) calls `create_public_family_enrollment`. That function **always inserts a new family and new guardian rows** (`M/20260829115500...sql:180-239`). When a guardian's email or phone matches an existing family, it only opens a `possible_duplicate_family` review (`:241-279`). Applications get `family_id` and `payment_id`. No student row is created until an admin admits the application.
- If the Vipps payment is abandoned, the family and guardian rows are left behind, and a retry creates a new family.

### Admission (/admin/register)
- `admitApplications` calls `createStudentFromApplication` (`A/register/register-actions.ts:20-55`, `A/students-actions.ts:245-402`). The student row is a copy of the application and inherits its `family_id`. The only duplicate check is on `application_id` (`:264-275`), with no match on name and birth date, so a returning child who signs up again becomes a second student.

### Admin: new student (/admin/elever/ny)
- `createStudent` calls `create_manual_family_student` (`A/students-actions.ts:216-243`, `M/20260829115500...sql:431-592`). It **always creates a new family**. There is no way to add a child to an existing family.

### Admin: edit student (/admin/elever/[id]?rediger=1)
- `updateStudent` (`A/students-actions.ts:404-446`) updates only the child fields on `students`. The guardian section of the form is hidden when editing (`src/components/admin/student-form.tsx:252`). Edits are **not written back to `student_applications`** and do not change the family address.

### Admin: edit family (/admin/familier/[id]/rediger)
- `updateFamilyRelationships` calls `update_family_relationships` (`A/familier/families-actions.ts:32-109`, `M/20260829115533_family_admin_edits.sql`). The admin can edit the family name and address, and each guardian's name, email, phone and role. The admin can also add guardians and pick the primary. The RPC mirrors guardian 1 and 2 into `students.mother_*` / `father_*` by position, not by role (`:138-161`). **It does not update `student_applications`** or the family's students' `child_address`.
- **Saved guardians cannot be removed.** The "Fjern foresatt" button is shown only for unsaved rows (`src/components/admin/family-editor.tsx:263-275`), and the RPC never deletes `family_guardians` rows.
- There is no action anywhere to delete a family, merge families or move a child to another family. Duplicates are only detected (`A/familier/duplicates.ts`, `findDuplicateFamilies` / `findDuplicateStudents`) and linked from the family page (`A/familier/[id]/page.tsx:129-135, 406-410`).

### Delete, withdraw and placements
- `deleteStudent` (`A/students-actions.ts:482-523`) is blocked when the student has payments, allocations, refunds, adjustments, installments or payment_targets (`:448-480`). Otherwise it archives the application and deletes the student. FK cascades then silently delete enrollments, student_fees, attendance, absence_reports and student_guardians. refunds get SET NULL. The family is kept even if it now has no children.
- `archiveStudent` ("Eleven har sluttet", `:525-558`) sets active enrollments to `avsluttet`. `student_fees`, installments and plans are not touched. The dialog tells the admin to grant fritak manually (`A/elever/[id]/student-exit-panel.tsx:102-105`).
- `removeEnrollment` (`:873-899`) deletes the enrollment but leaves `student_fees`, so the balance is still owed.
- `rollover_enrollments` (`M/20260927105752_enrollment_rollover.sql:19-147`) creates enrollments and fees for the next year and leaves the old year's enrollments `aktiv`.

### Portal (/min-side)
- Access is based on email. `portal_guardian_ids()` matches `lower(guardians.email) = lower(jwt.email)` on every call and excludes `mangler@islamskole.no` (`M/20260927125407_portal_hardening.sql:1-14`). `portal_is_guardian_of` checks `student_guardians` (`M/20260927123038_portal_schema.sql:100-113`).
- Login (`src/lib/portal/actions.ts:66-125`): rate limited. If any guardian row has that email, it creates an auth user (`email_confirm: true`) and sends a magic link.
- `portal_my_children()` returns only children with an **active enrollment in the active school year** (`M/20260927123055_portal_rpcs.sql:44-54`). `/min-side/barn/[studentId]` looks the child up in that list and calls `notFound()` otherwise (`src/app/[locale]/min-side/barn/[studentId]/page.tsx:33-34`), so a parent cannot open another family's child by changing the id in the URL.
- RLS: students, student_applications, families, guardians, family_guardians, student_guardians, enrollments, student_fees and payments are admin-only (checked with pg_policies). Parents only get data through SECURITY DEFINER RPCs. attendance and absence_reports have guardian policies.
- A parent cannot edit their own contact info anywhere in the portal.
- Parent who is also a teacher: `min-side/page.tsx:30-40` shows tabs when both `isGuardian` and `isTeacher` are true.

### Prod data facts (SELECT only, 2026-09-29)
- 13 guardian emails appear in more than one family. 16 emails are shared by more than one guardian row.
- 24 open family reviews: 22 `possible_duplicate_family`, 2 `legacy_guardian_conflict`.
- 42 families have no `is_primary_contact` guardian.
- 5 students differ from their application in mother_email, first name or birth date.
- 2 orphan guardians with no family, 1 of them a teacher. 2 students have no active placement in the active year.
- 0 students without a family, 0 students without `student_guardians`.
- Unique index `enrollments_one_active_per_year` exists.

## 2. User stories

### FAM-01: Parent sees only their own children
**Som** foresatt **vil jeg** bare se mine egne barn på Min side **slik at** andre familiers opplysninger holdes private.
Status: WORKS
Evidence: `portal_my_children` filters on `student_guardians` + `portal_guardian_ids()` (`M/20260927123055_portal_rpcs.sql:48-53`). The child page calls notFound for ids outside that list (`min-side/barn/[studentId]/page.tsx:33-34`). The students, guardians and families tables are admin-only in RLS.
Acceptance criteria:
- Given parent A signed in, when A opens `/min-side/barn/<id of child in family B>`, then the response is 404 and no name of B's child is rendered.
- Given parent A's session, when A calls `supabase.from('students').select()` directly with the anon key, then 0 rows come back.
- Given parent A's session, when A calls `rpc('portal_is_guardian_of', {p_student_id: B_child})`, then it returns false.
- Given parent A's session, when A calls `rpc('portal_class_roster', …)` for a class A does not teach, then error 42501.
Test type: integration (RLS) + e2e
Priority: P0

### FAM-02: Parent can only report and withdraw absence for their own child
**Som** foresatt **vil jeg** melde fravær bare for mine barn **slik at** ingen kan endre fravær for andres barn.
Status: WORKS
Evidence: absence_reports insert policy requires `portal_is_guardian_of(student_id)` and `reported_by_guardian_id in portal_guardian_ids()` (`M/20260927123038_portal_schema.sql:306-313`). The withdraw policy is in `M/20260927125407_portal_hardening.sql:116-124`.
Acceptance criteria:
- Given parent A, when `reportAbsence(B_child, openDay)` is called, then the result is `{ok:false}` and no row is inserted.
- Given parent A and an open report for B's child, when `withdrawAbsence(reportId)` is called, then `not_found` and `withdrawn_at` stays null.
- Given parent A and their own child, when absence is reported for a future open day, then an attendance row `meldt_fravaer` is created.
Test type: integration (RLS)
Priority: P0

### FAM-03: Changing a guardian's email moves portal access to the new address
**Som** administrator **vil jeg** endre e-posten til en foresatt **slik at** den nye adressen får tilgang og den gamle mister den.
Status: PARTIAL
Evidence: The email is edited through `update_family_relationships` (`M/20260829115533...sql:119-125`). Access is re-checked against `guardians.email` on every request (`portal_hardening.sql:8-13`), so the old address loses access immediately **unless another guardian row in another family still has the old email**. That is the case for 13 emails in prod. The old auth user is never removed or flagged. `student_applications.mother_email` and `father_email` keep the old address.
Acceptance criteria:
- Given guardian G with old@x in one family, when admin changes it to new@x, then a session signed in as old@x sees 0 children on next load, and a magic link to new@x shows the children.
- Given the same parent exists as guardian rows in families F1 and F2 with old@x, when admin changes the email only in F1, then the UI warns that old@x still has access through F2, or offers to update both.
- Given the email change, when the admin opens the application in /admin/register, then it shows the current guardian email or is clearly labeled as the original submission.
- Given the email change, then an audit entry records old and new email (today metadata holds only guardianCount, `families-actions.ts:101-106`).
Test type: integration + e2e
Priority: P0

### FAM-04: Admin can edit guardian name and phone
**Som** administrator **vil jeg** rette navn og telefon for en foresatt **slik at** kontaktlister og e-poster er riktige.
Status: WORKS (with drift, see FAM-05)
Evidence: `A/familier/families-actions.ts:51-97`. The RPC updates guardians and mirrors them to students (`M/20260829115533...sql:119-161`).
Acceptance criteria:
- Given a family with 2 guardians, when admin changes guardian 2's phone and saves, then `/admin/familier/[id]`, `/admin/elever/[id]` and the teacher roster (`portal_class_roster`) show the new phone.
- Given an invalid email, when saving, then the error "Skriv inn en gyldig e-postadresse" is shown and nothing is saved.
- Given a guardian with neither first nor last name, when saving, then it is rejected.
Test type: e2e
Priority: P1

### FAM-05: One source of truth for guardian and child data after edits
**Som** administrator **vil jeg** at endringer i familie eller elev gjelder overalt **slik at** jeg ikke ser gamle opplysninger i ulike skjermbilder.
Status: BROKEN
Evidence: `updateStudent` writes only to `students` (`A/students-actions.ts:425-428`). `update_family_relationships` writes guardians and students but not applications. 5 students already differ from their application in prod. The register page reads `student_applications.mother_email` (`A/register/page.tsx:127, 615`), and receipts for application-linked payments read application emails (`src/lib/payments-sync.ts:204`). The RPC also maps guardians to mother/father columns by position: if the primary guardian is the father, his name goes into `mother_*` (`M/20260829115533...sql:153-160`).
Acceptance criteria:
- Given an admitted student, when admin edits the child's birth date on the student page, then every admin view (elever list, family page, register, export) shows the new date.
- Given admin changes guardian email on the family, when a payment receipt for a signup payment is sent, then it goes to the new email.
- Given a family whose primary guardian has role "far", when saved, then `students.father_*` holds the father and `mother_*` does not.
- Given the documented rule "application is source of truth", then either edits write back to the application or the docs and memory are updated to say the family and student are the source of truth after admission.
Test type: integration
Priority: P1

### FAM-06: Admin can remove a guardian from a family
**Som** administrator **vil jeg** fjerne en foresatt fra en familie **slik at** en forelder uten foreldreansvar eller en feilregistrert person mister tilgang.
Status: MISSING
Evidence: The remove button only exists for unsaved rows (`src/components/admin/family-editor.tsx:263`). The RPC has no delete path. The trigger `propagate_family_guardian` already handles DELETE (`M/20260829115500...sql:61-65`), so the backend is ready.
Acceptance criteria:
- Given a family with 2 saved guardians, when admin removes guardian 2 and saves, then the `family_guardians` and `student_guardians` rows for guardian 2 are gone.
- Given the removal, when guardian 2 signs in to /min-side, then 0 children are shown.
- Given only 1 guardian, when admin tries to remove it, then it is blocked ("minst én foresatt").
- Given guardian 2 is also a teacher, when removed from the family, then the guardian row and `class_teachers` stay.
Test type: e2e + integration
Priority: P0 (a parent who should lose access cannot be cut off)

### FAM-07: Second guardian gets portal access
**Som** forelder nummer to **vil jeg** logge inn med min egen e-post og se barna **slik at** begge foreldre følger med.
Status: WORKS
Evidence: The enrollment form accepts up to 6 guardians (`A/actions.ts:616-664`). Guardians added by admin go into `family_guardians`, and the trigger propagates them to all children (`M/20260829115500...sql:68-93`).
Acceptance criteria:
- Given a family with mother and father emails, when the father requests a login link, then he receives it and sees the same children as the mother.
- Given admin adds a third guardian with an email, when that guardian signs in, then the family's children show without further steps.
- Given a guardian without email, then no login is possible and the admin family page shows "mangler e-post".
Test type: e2e
Priority: P1

### FAM-08: Guardian access per child (half-siblings, separated parents)
**Som** administrator **vil jeg** styre hvilke barn hver foresatt har tilgang til **slik at** en steforelder bare ser sitt eget barn.
Status: MISSING
Evidence: `student_guardians` is always all guardians times all children in the family (the triggers above). `has_legal_guardianship` and `can_pick_up` are never set or read.
Acceptance criteria:
- Given a family with children C1 and C2 and a stepparent linked only to C2, when the stepparent signs in, then only C2 is shown.
- Given the per-child toggle, when a new child is added to the family, then the admin chooses which guardians apply (default: all).
Test type: integration
Priority: P2

### FAM-09: Returning parent's enrollment reuses the existing family
**Som** foresatt som melder på et nytt søsken **vil jeg** havne i samme familie **slik at** søskenrabatt, betalingsplan og Min side samles.
Status: BROKEN
Evidence: `create_public_family_enrollment` always inserts a new family and new guardians (`M/20260829115500...sql:180-239`). It only opens a review (`:261-279`). There is an unused matcher, `src/lib/families/matching.ts` `decideFamilyMatch`, that nothing imports. Prod has 22 open possible_duplicate_family reviews and 13 emails spread over several families.
Acceptance criteria:
- Given family F with guardian email a@x, when a@x submits /pamelding for a new child, then the new application gets `family_id = F` (or it lands in a clear "koble til familie" admin task before admission).
- Given the match, then no new guardian row with a@x is created.
- Given a match only on phone and not email, then a review is opened instead of an automatic merge.
- Given an abandoned Vipps payment followed by a retry, then only one family exists afterwards.
Test type: integration
Priority: P1

### FAM-10: Merge two duplicate families
**Som** administrator **vil jeg** slå sammen to familier som er samme husstand **slik at** barn, foresatte, betalinger og planer ligger på ett sted.
Status: MISSING
Evidence: No merge action or RPC exists (grep for merge/move in src and migrations finds nothing). The duplicate panel only links to the other family (`A/familier/[id]/page.tsx:129-135`).
Acceptance criteria:
- Given families F1 (child A) and F2 (child B) with the same guardian email, when admin merges F2 into F1, then both children have `family_id = F1`, guardians are deduplicated by email, and F2 is deleted.
- Given F2 has an active payment plan or sadaqa gifts, when merging, then the admin is shown what happens (plans re-generated for F1, gifts re-pointed) and nothing is silently cascaded away.
- Given the merge, then open duplicate reviews for both families are resolved and an audit entry lists the moved ids.
- Given the merge, when the parent signs in, then they see both children once.
Test type: integration + e2e
Priority: P1

### FAM-11: Move a child to another family
**Som** administrator **vil jeg** flytte et barn til riktig familie **slik at** feilkoblede barn får riktige foresatte.
Status: MISSING
Evidence: There is no UI or action. The `students_sync_family_guardians` trigger would re-derive guardians when `family_id` changes (`M/20260829115500...sql:8-41`), but payment_plans and installments are per family and would not follow.
Acceptance criteria:
- Given child C in F1, when admin moves C to F2, then C's `student_guardians` equal F2's guardians and F1's guardians lose portal access to C.
- Given C has planned installments in F1's plan, when moved, then F1's pending installments are rebuilt without C and F2's with C.
- Given C's application, then `student_applications.family_id` is updated too.
Test type: integration
Priority: P1

### FAM-12: Add a sibling to an existing family from admin
**Som** administrator **vil jeg** registrere et nytt barn direkte i en eksisterende familie **slik at** jeg ikke lager en ny duplikatfamilie.
Status: MISSING
Evidence: `create_manual_family_student` always inserts a new family (`M/20260829115500...sql:454-465`). The family page links to the generic `/elever/ny` (`A/familier/page.tsx:227`).
Acceptance criteria:
- Given family F, when admin clicks "Legg til barn" on F and saves the child, then the student has `family_id = F` and no new family or guardian is created.
- Given the new child, then F's guardians see the child on /min-side once it is placed in a class.
Test type: e2e
Priority: P1

### FAM-13: Delete a wrongly registered student
**Som** administrator **vil jeg** slette en elev som ble registrert ved en feil **slik at** listene blir riktige uten at økonomihistorikk går tapt.
Status: PARTIAL
Evidence: The blockers cover payments, allocations, refunds, adjustments, installments and payment_targets (`A/students-actions.ts:448-480`). They do not cover attendance or absence_reports, which cascade away silently (FK confdeltype `c`). student_fees and enrollments also cascade. The family is left behind even when it becomes empty.
Acceptance criteria:
- Given a student with a captured payment, when admin tries to delete, then it is blocked with a message naming "betalinger", and nothing changes.
- Given a student with no money records but with attendance rows, when admin deletes, then the dialog warns about the attendance history (or blocks and suggests "Eleven har sluttet").
- Given a successful delete, then the application status is `arkivert`, the student is gone from class rosters and /min-side, and an audit entry exists.
- Given the deleted student was the only child in the family and the family has no other applications, then the admin is offered to delete the empty family.
Test type: integration
Priority: P1

### FAM-14: Withdraw a student mid-year
**Som** administrator **vil jeg** registrere at en elev slutter midt i året **slik at** plassen frigjøres og familien ikke faktureres for resten.
Status: PARTIAL
Evidence: `archiveStudent` only ends enrollments (`A/students-actions.ts:525-558`). The fee and planned installments stay. The cron still sends `planlagt` installments for the child (the filter is on plan status only, `src/app/api/cron/installments/route.ts:73`). The dialog tells the admin to grant fritak by hand (`student-exit-panel.tsx:102-105`).
Acceptance criteria:
- Given a child on a monthly plan, when admin clicks "Eleven har sluttet", then the dialog offers "fritak for resten av året" in the same step.
- Given fritak is chosen, then the child's pending installments are rebuilt (amount 0 or removed) and no future payment link includes the child.
- Given withdrawal without fritak, then the family page shows an outstanding balance for a child without a place, flagged for follow-up.
- Given withdrawal, then the class roster for the teacher no longer shows the child.
Test type: integration + e2e
Priority: P1

### FAM-15: Removing a placement also removes or flags the fee
**Som** administrator **vil jeg** at det å fjerne en feilregistrert plassering også fjerner årsprisen **slik at** familien ikke står med gjeld uten plass.
Status: BROKEN
Evidence: `removeEnrollment` deletes the enrollment only (`A/students-actions.ts:880`). `student_fees` stays, and `student_balances` is built from `student_fees` with no link to enrollments (`M/20260827193038...sql:12-30`).
Acceptance criteria:
- Given a student with one enrollment and a fee with no payments for that year, when admin removes the placement, then the fee for that year is deleted too (or the admin is asked).
- Given the fee has payments, when the placement is removed, then the admin gets a warning and the fee stays.
Test type: integration
Priority: P1

### FAM-16: Withdrawn or unplaced child is still visible to the parent
**Som** foresatt **vil jeg** fortsatt se et barn som har sluttet eller venter på klasse **slik at** jeg forstår status og eventuell restbeløp.
Status: MISSING
Evidence: `portal_my_children` requires an active enrollment in the active year (`M/20260927123055_portal_rpcs.sql:45-46`). 2 prod students have no active placement. After a withdrawal the parent sees the "no role" empty state (`min-side/page.tsx:41-45`).
Acceptance criteria:
- Given a child admitted but not placed, when the parent signs in, then the child is listed with "venter på klasse".
- Given a withdrawn child with a remaining balance, then the parent sees the child as "sluttet" with the remaining amount, and no absence or homework actions.
- Given a withdrawn child without a balance, then the child is not shown, or shown as history only.
Test type: e2e
Priority: P2

### FAM-17: Parent with children in two classes
**Som** foresatt med barn i to klasser **vil jeg** se riktig lærer, lekser og fravær per barn **slik at** jeg ikke blander klassene.
Status: WORKS (UNVERIFIED in browser)
Evidence: `portal_my_children` returns one row per child with its own class and teachers. Notes are grouped by class (`src/lib/portal/parent-data.ts:24-27`). `class_notes` guardian policy uses `portal_is_guardian_in_class` (`M/20260927123038...sql:296-298`).
Acceptance criteria:
- Given children C1 in class K1 and C2 in class K2, when the parent opens C1, then only K1's teachers and notes show.
- Given the parent, when querying `class_notes` for a class K3 where they have no child, then 0 rows.
Test type: e2e
Priority: P2

### FAM-18: Parent who is also a teacher
**Som** foresatt som også er lærer **vil jeg** se både "Mine barn" og "Min klasse" med samme innlogging **slik at** jeg slipper to kontoer.
Status: PARTIAL
Evidence: The tabs render when both roles are present (`min-side/page.tsx:30-38`). But `registerTeacher` matches an existing guardian with `ilike(email).limit(1)` (`A/familier/families-actions.ts:506-512`), which picks an arbitrary row when the email exists in several families. That still works for login because `portal_guardian_ids` returns all rows. When there is no match it creates a teacher guardian with no family: 1 orphan teacher row exists in prod. If the parent later enrolls, a second guardian row is created.
Acceptance criteria:
- Given guardian G (parent of C) marked is_teacher and assigned to class K, when G signs in, then both tabs show, "Mine barn" lists C, and "Min klasse" lists K.
- Given the teacher email exists in two families, when admin registers the teacher, then the admin chooses which guardian row, or all rows are flagged.
- Given a teacher created without family who later enrolls a child with the same email, then the enrollment links to the existing guardian row instead of creating a new one.
Test type: e2e
Priority: P2

### FAM-19: Parent can update own contact info
**Som** foresatt **vil jeg** oppdatere telefon og adresse selv på Min side **slik at** skolen alltid har riktige kontaktopplysninger.
Status: MISSING
Evidence: There is no portal action for this (`src/lib/portal/actions.ts` has only login, attendance, notes and absence). guardians and families are admin-only in RLS.
Acceptance criteria:
- Given a signed-in parent, when they change their phone on /min-side, then `guardians.phone` is updated for all their guardian rows and an audit entry is written.
- Given a parent tries to change their email, then it requires confirmation from the new address before `guardians.email` changes (otherwise access could be moved to an address nobody controls).
- Given a parent edits contact info, then they cannot change another guardian's data or child data (RLS test).
Test type: integration + e2e
Priority: P2

### FAM-20: Magic link login for a guardian
**Som** foresatt **vil jeg** få en innloggingslenke på e-post **slik at** jeg kommer inn uten passord.
Status: WORKS
Evidence: `src/lib/portal/actions.ts:66-125`: honeypot, 2s time trap, IP, email and global throttle, silent success for unknown emails, placeholder email excluded. Verified in `min-side/auth/bekreft/route.ts:16-24`.
Acceptance criteria:
- Given an email in guardians, when submitted, then one magic link is sent and the confirm route redirects to /min-side.
- Given an unknown email, when submitted, then the UI response is the same "sjekk e-posten" and no auth user is created.
- Given 4 requests for the same email within 10 min, then only 3 links are sent.
- Given `mangler@islamskole.no`, then no link is sent and portal_guardian_ids returns nothing.
Test type: integration (use test-admin or ZZTEST only, never real parents)
Priority: P1

### FAM-21: Families without a primary contact
**Som** administrator **vil jeg** at hver familie har en primærkontakt **slik at** betalingsnavn, sortering og visningsnavn blir riktige.
Status: BROKEN (data)
Evidence: 42 prod families have no `is_primary_contact`, because the legacy backfill never set it (`M/20260829115250...sql:602-620`). The editor falls back to index 0 (`A/familier/[id]/rediger/page.tsx:58-61`), but nothing is saved until the admin saves the form.
Acceptance criteria:
- Given any family, then exactly one `family_guardians` row has `is_primary_contact = true` (SQL invariant test).
- Given a legacy family without a primary, when a migration or backfill runs, then the guardian with the lowest sort_order becomes primary and billing contact.
Test type: integration (SQL invariant)
Priority: P2

### FAM-22: Resolve duplicate-family reviews
**Som** administrator **vil jeg** kunne avgjøre en "mulig duplikatfamilie"-sak **slik at** listen over saker blir tom når jeg har sjekket.
Status: PARTIAL
Evidence: Reviews can only be resolved in bulk through the "resolve_reviews" checkbox on family save (`M/20260829115533...sql:163-176`). There is no "not a duplicate" (dismissed) action, so the `findDuplicateFamilies` banner reappears on every load because it is computed live (`A/familier/duplicates.ts:40-106`). 22 are open in prod.
Acceptance criteria:
- Given two families flagged as duplicates, when admin marks "ikke samme familie", then the review becomes `dismissed` and the banner no longer shows for that pair.
- Given admin merges them (FAM-10), then the review becomes `resolved`.
Test type: e2e
Priority: P2

### FAM-23: Re-enroll students into the next school year
**Som** administrator **vil jeg** flytte elever til neste skoleår **slik at** de får klasse og årspris uten ny påmelding.
Status: WORKS (with gaps)
Evidence: `rollover_enrollments` is admin-only, skips students already active in the target year, inserts a fee at the class price or year fee, and writes an audit entry (`M/20260927105752...sql:62-143`). Gaps: class capacity is not checked, and old-year enrollments stay `aktiv`, so the old year keeps counting them. The public /pamelding path for returning students creates a duplicate student (see FAM-24).
Acceptance criteria:
- Given 3 students active in year Y1, when rollover to Y2 with class choices, then 3 active enrollments and 3 student_fees exist in Y2, and a second run reports skipped=3.
- Given Y2 has no fee, then rollover fails with "Sett årspris …".
- Given a target class with capacity 2 and 3 students, then the admin is warned before confirm.
- Given Y2 becomes active, when the parent signs in, then the child shows the Y2 class.
Test type: integration
Priority: P1

### FAM-24: Returning child who signs up again is not duplicated
**Som** administrator **vil jeg** at et barn som meldes på igjen kobles til eksisterende elev **slik at** historikk og saldo følger barnet.
Status: BROKEN
Evidence: `createStudentFromApplication` checks only `application_id` (`A/students-actions.ts:264-275`). `findDuplicateStudents` only reports name + birthdate matches (`A/familier/duplicates.ts:108-131`).
Acceptance criteria:
- Given student S (name N, birthdate D), when a new application with N and D is admitted, then the admin is asked "koble til eksisterende elev" and, on yes, no new students row is created and the enrollment is added to S.
- Given no match, then a new student is created as today.
Test type: integration
Priority: P1

### FAM-25: Deleting an application leaves no orphan family
**Som** administrator **vil jeg** at sletting av en ubetalt påmelding rydder opp familie og foresatte **slik at** e-posten ikke gir innlogging eller skaper duplikatsaker.
Status: PARTIAL
Evidence: `deleteStudentApplication` deletes the application only (`A/actions.ts:864-900`). The family and guardians it created stay, so the guardian email still triggers login links (the portal shows an empty state) and can trigger duplicate reviews. There are 0 empty families in prod right now, so this is latent.
Acceptance criteria:
- Given an unpaid application that was the only record in its family, when admin deletes it, then the family, its family_guardians and guardians without other families are deleted.
- Given the family has other applications or students, then only the application is deleted.
Test type: integration
Priority: P2

### FAM-26: Admin can edit child info
**Som** administrator **vil jeg** rette barnets navn, fødselsdato, kjønn og nivå **slik at** alder og klasseplassering blir riktig.
Status: WORKS (drift: FAM-05)
Evidence: `updateStudent` with zod-required names, audit of changed fields (`A/students-actions.ts:404-446`). Age is computed with `ageInYear` (`A/elever/[id]/page.tsx:258-260`).
Acceptance criteria:
- Given a student, when admin changes the birth date from 2020 to 2019 and saves, then the age on /admin/elever/[id] and on /min-side increases by 1 (calendar-year rule).
- Given an empty first name, when saving, then "Barnets fornavn er påkrevd" and no change.
- Given a change, then audit_log `student.update` lists exactly the changed fields.
Test type: e2e
Priority: P2

### FAM-27: Family address edit reaches the children
**Som** administrator **vil jeg** at ny adresse på familien gjelder barna **slik at** eksport og brev går til riktig adresse.
Status: BROKEN
Evidence: `update_family_relationships` updates `families.address` only (`M/20260829115533...sql:33-39`). The student `child_address` and the export (`src/app/api/export/[entity]/route.ts:34`) still use the old value.
Acceptance criteria:
- Given a family with 2 children, when admin changes the family address, then the students export shows the new address for both children (or the export reads the family address).
Test type: integration
Priority: P2
