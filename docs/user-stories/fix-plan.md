# Fix plan: access, roles and data integrity

Scope: every P0 and P1 story in this folder that is not WORKS, plus four owner requests from 2026-09-29:

1. Magic link only. No passwords anywhere, admins included.
2. Make it easy to turn anyone (admin, parent, new person) into a teacher, and a teacher or parent into an admin.
3. Students can log in with their own email (`students.child_email`) and see their own class notes and attendance.
4. Parents can see their child's full attendance and class notes for the year.

Order: tests first (red), then fixes until green.

Already verified in prod auth config (Management API, 2026-09-29): `disable_signup = true`, SMTP is `smtp.resend.com`, the magic link template points to `/min-side/auth/bekreft?token_hash=...`. So AUTH-05 and AUTH-24 are WORKS. Supabase caps its own auth emails at 25 per hour, which is one reason we move login emails to Resend (below).

## Decisions

- **Identity stays email based.** A person is known by email in one of three places: `profiles.role = 'admin'` (via `auth.users.email`), `guardians.email`, `students.child_email`. Teacher = guardian row with `is_teacher = true` plus `class_teachers` rows. A teacher with no family is still a guardian row, as today.
- **Login emails go through Resend, not Supabase SMTP.** The server calls `auth.admin.generateLink({ type: "magiclink" })`, builds `${SITE}/${locale}/min-side/auth/bekreft?token_hash=<hashed_token>&type=magiclink[&next=<path>]` and sends a branded email with `src/lib/email.ts`. Failures are returned to admin callers and logged for self-serve callers. The auth user is created (app_metadata role `member`) on first request if missing, as today.
- **Test outbox.** When `EMAIL_OUTBOX_DIR` is set, `src/lib/email.ts` writes each email as JSON (`{ to, subject, html, text, links }`) to that folder instead of calling Resend. Only e2e tests set it.
- **SEC-11** (a parent's magic link opens admin for the same email) is accepted by design: with magic link only, owning the mailbox is the credential for every role. Documented, not "fixed".
- **SEC-19** (test admin in prod): `test-admin@islamskole.no` stays, it is the deliberate smoke-test login. With passwords gone it has no password to leak.
- **Duplicate families in prod are not auto-merged.** We ship the merge tool and the admin decides per family.

## Database contract (one new migration, idempotent)

File: `supabase/migrations/20260929120000_access_and_integrity.sql`. Tests: `supabase/tests/*.sql` (pgTAP).

| # | Change | Stories |
| --- | --- | --- |
| D1 | Trigger on `guardians`: when `is_teacher` goes true to false, delete that guardian's `class_teachers` rows. | TCH-03, TCH-04 |
| D2 | Money is never cascade-deleted. Change to `ON DELETE RESTRICT`: `payments.student_id`, `payment_allocations.student_id`, `payment_allocations.school_year_id`, `payment_targets.student_id`, `student_fees.student_id`, `student_fees.school_year_id`, `student_fee_adjustments.student_id`, `student_fee_adjustments.school_year_id`, `installments.student_id`, `installments.school_year_id`, `payment_plans.school_year_id`, `payment_plans.family_id`. Also `attendance.school_day_id` and `class_notes.school_day_id` become RESTRICT, so a school year with attendance or notes cannot be deleted. Deleting a year with only generated school days still works. | CLS-21, SEC-20, SEC-21, FAM-13 |
| D3 | `admin_remove_guardian_from_family(p_family_id uuid, p_guardian_id uuid) returns text`: admin only. Removes `family_guardians` and that family's `student_guardians` rows for the guardian. Deletes the guardian row when it has no other family link and `is_teacher = false`. Returns `'deleted'` or `'unlinked'`. Raises if it would leave the family with zero guardians. | FAM-06 |
| D4 | `admin_merge_families(p_keep uuid, p_merge uuid) returns void`: admin only. Moves students, guardians, payment plans, applications, sadaqa gifts and reviews to `p_keep`. Guardians with the same `lower(email)` are merged into one row (every FK to guardians repointed, `is_teacher` ORed, non-empty fields kept). Open `family_data_reviews` for the pair are resolved. Deletes `p_merge`. | FAM-10, FAM-22, AUTH-23, SEC-24, FAM-03 |
| D5 | `admin_move_student_to_family(p_student_id uuid, p_family_id uuid) returns void`: admin only. Sets `students.family_id` and replaces the student's `student_guardians` with the target family's guardians. | FAM-11 |
| D6 | When a school year becomes active (`set_active_school_year`), copy `class_teachers` from the previously active year to the new year for guardians that still have `is_teacher = true`. Idempotent. | CLS-18, TCH-10 |
| D7 | Attendance insert/update by teachers only for a school day that is in the active year, not cancelled, and `date <= today (Europe/Oslo)`. Admin unchanged. | CLS-23, SEC-08 |
| D8 | `class_notes`: teachers may delete their class's notes; no insert/update on a cancelled day; guardians and students only read notes whose school day is in the active year. | CLS-24, CLS-25 |
| D9 | Student login: `portal_student_ids() returns setof uuid` (students whose `lower(child_email)` equals the JWT email, excluding `mangler@islamskole.no`). RLS: a student reads own `attendance` and the `class_notes` of classes they have an `aktiv` enrollment in for the active year. `portal_my_self()` returns the student's own class, notes and attendance summary. | New: student login |
| D10 | Admins can use teacher portal RPCs (`portal_class_roster`, notes, attendance) for any class, so `/min-side/klasse/[id]` works for admins. `portal_my_classes()` stays "classes I teach". | CLS-26 |
| D11 | Last admin protection: a trigger on `profiles` refuses an update or delete that leaves zero rows with `role = 'admin'`. | AUTH-14, SEC-18 |
| D12 | `classes.name_en`: a trigger sets it to `name` when null or blank. | CLS-01 |
| D13 | Portal helper functions return nothing when `auth.uid()` has no `auth.users` row (deleted user with a live JWT). | SEC-17 |
| D14 | `portal_login_hit` global bucket is only charged for known emails (app passes a separate key). | AUTH-08 |

## App contract (labels the e2e tests rely on)

Norwegian labels are exact. English locale gets matching strings.

**Login (AUTH-01, AUTH-10, AUTH-11, AUTH-12, AUTH-15, AUTH-17, new: magic link only)**
- `/login` and `/login/nytt-passord` redirect to `/min-side/logg-inn`, keeping `next`. No password input exists anywhere in the app.
- `/min-side/logg-inn`: one field labelled "E-post", button "Send innloggingslenke". Intro text mentions parents, teachers, students and administrators. Always shows "Sjekk e-posten din" after submit.
- A link is sent when the email belongs to an admin, a guardian (parent or teacher) or a student `child_email`. Nothing is sent for unknown emails.
- `/min-side/auth/bekreft` redirects to `next` when it is a safe local path, else `/admin` for admins, else `/min-side`. The locale of the link is kept.
- Admin shell shows a "Min side" link when the admin is also a guardian or student. Min side shows an "Administrasjon" link for admins.

**Users and access, `/admin/brukere` (AUTH-12, AUTH-13, AUTH-14, AUTH-15, SEC-18)**
- Heading "Brukere og tilganger". Form "Gi administratortilgang" with fields "Navn" and "E-post", button "Gi tilgang". Works for a brand new email and for an email that already has a portal login. Sends a login link.
- Each admin row: "Fjern administratortilgang" (not shown for yourself; server refuses the last admin) and "Gjør til lærer".
- Rows show badges "Admin", "Lærer", "Foresatt" for what the person is.

**Teachers, `/admin/laerere` (TCH-01, TCH-02, TCH-14, TCH-15, AUTH-02)**
- Button "Legg til lærer" opens a form: "Fornavn", "Etternavn", "E-post", "Telefon", checkbox "Send innloggingslenke nå" (checked). An exact (case-insensitive) email match links the existing guardian or admin instead of creating a new person, and the toast names who was linked. Two or more guardian matches: error asking the admin to pick from the family page.
- Row menu: "Rediger" (Fornavn, Etternavn, E-post, Telefon, Notat), "Send innloggingslenke", "Fjern som lærer".
- Saving a new email also updates that person's `auth.users` email when a login exists.
- "Fjern som lærer" removes the class links (D1). The class page never lists a guardian with `is_teacher = false`.
- Registering from an application marks the application as handled.

**Families and students (FAM-03, FAM-05, FAM-06, FAM-09, FAM-10, FAM-11, FAM-12, FAM-13, FAM-14, FAM-15, FAM-24)**
- Family page: per saved guardian "Fjern foresatt" (D3) and a "Lærer" toggle. Family actions: "Slå sammen med annen familie" (D4). Duplicate reviews get a "Slå sammen" button.
- Student page: "Flytt til annen familie" (D5). Field "Elevens e-post (innlogging)" edits `child_email`.
- "Ny elev" lets the admin pick an existing family instead of always creating a new one.
- Enrollment and admission: a returning child (same first name, last name and birth date in a family with the same guardian email) is linked to the existing student instead of creating a new one.
- Guardian and child edits are the source of truth. Register page and receipts read from `guardians`/`students`, not from stale `student_applications` copies.
- Withdraw ("Eleven har sluttet"): planned unpaid installments for that student stop being billed, and the student page shows the outstanding amount with a "Gi fritak" shortcut. Removing a placement deletes the fee when nothing is paid, and refuses with a message when money is allocated.
- Deleting a student with payments is refused with "Eleven har betalinger og kan ikke slettes".

**Classes and school years (CLS-01, CLS-04, CLS-13, CLS-17, CLS-18, CLS-26)**
- Class form saves without an English name.
- Updating a class revalidates the public class pages.
- Activating a school year shows a confirmation that says how many teacher assignments will be copied.
- Moving a student to another class warns when the age is outside the class range, and updates the fee to the new class price when nothing is paid yet.
- Admins can open `/min-side/klasse/[classId]` for any class.

**Portal**
- Parent child page `/min-side/barn/[studentId]`: sections "Oppmøte" (every school day this year with status) and "Ukenotater" (all notes this year, newest first).
- Student login lands on `/min-side` with a "Min skole" view: own class, notes this year, own attendance. No payment data.

## Test layout

- `supabase/tests/access_integrity.sql` and friends: D1 to D14. Run with `npm run test:db` against the local stack.
- `tests/e2e/*.spec.ts`: Playwright against `next dev -p 3100` wired to the local Supabase stack (never prod), with `EMAIL_OUTBOX_DIR` set. Seed data uses ZZTEST names and `@zztest.local` emails.
- `tests/*.test.mjs`: unit tests for pure helpers (post-login path, safe `next`).
