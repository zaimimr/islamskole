# User stories

Audit of the admin, teacher and parent flows done on 2026-09-29. We read the code and ran SELECT-only queries against prod. Each story has a status, evidence (file:line or SQL facts), Given/When/Then acceptance criteria, a test type and a priority, so it can be turned straight into a Playwright or integration test.

| File | Area | Stories |
| --- | --- | --- |
| [auth.md](auth.md) | Login, magic links, roles, admin + teacher + parent in one person | AUTH-01..28 |
| [teachers.md](teachers.md) | Teacher lifecycle: apply, register, edit, remove, class links | TCH-01..28 |
| [families.md](families.md) | Guardians, families, students, Mine barn | FAM-01..27 |
| [classes.md](classes.md) | Classes, school years, rollover, Min klasse | CLS-01..28 |
| [authorization.md](authorization.md) | Permission matrix, server action inventory, orphan data, boundaries | SEC-01..29 |

Status: WORKS 46, PARTIAL 45, BROKEN 21, MISSING 22, UNVERIFIED 6.
Priority: P0 = data leak, data loss or blocks a core flow. P1 = important. P2 = polish.

## Fix first (P0 not working)

- CLS-21 / SEC-21: deleting a school year cascade-deletes fees, allocations, plans, attendance and notes.
- TCH-03 / TCH-04: removing a teacher only clears `is_teacher`. Class links stay, the class page shows a ghost teacher, and re-registering brings every old link back.
- FAM-06: a saved guardian can never be removed from a family.
- FAM-03 / AUTH-22 / TCH-02: changing an email does not reliably move access. The old address keeps access if the same email sits on a guardian in another family.
- AUTH-23 / SEC-24: shared guardian emails across families (16 emails in prod). Whoever owns the mailbox sees every linked child.
- AUTH-05: magic link email goes through Supabase Auth SMTP set in the dashboard, not Resend. Delivery to real parents is unverified.
- AUTH-24: confirm public signup is off in the hosted project (local config has it on).

## The owner's own questions

- **Why must I give teachers a link?** Teachers can already log in on `/min-side/logg-inn` with their own email, but nothing tells them and `/login` does not link there. Missing: an automatic invite on register or class assignment, and one login page that routes by role. See AUTH-01, AUTH-02, AUTH-03.
- **Can a teacher be admin?** Only if the admin account was created first. An existing parent or teacher cannot be promoted (`createUser` fails with `email_exists`), and an admin cannot be demoted, only deleted. No links between the admin area and Min side. See AUTH-12, AUTH-13, AUTH-14, AUTH-16, SEC-18.
- **Edit teacher name, email, phone?** Not possible from the teacher list. Only through the family editor, so a teacher with no family cannot be edited at all. See TCH-01, TCH-02.
- **Delete teacher removes class link?** No. See TCH-03, TCH-04. Portal access does end at once (TCH-05 works).

## Other broken or missing P1

- SEC-11: an admin email is also a parent email, so a passwordless Min side magic link gives a full admin session.
- CLS-01: saving a class without an English name fails, `classes.name_en` is NOT NULL.
- CLS-17 / CLS-18 / TCH-10: activating a new school year drops every teacher assignment, so Min klasse and Mine barn go empty with no warning.
- AUTH-08: the shared 60-per-hour magic link cap counts unknown emails, so one IP can lock out all parents.
- FAM-05: edits never reach `student_applications`, and the register page and receipts read the stale copy.
- FAM-09 / FAM-24 / FAM-10 / FAM-11 / FAM-12: every signup makes a new family, and there is no merge, move child or add sibling.
- FAM-15: withdrawing or unplacing a student leaves the fee, and the installment cron keeps billing.
- CLS-26: admins get a 404 on the class portal and cannot fix notes or attendance.
- TCH-14: registering a teacher from an application does not close the application.
- SEC-19: flags `test-admin@islamskole.no` in prod. It is the deliberate smoke-test login, so decide whether to keep it.

## Overlapping stories

Several auditors hit the same issue from different sides. Write one test per theme and link the rest.

- Teacher removal: TCH-03, TCH-04, TCH-05, AUTH-20, CLS-10, SEC-06
- Email change: TCH-02, FAM-03, AUTH-22, SEC-04
- Shared emails: AUTH-23, SEC-24, FAM-09
- Rollover: CLS-17, CLS-18, TCH-10, FAM-23
- Deletes and money: CLS-21, SEC-20, SEC-21, FAM-13
- Admin roles: AUTH-12, AUTH-13, AUTH-14, SEC-18
- Parent sees only own children: FAM-01, FAM-02, SEC-03, CLS-25

## Test rules

Use only `test-admin@islamskole.no` and ZZTEST records, and clean them up afterwards. Never create auth logins for real parent emails.
