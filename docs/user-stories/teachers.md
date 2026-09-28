# Teacher lifecycle (admin view): current behavior and user stories

Scope: /bli-laerer application, admin/laerere (applications + registry), make-a-parent-a-teacher, class assignment, removal, edit, portal access, audit log. Audited read-only against code on main (e4802fa) and the prod Supabase schema.

## 1. Current behavior

### Data model
- A "teacher" is not its own table. It is a `guardians` row with `is_teacher = true` (`src/app/[locale]/admin/laerere/page.tsx:149-153`). Class assignment is `class_teachers (class_id, guardian_id, school_year_id)` with PK on all three (SQL: `class_teachers_pkey`).
- FKs pointing at `guardians`: `class_teachers.guardian_id` ON DELETE CASCADE, `family_guardians.guardian_id` CASCADE, `class_notes.author_guardian_id` SET NULL, `absence_reports.reported_by_guardian_id` SET NULL, `student_fee_adjustments.teacher_guardian_id` SET NULL. `attendance.marked_by` is an auth uid with no FK at all, stamped by trigger `attendance_stamp_marker`.
- `guardians` has no unique constraint on email, only a non-unique index `guardians_email_normalized_idx`. Prod has 16 email groups shared by more than one guardian (none currently involve a teacher). Prod has 2 teachers, 2 `class_teachers` rows, 0 ghost rows today.
- Portal identity is email based: `portal_guardian_ids()` returns every guardian whose `lower(email)` equals the JWT email. There is no link from guardian to `auth.users` id.

### Application (/bli-laerer)
- `createTeacherApplication` (`src/app/[locale]/admin/actions.ts:419-474`): rate limit 5/min per IP, honeypot + 3 s time trap (`actions.ts:397-410`), zod requires name and valid email (`actions.ts:412-415`). Phone, subjects, message are free text with no format or length check. Insert goes through the service-role client (no anon insert policy on `teacher_applications`). Sends admin mail and confirmation mail, confirmation is always `lang: "no"` (`actions.ts:470`).
- Admin "Søknader" tab: status select ny/kontaktet/arkivert (`updateTeacherApplicationStatus`, `actions.ts:477-508`), hard delete (`actions.ts:511-530`), bulk status (`actions.ts:~1105`), and "Registrer som lærer" which opens `TeacherRegisterDialog` prefilled from the application (`laerere/page.tsx:612-618`).

### Registering a teacher
- `registerTeacher` (`src/app/[locale]/admin/familier/families-actions.ts:463-558`):
  - With `guardian_id` (family page toggle): sets `is_teacher = true` and overwrites `teacher_note` and `source_application_id` with whatever came in, which is null from the toggle (`families-actions.ts:477-495`, `teacher-toggle-button.tsx:64-66`).
  - Without id: requires a first or last name, validates email with a regex, then looks up an existing guardian by `ilike(email)` with `limit(1)` and no ordering (`families-actions.ts:504-510`). On a match it only flips `is_teacher` and sets note, ignoring the name and phone typed in the dialog (`families-actions.ts:511-530`). Otherwise inserts a new guardian with email not lowercased (`families-actions.ts:533-545`), unlike the family RPC which lowercases.
  - No phone validation. No dedupe on phone or name when email is blank.
  - The source application's status is never changed and the application card never shows "already registered".

### Editing a teacher
- There is no edit action or form for a teacher in `admin/laerere`. `TeacherRowMenu` has exactly one item: "Fjern fra lærerregisteret" (`teacher-row-menu.tsx:60-68`).
- Name, email and phone can only be edited through the family editor RPC `update_family_relationships` (`families-actions.ts:32-110`), which only accepts guardians already linked to that family. A teacher shown as "Ikke koblet til familie" (`laerere/page.tsx:364-367`) cannot be edited anywhere in the UI.
- `teacher_note` can only be set at registration time. `updateGuardianRoles` (`families-actions.ts:430-461`) could edit it but has no caller.
- Changing a guardian email never touches `auth.users`. Portal access follows the new email automatically because `portal_guardian_ids()` matches on JWT email, so the old login silently loses access and the old auth user is orphaned. The admin must press "Send innloggingslenke" for the new address, which calls `auth.admin.createUser` for it (`portal-admin-actions.ts:208-216`).

### Removing a teacher
- "Fjern fra lærerregisteret" and "Fjern som lærer" both call `removeTeacher` (`families-actions.ts:560-580`), which only sets `is_teacher = false`. It does not delete `class_teachers` rows. There is no hard delete of a guardian anywhere in the app, so the CASCADE never fires in practice.
- Portal: all teacher RPCs join `g.is_teacher` (`portal_my_classes`, `portal_is_teacher_of`, `portal_can_mark`, `portal_class_roster`), and parents' `portal_my_children.teachers` also filters on it. So the removed teacher loses /min-side/klasse at the next request (`min-side/klasse/[classId]/page.tsx:40` 404s) and disappears from parents' "Mine barn". The auth user and session stay alive; if they have children they still see the parent view.
- Admin class page: `class_teachers` is read without an `is_teacher` filter (`src/app/[locale]/admin/klasser/[id]/page.tsx:185-189`, mapped at `:346-354`). A removed teacher keeps showing under "Lærere" on the class page as a ghost, while `admin/laerere` no longer lists them. Re-registering them later brings the old assignment back silently.
- Confirm dialog copy says the person is kept as a guardian (`teacher-row-menu.tsx:75-77`) but does not mention class links.

### Class assignment
- Only from the class side: `ClassTeachers` on `admin/klasser/[id]` (`class-teachers.tsx:60-92`) calls `assignTeacher` / `removeTeacher` in `portal-admin-actions.ts:46-124`, always for the active school year. Multiple teachers per class and multiple classes per teacher are supported. Duplicate assign returns a friendly 23505 message (`portal-admin-actions.ts:78-80`). `assignTeacher` checks `is_teacher` (`:60-67`).
- Teacher side (`admin/laerere`) only shows linked class names or "Ingen klasse i år" (`laerere/page.tsx:398-412`); no assign/unassign there.
- School year rollover does not copy `class_teachers` (no function or TS code references it), so all teachers lose portal access when a new year is activated until re-assigned.

### Audit and export
- Logged: `teacher.registered`, `teacher.removed`, `teacher.status`, `teacher.delete`, `teacher.bulk_status`, `class_teacher.assign`, `class_teacher.remove`, `portal.login_link_sent`, `family.relationships_updated`.
- `admin/revisjon` has no label for `class_teacher.assign`, `class_teacher.remove` or `portal.login_link_sent` (falls back to "Ukjent handling", `revisjon/page.tsx:221`) and `class_teacher` / `guardian` entity types are not all in the filter list (`revisjon/page.tsx:73-84`), so they show as "Annet" (`:811`). Prod already has 6 such `class_teacher.*` rows.
- `teacher.removed` has no metadata about which classes the person was linked to.
- The "Eksporter" button on the "Registrerte lærere" tab (`laerere/page.tsx:284`) exports `teacher_applications`, not registered teachers (`src/app/api/export/[entity]/route.ts:91-103`).

## 2. User stories

### TCH-01: Edit a teacher's name, email and phone from the teacher list
**Som** administrator **vil jeg** kunne redigere navn, e-post og telefon på en lærer direkte fra lærerlisten **slik at** kontaktinfo er riktig uten at jeg må lete fram en familie.
Status: MISSING
Evidence: `teacher-row-menu.tsx:60-68` has only a remove item; no update action for teacher fields exists; family editor RPC rejects guardians not in that family (`update_family_relationships`, "Guardian does not belong to family").
Acceptance criteria:
- Given a registered teacher with no family link, When admin opens the row menu, Then a "Rediger" option opens a form prefilled with first name, last name, email, phone and note.
- Given the form, When admin saves a new phone, Then `admin/laerere` and the class page both show the new phone after refresh.
- Given an empty first and last name, When admin saves, Then the save is rejected with "Navn er påkrevd" and nothing changes.
- Given a save, Then an audit row `teacher.updated` with changed field names (not values) is written and is labelled in `admin/revisjon`.
Test type: e2e (Playwright)
Priority: P1

### TCH-02: Changing a teacher's email keeps login and portal in sync
**Som** administrator **vil jeg** at en endret e-post på en lærer også endrer innloggingen **slik at** læreren ikke mister tilgang til Min klasse uten forvarsel.
Status: PARTIAL
Evidence: portal access derives from `guardians.email` vs JWT email (`portal_guardian_ids()`), so access moves with the email, but `auth.users` is never updated; old auth user stays orphaned and the teacher is silently locked out until a new link is sent (`portal-admin-actions.ts:181-245`).
Acceptance criteria:
- Given a teacher logged in with old@x.no, When admin changes the email to new@x.no, Then the admin gets a clear prompt to send a login link to new@x.no.
- Given the change, When the teacher uses a link sent to new@x.no, Then /min-side shows their class.
- Given the change, When the old session requests /min-side/klasse/<id>, Then it gets 404 and no roster data (no stale access).
- Given the change, Then either the old auth user email is updated or the orphan is listed for cleanup; it must not retain any teacher RLS access.
Test type: integration (server action/RLS)
Priority: P1

### TCH-03: Removing a teacher also removes the class links
**Som** administrator **vil jeg** at lærerens klassekoblinger fjernes når jeg fjerner læreren **slik at** klassesiden ikke viser en lærer som ikke finnes lenger.
Status: BROKEN
Evidence: `removeTeacher` only sets `is_teacher=false` (`families-actions.ts:566-570`); class page reads `class_teachers` without `is_teacher` filter (`klasser/[id]/page.tsx:185-189`, `:346-354`).
Acceptance criteria:
- Given teacher T assigned to class A and B this year, When admin removes T from the registry, Then `class_teachers` has no rows for T in the active year.
- Given that, When admin opens class A, Then T is not listed under "Lærere".
- Given the confirm dialog, Then it lists which classes T will be removed from.
- Given the removal, Then audit `teacher.removed` metadata contains the removed class ids.
Test type: integration (server action/RLS)
Priority: P0

### TCH-04: Re-registering a removed teacher does not resurrect old assignments
**Som** administrator **vil jeg** at en lærer jeg registrerer på nytt starter uten gamle klasser **slik at** jeg ikke gir tilgang til en klasse ved et uhell.
Status: BROKEN
Evidence: since class links survive removal (TCH-03), `registerTeacher` flipping `is_teacher` back to true re-enables every old `class_teachers` row, and portal RPCs grant roster access again.
Acceptance criteria:
- Given T was removed while assigned to class A, When admin clicks "Gjør til lærer" again, Then T has no class this year and cannot open /min-side/klasse/A.
- Given T is re-registered, Then `admin/laerere` shows "Ingen klasse i år" for T.
Test type: integration (server action/RLS)
Priority: P0

### TCH-05: Removed teacher loses teacher portal access immediately
**Som** administrator **vil jeg** at en fjernet lærer mister tilgang til elevlister og oppmøte med en gang **slik at** barnas personopplysninger ikke lekker.
Status: WORKS
Evidence: `portal_my_classes`, `portal_is_teacher_of`, `portal_can_mark`, `portal_class_roster` all join `guardians.is_teacher`; `min-side/klasse/[classId]/page.tsx:40` calls `notFound()`.
Acceptance criteria:
- Given teacher T logged in on /min-side/klasse/A, When admin removes T, Then the next reload returns 404.
- Given the same session, When it calls `portal_class_roster(A, day)` directly, Then it gets error 42501.
- Given the same session, When it inserts into `attendance` or `class_notes` for class A, Then RLS rejects it.
- Given T also has a child at the school, Then /min-side still shows the parent view for that child.
Test type: integration (server action/RLS)
Priority: P0

### TCH-06: Unassigning a teacher from a class removes access to that class only
**Som** administrator **vil jeg** kunne fjerne en lærer fra én klasse **slik at** læreren bare ser klassene de faktisk har.
Status: WORKS
Evidence: `portal-admin-actions.ts:94-124` deletes the single `(class, guardian, active year)` row; RPCs check the row.
Acceptance criteria:
- Given T is in class A and B, When admin clicks "Fjern" on class A, Then T is gone from A's teacher list and still on B.
- Given that, When T opens /min-side, Then only class B is listed and /min-side/klasse/A returns 404.
- Given that, Then an audit row `class_teacher.remove` exists with `guardian_id` in metadata.
Test type: e2e (Playwright)
Priority: P1

### TCH-07: Multiple teachers per class and multiple classes per teacher
**Som** administrator **vil jeg** kunne knytte flere lærere til samme klasse og samme lærer til flere klasser **slik at** delt undervisning fungerer.
Status: WORKS
Evidence: PK `(class_id, guardian_id, school_year_id)`; `class-teachers.tsx:56-58` filters already assigned candidates; 23505 handled (`portal-admin-actions.ts:78-80`).
Acceptance criteria:
- Given class A with teacher T1, When admin adds T2, Then both are listed and both can mark attendance for A.
- Given T1 already in A, Then T1 is not offered in the "Legg til lærer" dropdown.
- Given a double submit of the same assignment, Then the second returns "Læreren er allerede knyttet til klassen." and only one row exists.
- Given parents of a child in A, Then "Mine barn" lists both T1 and T2.
Test type: e2e (Playwright)
Priority: P2

### TCH-08: Assign a teacher to classes from the teacher list
**Som** administrator **vil jeg** kunne velge klasser for en lærer fra lærerlisten **slik at** jeg ikke må åpne hver klasse for seg.
Status: MISSING
Evidence: `laerere/page.tsx:393-413` only renders class links; assignment exists only in `class-teachers.tsx`.
Acceptance criteria:
- Given teacher T with "Ingen klasse i år", When admin picks class A from T's row, Then T is linked to A for the active year.
- Given T linked to A, When admin unlinks from T's row, Then class A's page no longer shows T.
- Given both entry points, Then they call the same server action and write the same audit rows.
Test type: e2e (Playwright)
Priority: P2

### TCH-09: Teacher without a class is clearly flagged
**Som** administrator **vil jeg** se hvilke lærere som ikke har klasse i år **slik at** jeg husker å fordele dem.
Status: WORKS
Evidence: `laerere/page.tsx:408-411` shows "Ingen klasse i år".
Acceptance criteria:
- Given teacher T with no `class_teachers` row in the active year, When admin opens `admin/laerere`, Then T's row shows "Ingen klasse i år".
- Given T only has a row in a previous year, Then T still shows "Ingen klasse i år".
- Given T logs in with no class and no children, Then /min-side shows the no-role state, not an error.
Test type: e2e (Playwright)
Priority: P2

### TCH-10: New school year keeps or prompts for teacher assignments
**Som** administrator **vil jeg** at lærerne følger med til nytt skoleår eller at jeg blir bedt om å fordele dem **slik at** lærerne ikke mister Min klasse uten at noen merker det.
Status: MISSING
Evidence: no SQL function or TS file references `class_teachers` in the rollover flow (`src/components/admin/rollover/rollover-wizard.tsx`); all portal RPCs require `sy.is_active`.
Acceptance criteria:
- Given teachers assigned in year Y, When admin completes rollover to Y+1, Then the wizard offers to copy assignments to classes that continue.
- Given the admin copies, Then each teacher can open their class in Y+1 on /min-side.
- Given the admin skips, Then `admin/laerere` shows every teacher as "Ingen klasse i år" and the dashboard warns.
Test type: integration (server action/RLS)
Priority: P1

### TCH-11: Teacher application from the public form
**Som** person som vil bli lærer **vil jeg** sende inn en søknad på /bli-laerer **slik at** skolen kan kontakte meg.
Status: WORKS
Evidence: `actions.ts:419-474`, `TeacherSignupForm.tsx:77-134`, service-role insert.
Acceptance criteria:
- Given valid name and email, When the form is submitted after more than 3 s, Then a row with status "ny" appears in `admin/laerere?tab=soknader` and the "Søknader" tab badge increments.
- Given a missing email or invalid email, Then the server returns "E-post er påkrevd" / "Ugyldig e-postadresse" and no row is created.
- Given the honeypot is filled, Then the response is ok but no row is created.
- Given 6 submissions in a minute from one IP, Then the 6th gets "For mange forsøk".
Test type: e2e (Playwright)
Priority: P1

### TCH-12: Application confirmation in the applicant's language
**Som** engelsktalende søker **vil jeg** få bekreftelsen på engelsk når jeg søkte på /en/bli-laerer **slik at** jeg forstår at søknaden er mottatt.
Status: BROKEN
Evidence: `sendTeacherApplicationConfirmationEmail({ ..., lang: "no" })` hardcoded at `actions.ts:467-471`; server error messages are Norwegian only (`actions.ts:412-415`).
Acceptance criteria:
- Given locale "en", When an application is submitted, Then the confirmation email is sent with `lang: "en"`.
- Given locale "en" and an invalid email, Then the error is shown in English.
Test type: integration (server action/RLS)
Priority: P2

### TCH-13: Validate phone and length on application and registration
**Som** administrator **vil jeg** at telefon og tekstfelt valideres **slik at** jeg ikke får søppel eller ubrukelige numre i lærerregisteret.
Status: MISSING
Evidence: application only validates name/email (`actions.ts:412-415`); `registerTeacher` never checks phone (`families-actions.ts:469-503`); no length limits on subjects/message.
Acceptance criteria:
- Given phone "abc", When submitting /bli-laerer or the register dialog, Then it is rejected with a phone format message.
- Given phone "+47 912 34 567" or "91234567", Then it is accepted and stored normalized.
- Given a 20 000 character message, Then it is rejected or truncated to a documented max.
- Given a whitespace-only name, Then it is rejected.
Test type: unit
Priority: P2

### TCH-14: Registering from an application closes the application
**Som** administrator **vil jeg** at søknaden markeres som behandlet når jeg registrerer søkeren som lærer **slik at** innboksen ikke viser ferdige søknader som nye.
Status: MISSING
Evidence: `registerTeacher` sets `guardians.source_application_id` but never updates `teacher_applications.status` (`families-actions.ts:463-558`); the card has no "registered" state (`laerere/page.tsx:557-619`).
Acceptance criteria:
- Given an application with status "ny", When admin registers it as teacher, Then its status becomes "kontaktet" (or a new "registrert") and the badge count drops.
- Given a registered application, Then its card shows "Registrert som lærer" with a link to the teacher and hides the "Registrer som lærer" button.
- Given the application is later deleted, Then the teacher remains and `source_application_id` becomes null (FK SET NULL).
Test type: e2e (Playwright)
Priority: P1

### TCH-15: Registering with an email that already exists does not overwrite silently
**Som** administrator **vil jeg** få beskjed når e-posten allerede finnes på en foresatt **slik at** jeg vet hvem som ble gjort til lærer og at navnet jeg skrev ikke ble lagret.
Status: PARTIAL
Evidence: match by `ilike(email).limit(1)` with no order (`families-actions.ts:504-510`), then only `is_teacher`/note updated; typed name and phone are dropped (`:511-530`); toast is the generic "Læreren er registrert" (`teacher-register-dialog.tsx:50`). Prod has 16 duplicated guardian emails, so the chosen row is arbitrary.
Acceptance criteria:
- Given guardian G with email a@x.no, When admin registers a teacher with a@x.no, Then the toast names G ("Koblet til eksisterende foresatt <navn>").
- Given two guardians share a@x.no, When admin registers with a@x.no, Then admin is asked to choose, or the one with a family link is chosen deterministically.
- Given typed name differs from G's name, Then admin is told the existing name was kept (or asked to update it).
- Given A@X.no in any case, Then it matches the same guardian and the stored email is lowercase.
Test type: integration (server action/RLS)
Priority: P1

### TCH-16: No duplicate teacher records for the same person
**Som** administrator **vil jeg** at samme person ikke kan finnes to ganger i lærerregisteret **slik at** fritak, klasser og innlogging ikke splittes.
Status: PARTIAL
Evidence: email dedupe only (TCH-15); blank email always inserts a new guardian (`families-actions.ts:533-545`); no unique index on email or phone (`guardians_email_normalized_idx` is non-unique).
Acceptance criteria:
- Given teacher "Ali Khan" with phone 91234567 and no email, When admin registers "Ali Khan" 91234567 again, Then admin is warned about a likely duplicate.
- Given two guardian rows with the same email both flagged teacher, Then `admin/laerere` shows a duplicate warning.
- Given a teacher logs in, Then `saveClassNote` records a stable author, not `guardianIds[0]` of an arbitrary duplicate (`src/lib/portal/actions.ts:247`).
Test type: integration (server action/RLS)
Priority: P2

### TCH-17: Make a parent a teacher from the family page
**Som** administrator **vil jeg** gjøre en foresatt til lærer fra familiesiden **slik at** lærerbarn kan få fritak og læreren kan knyttes til en klasse.
Status: WORKS
Evidence: `TeacherToggleButton` (`src/components/admin/teacher-toggle-button.tsx:57-79`, rendered in `family-workbench.tsx:299`) calls `registerTeacher` with `guardian_id`.
Acceptance criteria:
- Given a guardian in family F, When admin clicks "Gjør til lærer", Then a "Lærer" tag appears and the guardian is listed in `admin/laerere` with "Har barn på skolen" linking to F.
- Given that, Then the guardian appears in the "Legg til lærer" dropdown on any class page.
- Given that, Then audit `teacher.registered` exists for the guardian id.
Test type: e2e (Playwright)
Priority: P1

### TCH-18: Toggling teacher role does not wipe the teacher note or application link
**Som** administrator **vil jeg** at notat og søknadskobling beholdes når jeg slår lærerrollen av og på **slik at** historikken ikke forsvinner.
Status: BROKEN
Evidence: toggle sends only `guardian_id`, and `registerTeacher` writes `teacher_note: null, source_application_id: null` (`families-actions.ts:470-486`, `teacher-toggle-button.tsx:64-66`).
Acceptance criteria:
- Given teacher T with note "Arabisk" and a source application, When admin removes and re-adds T via the toggle, Then note and `source_application_id` are unchanged.
- Given T is already a teacher, When registered again from the dialog with an empty note, Then the existing note is kept.
Test type: integration (server action/RLS)
Priority: P2

### TCH-19: Edit the teacher note after registration
**Som** administrator **vil jeg** kunne endre notatet (fag, rolle) på en lærer **slik at** oversikten er oppdatert.
Status: MISSING
Evidence: note is only set in `TeacherRegisterDialog` (`teacher-register-dialog.tsx:139-145`); `updateGuardianRoles` (`families-actions.ts:430-461`) has no caller.
Acceptance criteria:
- Given teacher T, When admin edits the note in the edit form (TCH-01), Then `admin/laerere` shows the new note.
- Given an empty note is saved, Then the note is cleared and no stray text shows.
Test type: e2e (Playwright)
Priority: P2

### TCH-20: Teacher without a valid email is flagged in the teacher list
**Som** administrator **vil jeg** se i lærerlisten hvilke lærere som ikke kan logge inn **slik at** jeg kan skaffe e-post før skolestart.
Status: PARTIAL
Evidence: class page shows "Mangler e-post, kan ikke logge inn" (`class-teachers.tsx:129-133`); `admin/laerere` just hides the login button (`laerere/page.tsx:425-430`); placeholder `mangler@islamskole.no` passes the register regex but is excluded by `portal_guardian_ids()`.
Acceptance criteria:
- Given teacher T with no email, When admin opens `admin/laerere`, Then T's row shows "Mangler e-post, kan ikke logge inn".
- Given T has `mangler@islamskole.no`, Then the same warning is shown and "Send innloggingslenke" is hidden or disabled.
- Given T gets a valid email, Then the warning disappears and the login button appears.
Test type: e2e (Playwright)
Priority: P2

### TCH-21: Send a login link to a teacher
**Som** administrator **vil jeg** sende innloggingslenke til en lærer **slik at** læreren kommer inn på Min klasse uten passord.
Status: WORKS
Evidence: `sendLoginLinkToGuardian` (`portal-admin-actions.ts:181-245`) validates email, creates auth user with role "member", sends OTP, audits `portal.login_link_sent`.
Acceptance criteria:
- Given teacher T with a valid email and no auth user, When admin clicks "Send innloggingslenke", Then an auth user is created with `app_metadata.role = "member"` and an OTP mail is sent.
- Given a second click within the OTP cooldown, Then the admin sees "Det er nettopp sendt en lenke".
- Given the link is used, Then /min-side shows T's classes and T cannot open /admin.
- Test must use ZZTEST or test-admin data only, never a real parent address.
Test type: integration (server action/RLS)
Priority: P1

### TCH-22: Removed teacher's historical attendance and notes are preserved
**Som** administrator **vil jeg** at oppmøte og ukenotater en tidligere lærer har skrevet blir liggende **slik at** historikken for klassen er komplett.
Status: WORKS
Evidence: removal is a flag flip, no deletes; `class_notes.author_guardian_id` is SET NULL and `attendance.marked_by` has no FK, so even a hard delete would keep rows.
Acceptance criteria:
- Given T marked attendance and wrote a note for class A, When T is removed, Then class A's attendance stats on the admin class page are unchanged.
- Given that, Then parents in class A still see the note on /min-side.
- Given a replacement teacher T2 edits that note, Then the note is saved with T2 as author.
Test type: integration (server action/RLS)
Priority: P1

### TCH-23: Removed teacher is gone from parents' "Mine barn"
**Som** forelder **vil jeg** bare se lærere som faktisk underviser barnet mitt **slik at** jeg kontakter riktig person.
Status: WORKS
Evidence: `portal_my_children` teacher subquery filters `g.is_teacher` and active year.
Acceptance criteria:
- Given child C in class A with teacher T, When admin removes T, Then the parent's /min-side/barn/C no longer lists T.
- Given T is unassigned from A but still a teacher elsewhere, Then C's page no longer lists T.
Test type: integration (server action/RLS)
Priority: P1

### TCH-24: Class and teacher changes are readable in the audit log
**Som** administrator **vil jeg** se i revisjonsloggen hvem som la til eller fjernet lærere fra klasser **slik at** jeg kan spore endringer.
Status: PARTIAL
Evidence: `class_teacher.assign/remove` and `portal.login_link_sent` are written but have no label in `revisjon/page.tsx:106-150` and fall back to "Ukjent handling" (`:221`); entity type `class_teacher` is not in `entityFilters` (`:73-100`) so it shows "Annet" (`:811`). 6 such rows already in prod.
Acceptance criteria:
- Given admin assigns T to class A, When opening `admin/revisjon`, Then the row reads e.g. "La til lærer i klasse" with T's name and class A linked.
- Given admin removes T from A, Then the row reads "Fjernet lærer fra klasse".
- Given filter "Foresatte og lærere" or "Klasser", Then these rows are included.
- Given a login link is sent, Then the row reads "Sendte innloggingslenke".
Test type: e2e (Playwright)
Priority: P2

### TCH-25: Export registered teachers
**Som** administrator **vil jeg** eksportere lærerregisteret fra fanen "Registrerte lærere" **slik at** jeg får en liste med lærerne, ikke søknadene.
Status: BROKEN
Evidence: `laerere/page.tsx:284` shows `ExportButton entity="teachers"` on the registry tab, but `api/export/[entity]/route.ts:91-103` maps `teachers` to `teacher_applications`.
Acceptance criteria:
- Given the "Registrerte lærere" tab, When admin clicks Eksporter, Then the CSV contains one row per guardian with `is_teacher = true` (name, email, phone, note, classes this year).
- Given the "Søknader" tab, Then an export of applications is available and clearly named.
Test type: integration (server action/RLS)
Priority: P2

### TCH-26: Only admins can run teacher management actions
**Som** skoleeier **vil jeg** at bare administratorer kan registrere, fjerne og tildele lærere **slik at** en forelder eller lærer ikke kan gi seg selv tilgang til andre klasser.
Status: WORKS
Evidence: `getIsAdmin()` guard in `registerTeacher`/`removeTeacher` (`families-actions.ts:466, 563`), `requireAdmin` in `portal-admin-actions.ts:50-51, 98-99`; RLS: `class_teachers` write only `is_admin()`, `guardians` only `is_admin()`.
Acceptance criteria:
- Given a logged-in member (parent or teacher), When calling `assignTeacher(classId, ownGuardianId)`, Then it returns "Kontoen din har ikke tilgang" and no row is inserted.
- Given the same member, When inserting into `class_teachers` via the anon client, Then RLS rejects it.
- Given the same member, When calling `registerTeacher` or `removeTeacher`, Then "Ikke autorisert" is returned.
Test type: integration (server action/RLS)
Priority: P0

### TCH-27: Remove-teacher confirmation explains the consequences
**Som** administrator **vil jeg** se hva som skjer før jeg fjerner en lærer **slik at** jeg ikke fjerner feil person eller mister noe uventet.
Status: PARTIAL
Evidence: dialog text covers guardian status and lærerbarn-fradrag (`teacher-row-menu.tsx:75-77`) but not class links, portal access or that the login stays active.
Acceptance criteria:
- Given teacher T in class A, When admin opens the remove dialog, Then it states "Fjernes fra klasse A" and "mister tilgang til Min klasse".
- Given admin cancels, Then nothing changes and the row is still visible.
- Given admin confirms and the server fails, Then the row reappears (optimistic rollback) with an error toast.
Test type: e2e (Playwright)
Priority: P2

### TCH-28: Hard delete of a teacher or guardian is either impossible or clean
**Som** administrator **vil jeg** at sletting av en person rydder alle koblinger **slik at** det ikke blir hengende data igjen.
Status: UNVERIFIED
Evidence: no hard delete of `guardians` in the app; if one is added, FKs cascade `class_teachers` and `family_guardians` and SET NULL on notes, absence reports and fee adjustments; `attendance.marked_by` keeps a dangling auth uid; the auth user is not deleted.
Acceptance criteria:
- Given a future "Slett person" action on guardian G who is a teacher, When run, Then `class_teachers` and `family_guardians` rows for G are gone and notes/fritak rows remain with null author/teacher.
- Given that, Then the auth user for G's email is deleted or explicitly kept, and admin is told which.
- Given G is the only guardian of a family, Then the delete is blocked with an explanation.
Test type: integration (server action/RLS)
Priority: P2
