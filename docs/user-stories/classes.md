# Klasser, skoleår og lærerportalen "Min klasse"

Audit date 2026-09-29. Read-only. Code at `main` (e4802fa). DB facts from live Supabase (SELECT only).

## 1. Current behavior

### Classes (admin)
- Create/update: `createClass` / `updateClass` in `src/app/[locale]/admin/actions.ts:245-344`. Only `name_no` is validated (`classSchema`, actions.ts:115-117). `name_en` is sent as `null` when empty (`readOptionalString`, actions.ts:82-85), but the DB column `classes.name_en` is `NOT NULL` with no default. The form tells the admin to leave English empty (`src/components/admin/class-form.tsx:145-157`, "La feltene stå tomme dersom klassen ikke skal beskrives på engelsk ennå"). The insert fails with 23502, and `toUserError` has no case for that code, so it shows "Noe gikk galt. Prøv igjen." (`src/lib/action-errors.ts:3-18`).
- Slug is made from the input or `name_no` via `slugify` (actions.ts:65-75). It only keeps `[a-z0-9 -]`, so a name with no Latin letters gives slug `""`. The DB has only `UNIQUE(slug)`, with no check against empty.
- No check that `age_min <= age_max`. The form only sets `min="0"` (class-form.tsx:198-227).
- Delete: `deleteClass` (actions.ts:346-359) does a plain delete. Live FKs: `enrollments.class_id` is ON DELETE RESTRICT, and `class_teachers.class_id` and `class_notes.class_id` are CASCADE. Any enrollment blocks the delete, including ended ones and ones from past years. The user sees the generic "Kan ikke fullføre fordi andre data er koblet til dette." (action-errors.ts:8-9). The confirm dialog says "Klasser med elever plassert kan ikke slettes." (`src/components/admin/class-sort-list.tsx:143-153`). There is no archive except unpublishing.
- Public page `/klasser/[slug]` is static (`generateStaticParams`, `src/app/[locale]/klasser/[slug]/page.tsx:13-16`) and looks up the class by slug (`src/lib/data.ts:88-97`). RLS `classes public read` = `published OR is_admin()`, so unpublished classes return 404. When the slug changes the old URL returns 404, and there is no redirect or slug history.
- Class detail `admin/klasser/[id]/page.tsx:118-200` shows the roster, pay chips, attendance summary and teachers for the **active year only**. If there is no active year it returns empty lists (page.tsx:131-145).

### Teacher assignment
- `assignTeacher` / `removeTeacher` in `src/app/[locale]/admin/portal-admin-actions.ts:46-124` always use the **active** school year (`activeSchoolYearId`, :36-44). You cannot assign teachers to a future year in advance. `assignTeacher` requires `guardians.is_teacher` (:60-67).
- Access checks are live SQL (`portal_is_teacher_of`, `portal_can_mark`, `portal_class_roster`). They join `class_teachers` + `guardians.is_teacher` + `school_years.is_active` + an email match through `portal_guardian_ids()` (`supabase/migrations/20260927123038_portal_schema.sql:81-98`, `20260927125407_portal_hardening.sql:1-38,40-111`). Removing an assignment or clearing `is_teacher` takes effect on the next request.
- Live data: 2 `class_teachers` rows, all in 2026/2027. 11 of 13 classes have no teacher in the active year.

### School years
- `createSchoolYear` / `updateSchoolYear` / `setActiveSchoolYear` / `deleteSchoolYear` in `src/app/[locale]/admin/school-years-actions.ts:55-207`. There is no check that `starts_on <= ends_on`. `requireAdmin` throws instead of returning an error (:12-15).
- Only one active year: partial unique index `school_years_one_active`, plus RPC `set_active_school_year` (`20260927105825_single_active_school_year.sql`). Both are confirmed live.
- Delete is blocked for the active year and when enrollments exist (RESTRICT). Otherwise it CASCADEs to `student_fees`, `payment_allocations`, `student_fee_adjustments`, `payment_plans`, `installments`, `sibling_discount_dismissals`, `class_teachers`, `school_days` (and through them `attendance`, `class_notes`, `absence_reports`). `payments`, `refunds` and `sadaqa_gifts` get SET NULL (live `pg_constraint`).
- School days are only created by a manual button (`generateSchoolDays`, portal-admin-actions.ts:156-179, calling `ensure_school_days`, portal_schema.sql:323-353). They are generated every Sunday from `starts_on` to `ends_on`. Changing the year's dates later does not remove days that now fall outside the range.
- Rollover: `confirmRollover` (`src/app/[locale]/admin/students-actions.ts:1626-1665`) calls `rollover_enrollments` (`20260927105752_enrollment_rollover.sql:19-147`). It creates enrollments and `student_fees` for the target year. It does **not** check capacity and does **not** copy `class_teachers`. The activation hint only says "Dette året blir standard for nye plasseringer og betalinger." (`src/components/admin/school-year-form.tsx:201-208`). It does not say that parents and teachers lose portal data until enrollments and teachers exist in the new year. Parent RPC `portal_my_children` and teacher RPC `portal_my_classes` join `sy.is_active` (portal_rpcs.sql:46,88).

### Moving a student
- `changeEnrollmentClass` (students-actions.ts:778-839) updates `enrollments.class_id` in place. It checks capacity, but does not update `price_snapshot` or the fee to match the new class price. There is no age-range check. `attendance` is keyed by `(student_id, school_day_id)` with no class column, so after the move the new teacher sees and can edit all attendance from the old class this year, and the old teacher loses it (`portal_can_mark` uses the current enrollment).
- Age range is used only for suggestions in the register (`src/app/[locale]/admin/register/placement.ts:25-32`). It is never enforced. Age follows the calendar-year rule through `ageInYear(birth, schoolYearStart(label))` (`src/lib/age.ts:1-16`, admin class page.tsx:250, portal `data.ts:22-24,135`).

### Teacher portal `/min-side/klasse/[classId]`
- Page `src/app/[locale]/min-side/klasse/[classId]/page.tsx`. Without login it redirects (:37). If the class is not in `portal_my_classes` it gives 404 (:39-40), so IDOR is blocked in the UI, and in the DB by RLS and `portal_class_roster`. Admins who are not assigned also get 404, because `getMyClasses` only returns teacher assignments. There is no admin view of the portal, notes or attendance entry.
- Attendance: the UI blocks marking on future and cancelled days (`markable`, page.tsx:59-60). The DB policy `portal_can_mark` (hardening.sql:16-38) checks neither date nor `cancelled`, so a direct server-action call can mark a future or cancelled day. Any past day in the active year can be edited with no time limit. PK `(student_id, school_day_id)` + upsert prevents duplicates (`src/lib/portal/actions.ts:139-219`). The trigger `attendance_stamp_marker` stamps who marked it and when.
- Weekly note: `saveClassNote` upserts on `(class_id, school_day_id)` (actions.ts:228-263). There is no delete policy or action; "delete" means saving two empty fields, which leaves an empty row. The UI disables the editor on cancelled days only (page.tsx:132). RLS does not check that the day is in the class's active year or not cancelled (portal_schema.sql:282-295). Two teachers editing at once: last write wins.
- Parents read notes through the RLS `guardian reads class` = `portal_is_guardian_in_class` (active enrollment in the active year). They are not filtered by year, so the parent sees every note for that class_id, including earlier years. Parent home shows only the latest note up to today (`getParentData(noteLimit = 1)`, `src/lib/portal/parent-data.ts:16-26`). If that note is empty, nothing shows (`child-card.tsx:107`), even when older homework exists. A note for a future day is hidden from parents until that day (`until = today`).
- Live data: 43 school days in 2026/2027, 9 attendance rows, 0 class_notes.

## 2. User stories

### CLS-01: Opprette klasse uten engelsk navn
**Som** administrator **vil jeg** opprette en klasse med bare norsk navn **slik at** jeg kan legge inn klassen før den engelske teksten er klar.
Status: BROKEN
Evidence: `class-form.tsx:145-157` says English can be left empty. `actions.ts:261` sends `name_en: null`. Live column `classes.name_en` is NOT NULL, no default. `action-errors.ts` has no case for 23502, so the user gets "Noe gikk galt".
Acceptance criteria:
- Given an admin on /admin/klasser/ny, When they fill in only "Navn (norsk)" and save, Then the class is created and appears in the list.
- Given that class, When /en/klasser/<slug> is opened, Then the Norwegian name is shown (the `localized` fallback).
- Given a DB write that fails, Then the error text names the field and is not "Noe gikk galt".
Test type: integration (server action) + e2e
Priority: P1

### CLS-02: Nettadresse (slug) er alltid gyldig
**Som** administrator **vil jeg** at klassen alltid får en gyldig nettadresse **slik at** den offentlige siden fungerer.
Status: PARTIAL
Evidence: `slugify` (actions.ts:65-75) strips everything except `[a-z0-9 -]`. A name like "عربي" gives `""`. The DB has only UNIQUE(slug), with no check against empty. A duplicate gives "Dette finnes allerede." with no hint that it is the slug.
Acceptance criteria:
- Given the name "عربي" and an empty slug, When the admin saves, Then either a non-empty slug is generated or a validation error asks for a slug.
- Given a slug that already exists, When the admin saves, Then the error says the web address is taken.
- Given slug "Klasse 1 Åsane", Then the stored slug is "klasse-1-asane".
Test type: unit (slugify) + integration
Priority: P2

### CLS-03: Endre navn eller nettadresse uten døde lenker
**Som** foresatt **vil jeg** at en gammel lenke til en klasse fortsatt virker **slik at** delte lenker og søketreff ikke gir 404.
Status: MISSING
Evidence: `updateClass` (actions.ts:295-344) overwrites the slug. `/klasser/[slug]` looks up the exact slug only (`data.ts:88-97`, page.tsx:44-45). There is no slug history or redirect.
Acceptance criteria:
- Given class slug "arabisk-1", When the admin changes it to "arabisk-nybegynner", Then /klasser/arabisk-nybegynner shows the class.
- Given the same change, When /klasser/arabisk-1 is opened, Then the user gets a 308 to the new slug (or, at minimum, the admin was warned before saving).
- Given only name_no changes and the slug field is unchanged, Then the slug stays the same.
Test type: e2e
Priority: P2

### CLS-04: Oppdatert klasse vises på den statiske nettsiden
**Som** administrator **vil jeg** at endringer i klassen vises på nettsiden med en gang **slik at** foresatte ser riktig info.
Status: UNVERIFIED
Evidence: `/klasser/[slug]` uses `generateStaticParams` (page.tsx:13-16). The actions call `revalidatePath("/", "layout")` (actions.ts:119-121). Whether a new slug or an unpublished class is purged from the static cache on Vercel has not been confirmed.
Acceptance criteria:
- Given a published class, When the admin changes the description, Then the public page shows it on the next load.
- Given a class, When the admin unpublishes it, Then /klasser/<slug> gives 404 and the class is gone from /klasser.
- Given a new class created after deploy, Then /klasser/<new-slug> works without a new deploy.
Test type: e2e (against a preview build)
Priority: P1

### CLS-05: Aldersspenn og kapasitet valideres
**Som** administrator **vil jeg** få feilmelding på ugyldig alder eller kapasitet **slik at** plasseringsforslag og visning ikke blir feil.
Status: MISSING
Evidence: no check of `age_min <= age_max` or capacity >= 0 on the server (actions.ts:262-264, 315-317). `readNumber` accepts decimals. The DB has no CHECK constraints on classes (only UNIQUE slug).
Acceptance criteria:
- Given age_min 10 and age_max 6, When the admin saves, Then they get a validation error and nothing is stored.
- Given capacity -1 or 2.5, When saved, Then it is rejected.
- Given capacity lower than the current number of students, When saved, Then the admin gets a warning showing the number enrolled.
Test type: integration
Priority: P2

### CLS-06: Slette klasse med tydelig beskjed
**Som** administrator **vil jeg** få en konkret forklaring når en klasse ikke kan slettes **slik at** jeg vet hva jeg må gjøre.
Status: PARTIAL
Evidence: `enrollments_class_id_fkey` is RESTRICT (live), so even ended or past-year enrollments block the delete. The message is the generic 23503 text (action-errors.ts:8-9). The dialog says only "elever plassert" (class-sort-list.tsx:151).
Acceptance criteria:
- Given a class with only an ended (avsluttet) enrollment, When the admin deletes, Then the delete is blocked and the message says the class has history and should be unpublished instead.
- Given a class with no enrollments, When the admin deletes, Then the class is removed and a `class.delete` audit row exists.
- Given a class with active students, Then the message says how many students are placed.
Test type: integration + e2e
Priority: P2

### CLS-07: Sletting fjerner ikke lærernotater stille
**Som** administrator **vil jeg** bli advart om at ukenotater og lærerkoblinger forsvinner **slik at** jeg ikke mister data ved et uhell.
Status: PARTIAL
Evidence: `class_notes.class_id` and `class_teachers.class_id` are ON DELETE CASCADE (live). A class with no enrollments can have notes and teachers, and they are removed without any warning.
Acceptance criteria:
- Given a class with 0 enrollments, 1 teacher and 3 notes, When the admin opens the delete dialog, Then the dialog lists "1 lærer, 3 ukenotater".
- Given the admin confirms, Then the class, notes and assignment are gone and the audit metadata records the counts.
Test type: integration
Priority: P2

### CLS-08: Arkivere klasse i stedet for å slette
**Som** administrator **vil jeg** skjule en gammel klasse fra nettside og plassering **slik at** historikken beholdes.
Status: PARTIAL
Evidence: `published=false` hides the class from the public site (RLS `published OR is_admin()`). Admin placement lists still include all classes (`getClassCapacityInfo`, students-actions.ts:639-641), and there is no "arkivert" state.
Acceptance criteria:
- Given an unpublished class, Then it is missing from /klasser and the public signup class list.
- Given an unpublished class, When the admin places a student, Then the class is marked "ikke publisert" or hidden from the default list.
- Given past enrollments in that class, Then they still show on the student's history.
Test type: e2e
Priority: P2

### CLS-09: Tildele og fjerne lærer
**Som** administrator **vil jeg** koble en lærer til en klasse og fjerne koblingen **slik at** riktig lærer får tilgang til Min klasse.
Status: WORKS
Evidence: `assignTeacher`/`removeTeacher` (portal-admin-actions.ts:46-124). 23505 is turned into "allerede knyttet". A person who is not a teacher is rejected (:65-67). Optimistic UI in `class-teachers.tsx:46-78`.
Acceptance criteria:
- Given a guardian with is_teacher=true, When the admin adds them to class A, Then a class_teachers row exists for the active year and an audit row `class_teacher.assign` exists.
- Given the same teacher again, Then the error "Læreren er allerede knyttet til klassen." is shown.
- Given a guardian with is_teacher=false (a forged call), Then the action returns "Personen er ikke registrert som lærer." and no row is created.
- Given an assigned teacher, When the admin removes them, Then the row is deleted and `class_teacher.remove` is audited.
Test type: integration + e2e
Priority: P1

### CLS-10: Lærer som fjernes mister tilgang med en gang
**Som** administrator **vil jeg** at en lærer jeg fjerner ikke lenger ser elevdata **slik at** personvernet ivaretas.
Status: WORKS (needs a regression test)
Evidence: access is computed live in SQL (`portal_is_teacher_of`, `portal_can_mark`, `portal_class_roster`), with no session caching. `page.tsx:39-40` gives 404 when the class is not in `portal_my_classes`.
Acceptance criteria:
- Given teacher T signed in on /min-side/klasse/A, When the admin removes T from A, Then T's next page load gives 404.
- Given T still has the old page open, When T marks attendance, Then the action returns `forbidden` and no attendance row changes.
- Given the admin sets guardians.is_teacher=false for T, Then T loses access to all classes on the next request.
Test type: integration (RLS with a JWT for T) + e2e
Priority: P0

### CLS-11: Lærer ser bare egne klasser (IDOR)
**Som** lærer **vil jeg** bare se klasser jeg er tildelt **slik at** andre klassers elev- og foresattdata ikke lekker.
Status: WORKS (needs a regression test)
Evidence: page 404 (page.tsx:39-40). `portal_class_roster` raises 42501 unless the user is admin or teacher for `(class, day's year)` (hardening.sql:60-81). RLS on class_notes/attendance uses `portal_is_teacher_of` / `portal_can_mark`.
Acceptance criteria:
- Given teacher T of class A, When T opens /min-side/klasse/<B-id>, Then the response is 404.
- Given T, When T calls `saveClassNote(B, day)`, Then the result is `forbidden` and no note exists for B.
- Given T, When T calls `markAttendance(studentInB, day)` or `markAttendanceMany([a1, b1])`, Then the result is `forbidden` and no rows are written (the whole upsert fails).
- Given T, When T calls the RPC `portal_class_roster(B, day)` directly, Then it raises 42501.
Test type: integration (RLS) + e2e
Priority: P0

### CLS-12: Klasse uten lærer
**Som** administrator **vil jeg** se hvilke klasser som mangler lærer **slik at** ingen klasse står uten ansvarlig.
Status: PARTIAL
Evidence: live, 11 of 13 classes have no teacher in the active year. The class list (`admin/klasser/page.tsx:23-55`) does not load or show teachers. It only shows on each class page and on /admin/laerere.
Acceptance criteria:
- Given a class with no class_teachers row in the active year, When the admin opens /admin/klasser, Then the row shows "Ingen lærer".
- Given the class detail page, Then the teacher section shows an empty state with a link to add a teacher.
- Given a class without a teacher, Then parents of students in it see "Lærer ikke satt" (not a blank) on Mine barn.
Test type: e2e
Priority: P2

### CLS-13: Flytte elev mellom klasser midt i året
**Som** administrator **vil jeg** flytte en elev til en annen klasse **slik at** eleven går i riktig gruppe, med riktig pris og historikk.
Status: PARTIAL
Evidence: `changeEnrollmentClass` (students-actions.ts:778-839) updates class_id in place and checks capacity. It does not change `price_snapshot` or `student_fees` to the new class price (the pricing is only used for the capacity text). It does not check age range. There is no dated class history except the audit log.
Acceptance criteria:
- Given a student in A (price 5000) moved to B (price 6000), When the admin confirms, Then the admin is asked whether to change the fee, and the choice is stored and audited.
- Given B is full, Then the move is blocked with the "er full" message.
- Given the student's age is outside B's range, Then the admin gets a warning before confirming.
- Given the move, Then the student's page shows "Flyttet fra A til B <dato>".
Test type: integration
Priority: P1

### CLS-14: Oppmøtehistorikk følger eleven riktig ved klassebytte
**Som** lærer **vil jeg** at fravær fra elevens forrige klasse er tydelig merket **slik at** jeg ikke endrer en annen lærers føring ved en feil.
Status: PARTIAL
Evidence: `attendance` has no class_id (PK student_id, school_day_id). `portal_can_mark` uses the current enrollment's class (hardening.sql:16-38). After a move, the new teacher can edit all earlier days and the old teacher loses access to their own entries. The admin class page counts the student's whole-year attendance under the new class (admin/klasser/[id]/page.tsx:196-205).
Acceptance criteria:
- Given a student moved from A to B on day D, When teacher B opens a day before D, Then the student is either not listed or shown read-only as "i klasse A".
- Given teacher A after the move, When A opens a day before D, Then A still sees the attendance A recorded.
- Given the admin page for B, Then the attendance summary counts only days since the student joined B.
Test type: integration (RLS)
Priority: P2

### CLS-15: Opprette neste skoleår med gyldige datoer
**Som** administrator **vil jeg** opprette neste skoleår med start, slutt og pris **slik at** jeg kan forberede opptak.
Status: PARTIAL
Evidence: `createSchoolYear` (school-years-actions.ts:55-111) does not check `starts_on <= ends_on` or the label format. The age rule uses `schoolYearStart(label)` (age.ts:1-5), so a label without a 4-digit year falls back to the current year. `requireAdmin` throws rather than returning an error (:12-15).
Acceptance criteria:
- Given starts_on 2027-08-01 and ends_on 2027-06-01, When saved, Then a validation error is shown.
- Given the label "Neste år" (no year), When saved, Then it is rejected or a format hint is shown.
- Given a duplicate label, Then "Det finnes allerede et skoleår med dette navnet" is shown.
- Given a signed-in user who is not an admin, When they call the action, Then it returns `{ ok:false }` and does not throw.
Test type: integration
Priority: P2

### CLS-16: Bare ett aktivt skoleår
**Som** administrator **vil jeg** at bare ett skoleår er aktivt om gangen **slik at** portal, betaling og klasselister viser samme år.
Status: WORKS
Evidence: live unique index `school_years_one_active` on `((true)) WHERE is_active`. The RPC `set_active_school_year` deactivates the others first (single_active_school_year.sql:5-30). The form locks the switch for the active year (school-year-form.tsx:37-38,188-199).
Acceptance criteria:
- Given 2026/2027 is active, When the admin activates 2027/2028, Then exactly one row has is_active=true (2027/2028).
- Given a direct `update school_years set is_active=true` on a second row, Then it fails with 23505.
- Given the active year, When the admin tries to delete it, Then "Kan ikke slette det aktive skoleåret" is shown.
Test type: integration
Priority: P1

### CLS-17: Aktivering av nytt skoleår varsler om konsekvenser
**Som** administrator **vil jeg** se hva som skjer i portalen før jeg aktiverer et nytt skoleår **slik at** foresatte og lærere ikke plutselig ser en tom side.
Status: MISSING
Evidence: the only hint is "Dette året blir standard for nye plasseringer og betalinger." (school-year-form.tsx:201-208). `portal_my_children` and `portal_my_classes` filter on `sy.is_active` (portal_rpcs.sql:46,88). Activating a year with no enrollments, teachers or school days empties Mine barn and Min klasse for everyone.
Acceptance criteria:
- Given target year Y with 0 enrollments, 0 class_teachers and 0 school_days, When the admin turns on "Aktivt skoleår", Then a checklist shows those three counts and asks for confirmation.
- Given the admin confirms, Then the activation is audited with the counts.
- Given Y has everything in place, Then no warning is shown.
Test type: e2e
Priority: P1

### CLS-18: Lærertildelinger følger med over skoleårsovergang
**Som** administrator **vil jeg** forberede lærere for neste skoleår før det aktiveres **slik at** lærerne har tilgang fra første skoledag.
Status: MISSING
Evidence: `assignTeacher` always uses the active year (portal-admin-actions.ts:56-57). `rollover_enrollments` does not copy class_teachers (enrollment_rollover.sql:62-143). `grep class_teachers src` shows only assign/remove/list uses. On activation every teacher loses Min klasse until the admin assigns each one again.
Acceptance criteria:
- Given a non-active year Y, When the admin opens class A for Y, Then they can assign teachers for Y.
- Given the rollover page, When the admin confirms, Then there is an option to "kopier lærere" from the source year, which creates class_teachers rows for Y.
- Given Y is then activated, Then teacher T (assigned to A in Y) sees A in /min-side right away.
- Given Y is activated, Then T's assignment in the previous year no longer gives any write access (portal_can_mark requires the active year).
Test type: integration + e2e
Priority: P1

### CLS-19: Skoleårsovergang respekterer kapasitet
**Som** administrator **vil jeg** at flytting av elever til nytt år ikke overfyller klasser **slik at** kapasiteten holder.
Status: BROKEN
Evidence: `rollover_enrollments` inserts enrollments with no capacity check (enrollment_rollover.sql:97-110), while `placeStudentInClass`/`changeEnrollmentClass` do check (students-actions.ts:610-624). The rollover page shows counts, but the server does not enforce them.
Acceptance criteria:
- Given class B with capacity 10 and 9 students already in Y, When the rollover places 3 more in B, Then the call fails (or asks for confirmation) naming B and the overflow.
- Given a class with no capacity (null), Then any number is accepted.
- Given a rollover that ends partway, Then no partial set is left behind (the RPC is one transaction).
Test type: integration (RPC)
Priority: P2

### CLS-20: Skoledager følger skoleårets datoer
**Som** administrator **vil jeg** at skoledagene genereres og oppdateres når datoene endres **slik at** lærere og foresatte ser riktige søndager.
Status: PARTIAL
Evidence: days are only generated by a manual button (school-days.tsx:49, `ensure_school_days`). `updateSchoolYear` does not regenerate or prune days outside a new start/end (school-years-actions.ts:113-161). Days are Sundays only (portal_schema.sql:343).
Acceptance criteria:
- Given a new year with dates, When it is created, Then the admin is prompted to generate school days (or they are generated automatically).
- Given generated days, When ends_on is moved earlier, Then the days after it are listed for removal (if they have no attendance) or flagged.
- Given "Generer" is clicked twice, Then no duplicates are created (unique school_year_id, date) and the count shows 0 new.
Test type: integration
Priority: P2

### CLS-21: Slette skoleår sletter ikke økonomidata i stillhet
**Som** administrator **vil jeg** ikke kunne slette et skoleår som har krav eller betalingsfordelinger **slik at** regnskapet ikke forsvinner.
Status: BROKEN (latent)
Evidence: live FKs make `student_fees`, `payment_allocations`, `student_fee_adjustments`, `payment_plans`, `installments`, `school_days`, `class_teachers` all CASCADE on the school year. Only `enrollments` is RESTRICT. A year whose enrollments were removed (`removeEnrollment`, students-actions.ts:873) but which still has fees or allocations is deleted along with its ledger. `payments.school_year_id` is SET NULL (2 payments point at 2025/2026 today).
Acceptance criteria:
- Given year Y with 0 enrollments but 1 payment_allocation, When the admin deletes Y, Then the delete is refused with a message about payments.
- Given year Y with attendance or class_notes, Then the delete is refused or needs explicit confirmation listing the counts.
- Given an empty year Y, Then the delete succeeds and is audited.
Test type: integration
Priority: P0

### CLS-22: Føre oppmøte for dagens skoledag
**Som** lærer **vil jeg** markere til stede, fravær eller sent for hver elev, og alle på en gang **slik at** oppmøte blir registrert raskt.
Status: WORKS
Evidence: `markAttendance`/`markAttendanceMany` upsert on the PK (actions.ts:139-219). The trigger stamps marked_by/marked_at (hardening.sql:126-146). Absence reported by a parent sets `meldt_fravaer` through a trigger (portal_schema.sql:203-229). The roster shows "meldt fravær" (attendance-roster.tsx:94-108).
Acceptance criteria:
- Given teacher T on today's school day, When T taps "Til stede" on student S, Then attendance(S, day) = til_stede and marked_by = T's uid.
- Given T marks S twice with different statuses, Then there is one row with the latest status (no duplicate).
- Given "Marker resten til stede", Then only unmarked students get til_stede, and existing meldt_fravaer rows stay.
- Given a parent reported absence for S, Then S shows "Meldt fravær" with the reason before T marks anything.
Test type: e2e + integration
Priority: P0

### CLS-23: Oppmøte kan ikke føres på fremtidige eller avlyste dager
**Som** administrator **vil jeg** at oppmøte bare kan føres på dager som har vært **slik at** statistikken er riktig.
Status: PARTIAL
Evidence: the UI disables marking (`markable`, page.tsx:59-60, attendance-roster.tsx:80,123). The DB policy `portal_can_mark` (hardening.sql:16-38) and `markAttendance` do not check `date <= today` or `not cancelled`, so a direct action call succeeds.
Acceptance criteria:
- Given a school day next Sunday, When teacher T calls `markAttendance(S, futureDay, "fravaer")`, Then it returns an error and no row is written.
- Given a cancelled day, When T calls `markAttendanceMany`, Then it is rejected.
- Given a past day in the active year, When T corrects a status, Then it succeeds and is audited (edits to past days are allowed, decision recorded).
Test type: integration (RLS)
Priority: P1

### CLS-24: Skrive, endre og fjerne ukenotat
**Som** lærer **vil jeg** skrive lekse og oppsummering for en skoledag, rette det senere, og fjerne det **slik at** foresatte får riktig beskjed.
Status: PARTIAL
Evidence: create and edit work via upsert (actions.ts:228-263, `class-note-editor.tsx:46-51`, maxLength 2000). There is no delete: clearing both fields leaves an empty row. That empty row is then the "latest note" on parent home and hides older homework (parent-data.ts:26, child-card.tsx:107). It is also listed empty under "Tidligere" (page.tsx:56-58,146-167). There is no conflict detection between two teachers.
Acceptance criteria:
- Given no note for day D, When T saves homework "Surah Al-Fatiha", Then one class_notes row exists and the parent sees it on Mine barn.
- Given the note, When T edits the summary, Then updated_at changes and the "Lagret" label updates.
- Given T clears both fields and saves, Then the row is deleted (or ignored), and the parent sees the previous non-empty note.
- Given two teachers of A edit the same day, When the second saves over a newer version, Then they are warned (or the overwrite is at least audited).
- Given a cancelled day, Then the editor is disabled, and a direct `saveClassNote` call is rejected.
Test type: e2e + integration
Priority: P1

### CLS-25: Foresatt ser lekse for barnets klasse, og bare den
**Som** foresatt **vil jeg** se siste lekse og oppsummering for mitt barns klasse **slik at** jeg kan følge opp hjemme.
Status: PARTIAL
Evidence: RLS `guardian reads class` = `portal_is_guardian_in_class(class_id)` (portal_schema.sql:296-298) has no year filter, so notes from earlier years of the same class_id are readable. `getClassNotes` (data.ts:170-193) has no year filter either. A note for a future day is hidden until that date.
Acceptance criteria:
- Given parent P whose child is active in A in the active year, When P opens /min-side, Then the latest non-empty note for A (date <= today) is shown on the child card.
- Given P, When P queries class_notes for class B (no child there), Then 0 rows are returned.
- Given class A has notes from last year, Then P sees only notes from the active year.
- Given P's child is moved from A to B, Then P sees B's notes and no longer sees A's.
Test type: integration (RLS) + e2e
Priority: P1

### CLS-26: Administrator kan se og rette i klasseportalen
**Som** administrator **vil jeg** åpne en klasses oppmøte og ukenotater **slik at** jeg kan hjelpe en lærer eller føre oppmøte når læreren er borte.
Status: MISSING
Evidence: `/min-side/klasse/[classId]` gives 404 for an admin who is not assigned (page.tsx:39-40, `getMyClasses` = teacher assignments only). The admin class page shows only an attendance summary (admin/klasser/[id]/page.tsx:100-112) and no notes. `grep class_notes src/app/[locale]/admin` returns no hits. The DB already allows it: `portal_class_roster` allows `is_admin()`, and the `admin all` policies exist.
Acceptance criteria:
- Given an admin, When they open /admin/klasser/<A> and choose "Åpne klasseportal", Then they see the roster and notes for any day.
- Given the admin marks attendance for a student, Then the row is saved with marked_by = the admin's uid and is audited.
- Given the admin, Then the ukenotat for each held day is visible on the class page.
Test type: e2e
Priority: P1

### CLS-27: Tomtilstander i Min klasse
**Som** lærer **vil jeg** få en forklarende melding når det mangler skoledager, elever eller notater **slik at** jeg vet om noe er feil eller bare ikke satt opp.
Status: PARTIAL
Evidence: no days shows `t("noDays")` (page.tsx:136-138). No previous notes shows `t("previous.empty")` (:171-173). A teacher with no classes and no children gets the generic empty card (min-side/page.tsx:41-69). An empty roster (class with 0 students) has not been checked in `AttendanceRoster`.
Acceptance criteria:
- Given a teacher of class A where the year has 0 school days, Then "Ingen skoledager" is shown and there is no attendance form.
- Given class A with 0 active students, Then the roster shows "Ingen elever i klassen ennå".
- Given a teacher whose assignment was removed, When they open /min-side, Then they see the "no role" card with the contact email, and do not get an error.
Test type: e2e
Priority: P2

### CLS-28: Alder vises etter kalenderårsregelen overalt
**Som** administrator **vil jeg** at elevens alder er lik på klasseside, overgang og lærerportal **slik at** plassering etter alder blir konsekvent.
Status: WORKS
Evidence: all three use `ageInYear(birth, schoolYearStart(label))` (admin class page.tsx:250,301; rollover/page.tsx ageYear; portal data.ts:22-24,135). `placement.ts:25-32` uses the same age for suggestions.
Acceptance criteria:
- Given a child born 2020-12-31 and year "2026/2027", Then the age shows 6 on the admin class page, the rollover page and the teacher roster.
- Given a year label with no 4-digit year, Then the fallback is the current Oslo year (documented), not NaN.
- Given class age range 6-8, Then the register suggests that class for a child who turns 6 in 2026.
Test type: unit (age.ts) + integration
Priority: P2
