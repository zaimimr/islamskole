# Islamskole: authorization and data integrity audit

Audit date: 2026-09-29. Read-only. Sources: code on `main` (e4802fa), prod Supabase (project shryfgcxydlhgyhcbryq) via SELECT-only queries, security advisor, and the public `/auth/v1/settings` endpoint. Anonymous REST probes (GET with the publishable key) were run against 9 tables.

## How identity and roles work (the model the stories test)

- **Admin** = `profiles.role = 'admin'`. Checked live on every call by `getIsAdmin()` (`src/lib/auth.ts:15-25`) and in SQL by `is_admin()` (SECURITY DEFINER, `search_path=public`). `handle_new_user` copies `app_metadata.role` into `profiles` (only the service role can set app_metadata). `createUser` always creates admins (`src/app/[locale]/admin/actions.ts:906-937`).
- **Parent / teacher** = the JWT email matches a `guardians.email` row (`portal_guardian_ids()`, it skips the placeholder `mangler@islamskole.no`). A parent is linked to children through `student_guardians`. A teacher is a guardian with `is_teacher = true` plus a `class_teachers` row for the **active** school year.
- Portal logins are magic links only (`src/lib/portal/actions.ts:108-125`, `src/app/[locale]/min-side/auth/bekreft/route.ts`). Admin login is email + password on the client (`src/app/[locale]/login/page.tsx:43`).
- Auth settings (prod): `disable_signup: true`, `mailer_autoconfirm: false`, anonymous users off. So nobody can sign themselves up with someone else's email.
- The proxy (`src/proxy.ts:31-42`) only redirects **signed-out GET** requests to `/admin`. Role checks happen in `src/app/[locale]/admin/layout.tsx:78-85`, in every server action, and in RLS. `/api/*` is excluded from the proxy matcher (`src/proxy.ts:47`).

## 1. Permission matrix

Legend: Y = allowed, N = denied, own = only their own family or class, RLS = the server action does not check the role itself and relies on RLS to refuse.

| Capability | Anonymous | Parent | Teacher | Teacher + parent | Admin | Admin + teacher/parent | Revoked (see notes) |
|---|---|---|---|---|---|---|---|
| Read public site (published classes, events, info, settings) | Y | Y | Y | Y | Y | Y | Y |
| Submit enrollment (`createStudentEnrollment`) | Y (rate limit + honeypot) | Y | Y | Y | Y | Y | Y |
| Submit teacher application | Y (rate limit + honeypot) | Y | Y | Y | Y | Y | Y |
| Pay a Vipps link `/api/vipps/pay/[id]` | Y (anyone holding the UUID) | Y | Y | Y | Y | Y | Y |
| Request portal magic link | Y (only emails that match a guardian get mail, and the response is always the same) | Y | Y | Y | Y | Y | N (no mail once the guardian email is gone) |
| See own children (`portal_my_children`, incl. `remaining_ore`) | N | own | N | own | N (unless also guardian) | own | N immediately if the guardian link or email is removed; a deleted auth user keeps access until the JWT expires |
| Report / withdraw absence | N | own, open days only | N | own | Y (policy `admin all`) | Y | as above |
| Read class notes (homework) | N | own child's class | own class | both | Y | Y | N |
| Write class notes | N | N | own class, active year | own class | Y | Y | N once `is_teacher=false` or the `class_teachers` row is removed |
| Mark attendance | N | N | own class, active year, **any day incl. cancelled/future** | own class | Y | Y | N once revoked |
| Class roster with guardian contacts (`portal_class_roster`) | N | N | own class | own class | Y | Y | N |
| Read `school_days` table | N | Y (all rows) | Y | Y | Y | Y | Y while the JWT is valid |
| Enter `/admin` UI | N (redirect to login) | N (redirect `?ingen-tilgang=1`) | N | N | Y | Y | N at the next request after the profile is deleted or demoted |
| Any admin server action (events, classes, students, payments, families, sadaqa, school years, users) | N | N | N | N | Y | Y | N |
| `/api/export/[entity]` CSV | N (403) | N (403) | N | N | Y | Y | N |
| Create / reset / delete admin users | N | N | N | N | Y (cannot delete self) | Y | N |
| Demote an admin to member | - | - | - | - | **no UI or action exists** | - | - |
| Cron endpoints | only with `Authorization: Bearer CRON_SECRET` | same | same | same | same | same | same |
| Vipps webhook | only with a valid HMAC (fails closed with 503 if the secret is missing outside dev) | same | same | same | same | same | same |
| Direct PostgREST with the anon/publishable key on family/finance tables | N (200 with `[]`, confirmed for students, guardians, payments, families, student_balances, profiles, audit_log, school_years) | N (admin-only policies) | N | N | Y | Y | N |

"Admin + parent" note: 1 admin account's email is also a guardian email in prod. That person can get a **full admin session from a portal magic link** (email only, no password), because the admin layout accepts any session whose profile is admin.

## 2. Server action inventory

Admin check styles: **A** = `requireAdmin()` returning `{ok:false}`, **A!** = `requireAdmin()` that throws, **G** = inline `getIsAdmin()`. Client: **RLS** = `createClient()` (user session, RLS applies), **SR** = `createAdminClient()` (service role, bypasses RLS). All actions write the audit log through the service role (`src/lib/audit.ts`).

| Action | File:line | Check | Client | Input validation |
|---|---|---|---|---|
| createEvent / updateEvent / deleteEvent | admin/actions.ts:123 / 176 / 230 | A | RLS | zod (create/update) |
| createClass / updateClass / deleteClass / reorderClasses | admin/actions.ts:245 / 295 / 346 / 1036 | A | RLS | zod |
| updateSettings | admin/actions.ts:361 | A | RLS | zod |
| createTeacherApplication | admin/actions.ts:418 | **none (public)**, in-memory rate limit, honeypot, time trap | SR insert | zod name + email |
| updateTeacherApplicationStatus / deleteTeacherApplication / bulkUpdateTeacherStatus | admin/actions.ts:482 / 513 / 1089 | A | RLS | zod enum |
| createStudentEnrollment | admin/actions.ts:563 | **none (public)**, rate limit, honeypot, terms | SR + RPC `create_public_family_enrollment` (service role only) | zod per guardian/child, max 6 guardians |
| updateStudentApplicationStatus / deleteStudentApplication / bulkUpdateApplicationStatus | admin/actions.ts:834 / 864 / 1057 | A | RLS | enum; delete blocked if a payment exists |
| createUser | admin/actions.ts:906 | A | SR (auth admin), always `role: admin` | zod email |
| resetUserPassword | admin/actions.ts:939 | A | SR, any user id | none on id |
| deleteUser | admin/actions.ts:956 | A, blocks self | SR | none on id |
| changeOwnPassword | admin/actions.ts:978 | any signed-in user, re-verifies current password | RLS session | length, confirm |
| searchAdmin | admin/actions.ts:1137 | A | RLS | trimmed |
| signOut | admin/actions.ts:1333 | none needed | RLS | - |
| assignTeacher / removeTeacher (class link) / setSchoolDayCancelled / generateSchoolDays | admin/portal-admin-actions.ts:46 / 94 / 126 / 156 | A | RLS | zod uuid |
| sendLoginLinkToGuardian | admin/portal-admin-actions.ts:181 | A | SR (creates member auth user) + OTP | zod uuid + email |
| createSchoolYear / updateSchoolYear / setActiveSchoolYear / deleteSchoolYear | admin/school-years-actions.ts:55 / 113 / 163 / 176 | A! (throws) | RLS + RPC `set_active_school_year` (checks `is_admin`) | zod label |
| Student CRUD: createStudent, createStudentFromApplication, updateStudent, getStudentDeleteBlockers, deleteStudent, archiveStudent | admin/students-actions.ts:216 / 245 / 404 / 448 / 482 / 525 | A | RLS (+ RPC `create_manual_family_student`, checks admin) | zod |
| Enrollment: getClassCapacityInfo, placeStudentInClass, changeEnrollmentClass, endEnrollment, removeEnrollment, confirmRollover | admin/students-actions.ts:632 / 666 / 778 / 841 / 873 / 1626 | A (capacity returns `[]`) | RLS (+ RPC `rollover_enrollments`, checks admin) | partial |
| Payments: createVippsPayment, registerManualPayment, previewBatchSend, batchSendPaymentLinks, syncAllPaymentsForYear, syncPaymentStatus, captureVippsPayment, refundPaymentAction, cancelVippsPayment, sendPaymentLink, deletePayment, voidPayment, restorePayment, markPaymentAsDuplicate, keepPaymentAsSeparate, reallocatePayment, reallocateYearPayments, updatePaymentAllocations | admin/students-actions.ts:906-2640 | A | RLS (+ RPC `replace_payment_allocations`, checks admin) | zod on money inputs; delete blocked when captured |
| Fees: updateStudentFee, grantFeeAdjustment, revokeFeeAdjustment | admin/students-actions.ts:2228 / 2271 / 2340 | A | RLS | zod |
| sendWelcomeEmail | admin/students-actions.ts:2710 | A | RLS | - |
| registerFamilyPayment | admin/betaling/finance-actions.ts:47 | G | RLS | zod |
| Families: updateFamilyRelationships, assignPaymentPlanAction, endPaymentPlan, setPlanPaused, stopInstallment, reopenInstallment, sendInstallmentNow, approveSiblingDiscount, dismissSiblingSuggestion, updateGuardianRoles, registerTeacher, removeTeacher (is_teacher=false) | admin/familier/families-actions.ts:32-560 | G | RLS (+ RPC `update_family_relationships`, checks admin) | partial; `registerTeacher` matches email with an unescaped `ilike` (line 510) |
| admitApplications / markApplicationsAsSpam | admin/register/register-actions.ts:20 / 57 | G | RLS | ids |
| Sadaqa: coverWithSadaqa, recordSadaqaGift, voidSadaqaGift, convertOverpaymentToGift | admin/betaling/sadaqa/sadaqa-actions.ts:55 / 180 / 238 / 322 | A | RLS | zod |
| sendPortalLoginLink | lib/portal/actions.ts:108 | **public**, DB throttle `portal_login_hit` (ip 5/min, email 3/10 min, global 60/h), honeypot | SR lookup + OTP (`shouldCreateUser:false`) | zod email |
| signOutPortal | lib/portal/actions.ts:127 | none needed | RLS | - |
| markAttendance / markAttendanceMany | lib/portal/actions.ts:139 / 182 | signed in, then RLS (`portal_can_mark`) | RLS | zod uuid, enum, max 200 |
| saveClassNote | lib/portal/actions.ts:228 | signed in, then RLS (`portal_is_teacher_of`) | RLS | zod, max 2000 chars |
| reportAbsence / withdrawAbsence | lib/portal/actions.ts:271 / 307 | signed in + has guardian ids, then RLS (open school day) | RLS | zod |

Route handlers:

| Route | File:line | Check | Client |
|---|---|---|---|
| GET /api/export/[entity] | api/export/[entity]/route.ts:298-311 | `getIsAdmin()`, 403 otherwise, 404 for unknown entity | RLS (double guard) |
| GET /api/cron/installments | api/cron/installments/route.ts:22-27 | Bearer `CRON_SECRET`, fails closed if unset; plain `===` compare | SR |
| GET /api/cron/vipps-sync | api/cron/vipps-sync/route.ts:13-24 | same | SR |
| POST /api/vipps/webhook | api/vipps/webhook/route.ts:10-58 | HMAC signature (required outside dev), MSN check | SR via sync |
| GET /api/vipps/return | api/vipps/return/route.ts:6 | **none**; any `reference` triggers a Vipps sync and may set `families.preferred_language` | SR |
| GET /api/vipps/pay/[id] | api/vipps/pay/[id]/route.ts:116 | **none (bearer link)**, in-memory rate limit 10/min/IP; recalculates amount and may rewrite `payment_targets` | SR |
| GET /[locale]/min-side/auth/bekreft | min-side/auth/bekreft/route.ts | `verifyOtp` token hash | RLS session |
| GET /.well-known/vercel/flags | .well-known/vercel/flags/route.ts | `createFlagsDiscoveryEndpoint` (FLAGS_SECRET, library) | - |

Database facts:

- RLS is on for all 35 public tables. The 5 views (`student_balances`, `duplicate_payment_candidates`, `fee_adjustment_totals`, `teacher_gift_report`, `sadaqa_disbursements`) all have `security_invoker=true`.
- `anon` and `authenticated` keep broad table grants (SELECT/INSERT/UPDATE/DELETE) on almost every table, so RLS is the **only** barrier. Any table added later without a policy that is also missing RLS would be fully open.
- 24 SECURITY DEFINER functions, all with a pinned `search_path`. The 15 that `authenticated` can execute either check `is_admin()` / `service_role` (`create_manual_family_student`, `replace_payment_allocations`, `rollover_enrollments`, `update_family_relationships`, `portal_class_roster`) or only return data about the caller (`portal_*`). `create_public_family_enrollment` and `portal_login_hit` can only be run by the service role. `is_admin()` can be run by `anon` (advisor WARN, harmless: returns false).
- Advisor: leaked-password protection is disabled (WARN). `portal_login_throttle` has RLS with no policy (intended: only the service role uses it).
- Cascades that matter: `payments.student_id ON DELETE CASCADE`, `payment_allocations.student_id CASCADE`, `payment_allocations.school_year_id CASCADE`, `student_fees.school_year_id CASCADE`, `installments/payment_plans.school_year_id CASCADE`, `school_days.school_year_id CASCADE` (then attendance and absence reports cascade). Only application code (`getStudentDeleteBlockers`, `enrollments` RESTRICT) stops a student or school-year delete from wiping money history.

## 3. Orphan and integrity data found in prod (counts only)

| Check | Count |
|---|---|
| auth users total | 5 |
| admin profiles / member profiles | 4 / 1 |
| admin accounts with "test" in the email | 1 |
| admin accounts whose email is also a guardian email (magic link gives admin) | 1 |
| auth users without profile | 0 |
| unconfirmed auth users | 0 |
| member logins matching no guardian (stale portal accounts) | 0 |
| users not signed in for 90+ days or never | 1 |
| students without family | 0 |
| students without any `student_guardians` link | 0 |
| students without source application (manual) | 2 |
| guardians without any family | 2 (1 teacher, 1 non-teacher = true orphan) |
| families without guardians | 0 |
| families without students or applications | 0 |
| guardians with placeholder or empty email (cannot log in) | 5 |
| email addresses used by more than one guardian row | 16 |
| email addresses linked to more than one family | 13 (12 share the same address = duplicate family records, 1 has different addresses) |
| teacher guardians / teachers without a class / class links to non-teachers / class teachers without a login email | 2 / 0 / 0 / 0 |
| payments linked to nothing (no student, allocation, target, installment or application) | 8 (all Vipps `avbrutt`, not voided) |
| captured non-voided payments without allocation | 0 |
| allocations on voided payments (the balance view counts them as 0) | 12 |
| attendance rows without a matching enrollment | 0 |
| class notes without author | 0 |
| audit rows without actor (public or cron writes) | 18 |
| active school years | 1 |

## 4. User stories

### SEC-01: Only admins can run admin server actions
**Som** skoleadministrator **vil jeg** at bare admin-kontoer kan kjøre admin-handlinger **slik at** foreldre og lærere ikke kan endre elever, betalinger eller innstillinger ved å kalle handlingene direkte.
Status: WORKS
Evidence: every exported function in the 8 admin action files calls `requireAdmin()` or `getIsAdmin()` first (inventory above); the layout check (`admin/layout.tsx:78-85`) is not the only guard.
Acceptance criteria:
- Given a signed-in member (parent magic link session), When it POSTs a Next server action for `deleteStudent`, `registerManualPayment`, `createUser` or `updateSettings` with a valid action id, Then the response is `{ok:false}` (or a thrown "Ikke autorisert" for school years) and no row changes.
- Given an anonymous request, When the same actions are called, Then the error says the user is logged out and nothing changes.
- Given an admin session, When the same actions are called with valid input, Then they succeed.
- A generated test lists every `export async function` in `"use server"` admin files and fails if one does not deny a member session.
Test type: integration (server action)
Priority: P0

### SEC-02: RLS blocks direct REST access to family and finance data
**Som** forelder **vil jeg** at ingen kan lese andre familiers data med den offentlige nøkkelen **slik at** personopplysninger om barn og betalinger holdes private.
Status: WORKS
Evidence: prod anon GET on students, guardians, payments, families, student_balances, profiles, audit_log returned 200 `[]`; all family/finance policies are `is_admin()`; views are `security_invoker`.
Acceptance criteria:
- Given the publishable key and no session, When selecting from every table and view in `public`, Then only `classes`/`events` (published), `info_blocks` and `site_settings` return rows.
- Given a parent's JWT, When selecting from `students`, `guardians`, `payments`, `student_balances`, `families`, `audit_log`, Then zero rows are returned.
- Given a parent's JWT, When inserting into `payments` or updating `students`, Then Postgres returns 42501 or 0 rows affected.
- A schema test fails if any `public` table has `relrowsecurity = false` or any view lacks `security_invoker=true`.
Test type: integration (RLS)
Priority: P0

### SEC-03: A parent sees only their own children in Min side
**Som** forelder **vil jeg** bare se mine egne barn på Min side **slik at** jeg ikke får innsyn i andre familier.
Status: WORKS
Evidence: `portal_my_children` filters on `student_guardians` + `portal_guardian_ids()`; `min-side/barn/[studentId]/page.tsx:26-34` calls `notFound()` for children not in the list.
Acceptance criteria:
- Given parent A signed in, When opening `/min-side/barn/<child-of-family-B>`, Then a 404 is shown.
- Given parent A, When calling `rpc/portal_my_children`, Then only children linked to A's guardian row(s) are returned.
- Given parent A, When calling `rpc/portal_is_guardian_of` for a child of B, Then false is returned.
Test type: e2e (Playwright) + integration (RLS)
Priority: P0

### SEC-04: Access disappears as soon as the guardian link is removed
**Som** administrator **vil jeg** at en forelder mister tilgang straks jeg fjerner dem fra familien eller endrer e-posten **slik at** feil person ikke ser barnet.
Status: WORKS (DB lookups are live), with a gap for deleted auth users (see SEC-17)
Evidence: `portal_guardian_ids()` matches `auth.jwt()->>'email'` against `guardians.email` on every query.
Acceptance criteria:
- Given a parent signed in, When the admin changes that guardian's email, Then the parent's next request to `/min-side` shows no children.
- Given a parent signed in, When the admin removes the `student_guardians` link, Then `/min-side/barn/<id>` returns 404 and absence reporting is refused.
- Given the guardian email is `mangler@islamskole.no`, When someone logs in with that address, Then no children are shown.
Test type: integration (RLS)
Priority: P1

### SEC-05: Teachers only reach their own class in the active year
**Som** lærer **vil jeg** bare se og føre oppmøte for min egen klasse **slik at** elevdata i andre klasser er skjermet.
Status: WORKS
Evidence: `portal_is_teacher_of` and `portal_can_mark` need `g.is_teacher`, a `class_teachers` row and `sy.is_active`; `portal_class_roster` raises 42501 otherwise; `min-side/klasse/[classId]/page.tsx:40` 404s.
Acceptance criteria:
- Given teacher T of class A, When opening `/min-side/klasse/<class B>`, Then a 404 is shown.
- Given teacher T, When calling `markAttendance` for a student in class B, Then `forbidden` is returned and no attendance row exists.
- Given teacher T, When calling `rpc/portal_class_roster` for class B, Then error 42501.
- Given T's class link is for last year only, When T signs in, Then no class is listed.
Test type: integration (RLS) + e2e
Priority: P0

### SEC-06: Removing a teacher revokes portal access at once
**Som** administrator **vil jeg** at en lærer jeg fjerner mister tilgang til klassen umiddelbart **slik at** tidligere lærere ikke ser elevlister eller foresattes kontaktinfo.
Status: WORKS
Evidence: `families-actions.ts:560` sets `is_teacher=false`, `portal-admin-actions.ts:94` deletes the `class_teachers` row; both are checked live. Prod: 0 class links pointing at non-teachers.
Acceptance criteria:
- Given teacher T signed in, When admin runs `removeTeacher(guardianId)`, Then T's next `saveClassNote` returns `forbidden` and `/min-side` shows no class.
- Given teacher T signed in, When admin removes the class link, Then the roster RPC raises 42501.
- Given T is also a parent, When T is removed as teacher, Then T still sees their own children.
Test type: integration (RLS)
Priority: P1

### SEC-07: Teacher who is also a parent gets both views without mixing data
**Som** lærer som også er forelder **vil jeg** se både mine barn og min klasse **slik at** jeg slipper to kontoer, uten å få foreldrerettigheter i klassen eller lærerrettigheter for mine barn i andre klasser.
Status: WORKS
Evidence: `min-side/page.tsx:25-40` renders both homes; rights are computed per policy (guardian vs teacher functions are separate).
Acceptance criteria:
- Given a user who is guardian of child X (class B) and teacher of class A, When opening `/min-side`, Then both "Mine barn" and "Min klasse" appear.
- Given that user, When marking attendance for child X in class B, Then it is refused.
- Given that user, When reporting absence for a child in class A that is not theirs, Then it is refused.
Test type: e2e (Playwright)
Priority: P2

### SEC-08: Attendance can only be marked on real school days
**Som** skoleleder **vil jeg** at lærere bare kan føre oppmøte på skoledager som faktisk ble holdt **slik at** fraværsstatistikken blir riktig.
Status: PARTIAL
Evidence: `portal_can_mark` checks class and active year only; it does not check `school_days.cancelled` or that the date is today or earlier (compare `portal_is_open_school_day`, which does check both for absence).
Acceptance criteria:
- Given a cancelled school day, When a teacher calls `markAttendance`, Then `forbidden` is returned.
- Given a school day next month, When a teacher calls `markAttendance`, Then `forbidden` is returned.
- Given today's school day, When the teacher marks a student, Then the row is saved with `marked_by` = the teacher's uid (set by trigger `attendance_stamp_marker`).
Test type: integration (RLS)
Priority: P2

### SEC-09: Absence can only be reported and withdrawn for open days
**Som** forelder **vil jeg** melde og trekke fravær for mitt barn frem til skoledagen **slik at** læreren vet hvem som kommer, uten at jeg kan endre historikk.
Status: WORKS (minor: UPDATE grant includes `reason`, so a parent can edit the reason of an open report through REST)
Evidence: policies `guardian reports child` / `guardian withdraws child` use `portal_is_open_school_day`; column UPDATE grant is `withdrawn_at, reason`.
Acceptance criteria:
- Given yesterday's school day, When a parent calls `reportAbsence`, Then error `closed`.
- Given an open day, When the parent reports and then withdraws, Then `withdrawn_at` is set and the teacher's roster shows the child as expected.
- Given another family's child, When the parent calls `reportAbsence`, Then it is refused.
- Given a withdrawn report, When the parent tries to update it again, Then 0 rows change.
Test type: integration (RLS)
Priority: P2

### SEC-10: Magic link requests do not reveal who is a parent
**Som** forelder **vil jeg** at innloggingssiden ikke avslører om en e-post finnes hos skolen **slik at** uvedkommende ikke kan kartlegge familier.
Status: WORKS
Evidence: `sendPortalLoginLink` returns `{ok:true}` for every valid email and does the lookup in `after()` (`src/lib/portal/actions.ts:108-125`); DB throttle per IP (5/min), per email (3/10 min), global (60/h); `shouldCreateUser:false`; signups are disabled in prod.
Acceptance criteria:
- Given an unknown email, When submitting the login form, Then the same success message is shown as for a known email and no auth user is created.
- Given 6 submits from one IP within a minute, Then the 6th returns `rate_limited`.
- Given a known guardian email, When submitting 4 times within 10 minutes, Then at most 3 emails are sent.
- Given the honeypot is filled or the form is sent under 2 s, Then success is shown and no email is sent.
Test type: integration (server action)
Priority: P1

### SEC-11: A portal magic link must not open the admin area
**Som** administrator **vil jeg** at admin-tilgang krever passord **slik at** en forelder-lenke til en admin-e-post ikke gir full admintilgang.
Status: BROKEN
Evidence: 1 admin account's email is also a guardian email in prod. `deliverLoginLink` sends a magic link to any guardian email, and `admin/layout.tsx:78-85` accepts any session whose profile is admin, so that link gives a full admin session with no password.
Acceptance criteria:
- Given an admin whose email is also a guardian email, When they sign in through `/min-side/logg-inn` with a magic link, Then `/admin` redirects to `/login` (or asks for a password) and admin actions return denied.
- Given the same admin, When they sign in with a password at `/login`, Then `/admin` works.
- Given any admin session created by OTP (`amr` = otp/magiclink), Then `getIsAdmin()` returns false.
Test type: integration (auth) + e2e
Priority: P1

### SEC-12: Signed-out and wrong-role users are kept out of /admin pages
**Som** administrator **vil jeg** at admin-sidene er stengt for alle andre **slik at** ingen ser elevlister via nettleseren.
Status: WORKS (defence in depth: proxy redirect, layout redirect, RLS client in pages; `brukere/page.tsx:70` has its own check because it uses the service role)
Evidence: `src/proxy.ts:31-42`, `admin/layout.tsx:78-85`. Admin pages read through `createClient()`, so a page rendered in parallel with the layout still gets no rows for a non-admin. The only admin page using the service role is `brukere`, and it calls `notFound()` for non-admins.
Acceptance criteria:
- Given no session, When GET `/admin/elever`, Then redirect to `/login?next=/admin/elever`.
- Given a parent session, When GET `/admin/elever`, Then redirect to `/login?ingen-tilgang=1` and the HTML/RSC payload has no student names.
- Given a parent session, When fetching the RSC payload of `/admin/brukere` directly, Then 404 and no emails in the body.
- A lint test fails if a page under `admin/` imports `createAdminClient` without a `getIsAdmin()` check.
Test type: e2e (Playwright)
Priority: P0

### SEC-13: CSV export is admin only
**Som** administrator **vil jeg** at bare admin kan laste ned elev-, søknads-, lærer- og regnskapseksport **slik at** en lenke som deles ikke lekker persondata.
Status: WORKS (UX note: `/api` is outside the proxy matcher, so an admin whose access token has just expired gets 403 until another page refreshes the cookie)
Evidence: `api/export/[entity]/route.ts:298-311` checks `getIsAdmin()` before any query and uses the RLS client; CSV cells starting with `= + - @` are prefixed (line 108-117).
Acceptance criteria:
- Given no session, When GET `/api/export/students`, Then 403 and an empty body.
- Given a parent session, When GET `/api/export/payments?fra=2026-01-01&til=2026-12-31`, Then 403.
- Given an admin, When GET `/api/export/unknown`, Then 404.
- Given a student note starting with `=HYPERLINK(`, When exported, Then the cell starts with `'`.
Test type: integration (route handler)
Priority: P0

### SEC-14: Cron endpoints refuse calls without the secret
**Som** skoleadministrator **vil jeg** at purringer og Vipps-synk bare kan startes av planleggeren **slik at** ingen kan sende e-poster til alle familier ved å kalle en URL.
Status: WORKS (plain string compare instead of a timing-safe compare; low risk)
Evidence: `api/cron/installments/route.ts:22-27`, `api/cron/vipps-sync/route.ts:13-24`; returns false when `CRON_SECRET` is unset.
Acceptance criteria:
- Given no Authorization header, When GET `/api/cron/installments`, Then 401 and no email is sent.
- Given `Bearer wrong`, Then 401.
- Given `CRON_SECRET` unset in the environment, When called with any header, Then 401.
- Given the correct secret, Then 200 with counts.
Test type: integration (route handler)
Priority: P1

### SEC-15: Vipps webhook only accepts signed calls
**Som** kasserer **vil jeg** at bare ekte Vipps-varsler kan endre betalingsstatus **slik at** ingen kan merke en betaling som betalt.
Status: WORKS
Evidence: `api/vipps/webhook/route.ts:10-58`: HMAC check, fails closed (503) outside dev when the secret is missing, MSN check, then re-reads state from Vipps (`syncPaymentByReference`) instead of trusting the body.
Acceptance criteria:
- Given a body with a wrong signature, When POSTed, Then 401 and no payment changes.
- Given `VIPPS_WEBHOOK_SECRET` unset and `NODE_ENV=production`, Then 503.
- Given a valid signature for another merchant (MSN), Then 400.
- Given a valid event, Then the payment status matches what the Vipps API reports, not the payload.
Test type: integration (route handler)
Priority: P0

### SEC-16: Public payment links are safe to share
**Som** forelder **vil jeg** betale via lenken i e-posten uten å logge inn **slik at** det er enkelt, uten at lenken kan brukes til å endre andres beløp.
Status: PARTIAL
Evidence: `/api/vipps/pay/[id]` is a bearer link keyed by the payment UUID (hard to guess), in-memory rate limit per instance (10/min/IP, reset on every cold start). It recalculates the amount from the live balance and can rewrite `payment_targets` and cancel the previous Vipps order. `/api/vipps/return` takes any `reference` without auth and triggers a Vipps sync plus a `families.preferred_language` write.
Acceptance criteria:
- Given a random UUID, When GET `/api/vipps/pay/<uuid>`, Then redirect to `/betaling/fullfort?state=ukjent` and no Vipps call.
- Given a voided or captured payment, Then redirect with `annullert` / `fanget` and no new Vipps order.
- Given a child whose balance is now 0, Then `oppgjort` and the old order is cancelled.
- Given 11 requests within a minute from one IP across instances, Then the 11th is refused (needs a shared store; fails today on multiple instances).
- Given `/api/vipps/return?reference=<unknown>`, Then no family row changes.
Test type: integration (route handler)
Priority: P1

### SEC-17: Deleted accounts lose access immediately
**Som** administrator **vil jeg** at en slettet bruker mister all tilgang med en gang **slik at** en tidligere admin eller forelder ikke kan fortsette i økten.
Status: PARTIAL
Evidence: `deleteUser` (`admin/actions.ts:956`) deletes the auth user; `profiles` cascades, so admin access ends at once. `getUser()` uses `getClaims()` (local JWT check), so a deleted **portal** user whose email still matches a guardian keeps portal access until the access token expires (default 1 h).
Acceptance criteria:
- Given admin B signed in, When admin A deletes B, Then B's next admin action returns denied.
- Given a parent signed in, When the admin deletes the parent's auth user, Then the next `/min-side` request shows no children (today: still shows them until the JWT expires).
- Given admin A, When A tries `deleteUser(A)`, Then "Du kan ikke slette din egen konto".
Test type: integration (auth)
Priority: P2

### SEC-18: Admins can be demoted, not only deleted
**Som** styreleder **vil jeg** kunne fjerne admin-rettigheter fra en person uten å slette kontoen **slik at** en frivillig som slutter mister tilgang, men historikken beholdes.
Status: MISSING
Evidence: no action updates `profiles.role`; `createUser` always sets `role: admin` (`admin/actions.ts:925`); `brukere/page.tsx:59` lists only admins. 4 admin profiles in prod, 1 of them a test account, 1 not signed in for 90+ days.
Acceptance criteria:
- Given admin A, When A demotes admin B, Then B's `profiles.role` is `member` and B's next admin request is denied.
- Given A is the last admin, When A demotes themself, Then it is refused.
- Given the demotion, Then an audit row `user.demote` with actor A exists.
Test type: integration (server action) + e2e
Priority: P2

### SEC-19: Test admin accounts do not live in production
**Som** skoleleder **vil jeg** at produksjon bare har ekte admin-kontoer **slik at** et lekket testpassord ikke gir tilgang til elevdata.
Status: BROKEN
Evidence: 1 admin profile in prod has "test" in its email (the smoke-test login). It has full admin rights through RLS.
Acceptance criteria:
- Given prod, When counting admin profiles whose email matches `%test%`, Then the result is 0 (or the account is disabled between test runs).
- Given the smoke test, When it finishes, Then the test admin's sessions are revoked.
Test type: integration (SQL check in CI)
Priority: P1

### SEC-20: Deleting a student never deletes money history
**Som** kasserer **vil jeg** at sletting av en elev aldri fjerner betalinger **slik at** regnskapet stemmer.
Status: PARTIAL
Evidence: `payments.student_id`, `payment_allocations.student_id`, `student_fees`, `installments`, `payment_targets` are all `ON DELETE CASCADE`. Only `getStudentDeleteBlockers` (`students-actions.ts:448-480`) stops it, and that is a check then delete with no transaction. Any other delete path (SQL, a future action, the earlier "phantom wipe" of `students`) removes payments silently.
Acceptance criteria:
- Given a student with any payment, allocation, refund, adjustment, installment or target, When `deleteStudent` runs, Then it is refused with the Norwegian blocker message.
- Given the same student, When an admin deletes the row directly through REST, Then Postgres refuses (FK RESTRICT) and no payment disappears.
- Given a student with no money records, When deleted, Then enrollments, attendance and absence reports go too and an audit row exists.
Test type: integration (RLS/DB)
Priority: P1

### SEC-21: Deleting a school year is blocked when it has financial data
**Som** administrator **vil jeg** ikke kunne slette et skoleår med gebyrer, planer eller betalingsfordelinger **slik at** saldoer ikke forsvinner.
Status: PARTIAL
Evidence: `deleteSchoolYear` (`school-years-actions.ts:176`) blocks the active year and relies on `enrollments` RESTRICT. `student_fees`, `payment_allocations`, `payment_plans`, `installments`, `class_teachers`, `school_days` (and through them attendance) cascade; `payments.school_year_id` is set to null.
Acceptance criteria:
- Given an inactive year with student fees but no enrollments, When deleted, Then it is refused.
- Given an inactive year with only payments, When deleted, Then it is refused (today the allocations would be removed).
- Given an empty inactive year, When deleted, Then it succeeds and an audit row exists.
- Given the active year, Then "Kan ikke slette det aktive skoleåret".
Test type: integration (server action)
Priority: P1

### SEC-22: Payments with captured money cannot be deleted
**Som** kasserer **vil jeg** at mottatte betalinger bare kan annulleres eller refunderes **slik at** sporbarheten beholdes.
Status: WORKS
Evidence: `deletePayment` (`students-actions.ts:2198-2226`) refuses when `capturedAmount > 0` or the status is `fanget`/`refundert`; `refunds.payment_id` and `sadaqa_gifts.source_payment_id` are RESTRICT. The balance view counts voided payments as 0 (12 allocations on voided payments in prod are correctly ignored).
Acceptance criteria:
- Given a captured Vipps payment, When `deletePayment` runs, Then it is refused.
- Given an uncaptured `opprettet` payment, When deleted, Then the Vipps order is cancelled first and the row is removed.
- Given a voided payment with allocations, Then `student_balances.paid` excludes it.
Test type: integration (server action)
Priority: P1

### SEC-23: Aborted Vipps payments do not pile up as orphans
**Som** kasserer **vil jeg** at avbrutte betalinger uten kobling ryddes eller vises **slik at** betalingslisten bare viser relevante rader.
Status: PARTIAL
Evidence: prod has 8 payments (all Vipps `avbrutt`, not voided) with no student, allocation, target, installment or application.
Acceptance criteria:
- Given a payment with no links, When the payments overview loads, Then it is hidden or flagged as "uten kobling".
- Given such a row older than 30 days, When a cleanup job runs, Then it is voided with an audit row.
- A prod SQL check reports the count and fails above an agreed threshold.
Test type: integration (SQL)
Priority: P2

### SEC-24: One email per guardian, one guardian per person
**Som** administrator **vil jeg** at samme e-post ikke ligger på flere foresatt-rader **slik at** innlogging, lærerregistrering og e-poster treffer riktig person.
Status: BROKEN (data)
Evidence: 16 emails are used by more than one guardian row; 13 emails link to more than one family (12 of them the same address, so duplicate family records; 1 with different addresses). `portal_guardian_ids()` returns all matches, so such a parent sees children from every family on that email. `registerTeacher` matches by `ilike` without escaping `_`/`%` (`families-actions.ts:510`), so an email with `_` can match the wrong guardian. `portal_my_children`/actions use `guardianIds[0]` as author.
Acceptance criteria:
- Given two guardian rows with the same email (any case), When a unique index on `lower(email)` (excluding the placeholder) is checked, Then there are no duplicates.
- Given an admin registers teacher `a_b@x.no` and a guardian `axb@x.no` exists, Then no existing guardian is changed.
- Given a parent whose email is on two families with different addresses, When they sign in, Then the admin has confirmed it (for example both parents in split households), or the data review page flags it.
Test type: integration (SQL + server action)
Priority: P1

### SEC-25: Orphan guardians are cleaned up
**Som** administrator **vil jeg** at foresatte uten familie og uten lærerrolle blir ryddet **slik at** gamle kontaktdata ikke blir liggende.
Status: PARTIAL
Evidence: 2 guardians have no family; 1 of them is not a teacher (true orphan, likely left after `removeTeacher` sets `is_teacher=false` without deleting the row). 5 guardians have a placeholder or empty email and can never log in.
Acceptance criteria:
- Given a teacher without a family, When the admin removes the teacher role, Then the guardian row is deleted or listed for cleanup.
- Given a nightly integrity check, Then it reports guardians with no family and no teacher role (expected 0).
- Given a guardian with a placeholder email, Then the families page shows "mangler e-post" so the admin can fix it.
Test type: integration (SQL)
Priority: P2

### SEC-26: Every sensitive admin action leaves an audit trail with actor
**Som** styreleder **vil jeg** se hvem som endret betalinger, elever og brukere **slik at** feil kan spores.
Status: PARTIAL
Evidence: `writeAudit` runs in `after()` with the service role and only logs failures to the console (`src/lib/audit.ts`); if the insert fails the action still reports success. 18 audit rows have no actor (expected for public enrollment and cron, not for admin actions). `audit_log` read is admin only.
Acceptance criteria:
- Given an admin runs `voidPayment`, Then an `audit_log` row with that admin's `actor_id` and `entity_id` exists within 5 s.
- Given a parent session, When selecting `audit_log`, Then 0 rows.
- Given `audit_log` rows with `actor_id IS NULL`, Then every one has an action from the public or cron allow-list.
Test type: integration (server action)
Priority: P2

### SEC-27: Public forms hold up against spam across server instances
**Som** administrator **vil jeg** at innmeldings- og lærerskjema ikke kan spammes **slik at** søknadslisten og e-postkvoten ikke fylles med søppel.
Status: PARTIAL
Evidence: `createStudentEnrollment` and `createTeacherApplication` share an in-memory `rateLimit("apply:<ip>", 5/min)` (`src/lib/rate-limit.ts`), which resets per serverless instance and cold start; honeypot and 2 s time trap are in place for both. The portal login uses a DB-backed throttle instead, which is the stronger pattern. Enrollment runs with the service role and creates families, guardians and payments on each submit.
Acceptance criteria:
- Given 6 enrollment submits from one IP within a minute, even when served by different instances, Then the 6th is refused.
- Given the honeypot field is filled, Then no family, guardian or payment row is created.
- Given the form is submitted under 2 s after load, Then nothing is stored.
Test type: integration (server action)
Priority: P2

### SEC-28: SECURITY DEFINER functions check the caller
**Som** utvikler **vil jeg** at alle SECURITY DEFINER-funksjoner sjekker hvem som kaller **slik at** en forelder ikke kan bruke en RPC til å endre data utenom RLS.
Status: WORKS
Evidence: all 24 have a pinned `search_path`. Writing RPCs callable by `authenticated` (`create_manual_family_student`, `replace_payment_allocations`, `rollover_enrollments`, `update_family_relationships`) start with an `is_admin()`/`service_role` check; `create_public_family_enrollment` and `portal_login_hit` cannot be run by `anon`/`authenticated`.
Acceptance criteria:
- Given a parent JWT, When calling each of the 4 writing RPCs through REST, Then error 42501 and no rows change.
- Given the anon key, When calling `rpc/create_public_family_enrollment`, Then permission denied.
- A schema test fails if a new SECURITY DEFINER function has no `search_path` or is executable by `anon` without being on an allow-list (`is_admin`).
Test type: integration (RLS)
Priority: P1

### SEC-29: Admin password hygiene
**Som** administrator **vil jeg** at admin-passord ikke kan være lekkede passord **slik at** kontoen ikke tas over med kjente passord.
Status: PARTIAL
Evidence: advisor WARN "Leaked password protection disabled"; generated passwords are used on create/reset; `changeOwnPassword` asks for the current password and 8+ characters (`admin/actions.ts:978-1034`). Admin login is a client-side `signInWithPassword`, so throttling is only Supabase Auth's own rate limit.
Acceptance criteria:
- Given leaked password protection is on, When an admin sets a known leaked password, Then it is refused.
- Given a wrong current password, When `changeOwnPassword` runs, Then "Passordet du bruker i dag er feil" and nothing changes.
- Given a parent (member) session, When `changeOwnPassword` runs, Then it only changes that user's own password (no role change).
Test type: integration (auth)
Priority: P2
