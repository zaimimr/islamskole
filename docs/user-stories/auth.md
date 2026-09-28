# Identity, login and roles: user stories

Audited at commit e4802fa (2026-09-29). Read-only: code, migrations and SELECT-only SQL against prod.

## 1. Current behavior

### Two separate login doors, two separate identity models

| | Admin door | Portal door |
|---|---|---|
| URL | `/login` (Norwegian only, `/en/login` is redirected to `/login`, `src/proxy.ts:9,15-19`) | `/min-side/logg-inn` (localized) |
| Method | Email + password, client-side `signInWithPassword` (`src/app/[locale]/login/page.tsx:42-46`) | Emailed magic link, server action `sendPortalLoginLink` (`src/lib/portal/actions.ts:108-125`) |
| Who gets access | `profiles.role = 'admin'` (`src/lib/auth.ts:15-25`, `is_admin()` in `supabase/migrations/20260614120000_init.sql:10-21`) | Anyone whose JWT email equals `lower(guardians.email)` (`portal_guardian_ids()`, `supabase/migrations/20260927123038_portal_schema.sql:67-79`) |
| Account creation | Admin creates it in Brukere, a random password is shown once and must be handed over manually (`src/app/[locale]/admin/actions.ts:906-937`, `src/app/[locale]/admin/brukere/user-row-actions.tsx:169-172`). No email is sent. | Auth user is auto-created on first login request if a guardian row with that email exists (`src/lib/portal/actions.ts:71-91`), `app_metadata.role = member` |
| Landing | Always `/admin` or a safe `next` inside `/admin` (`login/page.tsx:12-18,52`) | Always `/min-side` (`src/app/[locale]/min-side/auth/bekreft/route.ts:22-24`) |

The header "Logg inn" link on the public site goes to the portal door (`src/components/site/SiteHeader.tsx:70`). The portal page links to the admin door ("Administrator? Logg inn her", `min-side/logg-inn/page.tsx:29-34`). The admin door has no link back to the portal door.

### How a teacher gets access today
1. A teacher is a `guardians` row with `is_teacher = true` (`supabase/migrations/20260829115545_guardian_roles.sql:1-5`), created or flagged by `registerTeacher` (`src/app/[locale]/admin/familier/families-actions.ts:463-558`). No email is sent at that point.
2. To see "Min klasse" the teacher also needs a `class_teachers` row for the active school year (`portal_my_classes`, `supabase/migrations/20260927123055_portal_rpcs.sql:57-93`; assigned via `assignTeacher`, `src/app/[locale]/admin/portal-admin-actions.ts:46-92`).
3. The teacher then either (a) goes to `/min-side/logg-inn` and types their email, or (b) the admin clicks "Send innloggingslenke" on the Lærere page (`src/app/[locale]/admin/laerere/page.tsx:425-430`, `src/components/admin/send-login-link-button.tsx`, action `sendLoginLinkToGuardian`, `portal-admin-actions.ts:181-245`). Both paths call Supabase `signInWithOtp` and the email is sent by Supabase Auth, not by Resend (`src/lib/email.ts` has no login template).
4. So the owner's "I have to give teachers a link" is literally path (b): self-serve (a) exists but nothing tells a teacher it exists. The portal copy says "the email you gave the school at enrollment" (`messages/no.json` portal.login.intro), which does not speak to teachers who are not parents.

Prod facts (SQL, 2026-09-29): 5 auth users (4 admin, 1 member). 2 guardians with `is_teacher`, 1 of them has never had an auth user. 0 admins are also teachers. 1 admin email matches a guardian row. 17 emails are shared by more than one guardian row, 7 of those across different names, max 6 rows on one email.

### Roles model
- `profiles.role` is `admin | member` only (`supabase/migrations/20260614170000_user_roles.sql:1-3`). Teacher and parent are not roles, they are derived from `guardians` + `student_guardians` + `class_teachers` by email match.
- Role is set from `raw_app_meta_data.role` on user creation and users can no longer write `profiles` (`supabase/migrations/20260927101047_lock_profile_roles.sql`). Earlier `20260614170000_user_roles.sql:13` read the role from user-controlled `raw_user_meta_data`; that hole is closed.
- One person can be admin + parent + teacher at once only if their admin auth user was created first with the same email as their guardian row. The reverse (portal member first, then promote to admin) is impossible in the UI: `createUser` fails with `email_exists` (`actions.ts:919-927`, `toAuthUserError` at `actions.ts:49-53`), and there is no "promote" or "demote" action anywhere.
- Brukere lists admins only (`src/app/[locale]/admin/brukere/page.tsx:59`); portal members are invisible and cannot be managed.
- Admin shell has no link to `/min-side`; `/min-side` shows "Til administrasjonen" only in the no-role empty state (`src/app/[locale]/min-side/page.tsx:62-66`).

### Magic link mechanics
- Throttle: 5 requests/min per IP, 3 per 10 min per email, 60 per hour globally (`src/lib/portal/actions.ts:68-69,110`, table `portal_login_throttle`, `supabase/migrations/20260927125407_portal_hardening.sql:148-187`). Honeypot + 2 s time trap (`actions.ts:114-118`).
- Response is always "check your email" regardless of whether the email exists; the actual send runs in `after()` and failures are only `console.error`ed (`actions.ts:65-106,123`).
- The confirm route verifies `token_hash` server-side, so cross-device opening works if the Supabase email template links to `/min-side/auth/bekreft?token_hash={{ .TokenHash }}&type=magiclink` (`bekreft/route.ts`). The template lives in the hosted Supabase dashboard and is not in the repo (`supabase/config.toml` has no template). One member signed in on 2026-09-28, so at least one link worked.
- `signInWithOtp` sets no `emailRedirectTo` and no locale, and the confirm route redirects to the locale in its own URL, which is fixed by the template.

### Logout and revocation
- Both logouts call `supabase.auth.signOut()` with no scope (`src/lib/portal/actions.ts:127-131`, `src/app/[locale]/admin/actions.ts:1333-1337`); supabase-js defaults to `scope: 'global'`, which ends every session of that user on every device.
- Delete admin: `auth.admin.deleteUser` (`actions.ts:956-976`), `profiles` cascades (`profiles_id_fkey ON DELETE CASCADE`), `auth.sessions` cascades, `audit_log.actor_id` is set null. Self-delete blocked in UI and server (`brukere/page.tsx:162`, `actions.ts:964-966`).
- Remove teacher: `is_teacher = false` (`families-actions.ts:560-580`); every portal RPC and RLS helper checks `g.is_teacher`, so this is immediate. `class_teachers` rows are left behind.
- JWT expiry is 3600 s (local `supabase/config.toml`, hosted value not verified). Portal access is decided by the JWT email claim, so a deleted user keeps portal reads until the access token expires.

## 2. Ideal flow (recommendation)

1. **One door.** `/logg-inn` asks for email only. If the email is an admin, offer password (or magic link); if it matches any guardian (parent or teacher), send a magic link. After login, route by what the person is: admin only to `/admin`, teacher/parent only to `/min-side`, several roles to a small chooser or to `/min-side` with an "Administrasjon" link.
2. **Invite on assignment.** When the admin registers a teacher or assigns them to a class, show "Send invitasjon nå" (checked by default). The invite is a school-branded email (Resend) that says "Du er lærer for Klasse X" and contains the magic link. Show "Invitert 12. sep" / "Logget inn sist 20. sep" on the Lærere row.
3. **Roles as toggles on a person.** Admin access becomes a toggle on the person (works whether or not an auth user exists), with last-admin and self-demote protection, instead of a separate "create user with password" flow.

## 3. User stories

### AUTH-01: Teacher logs in without the admin sending a link
**Som** lærer **vil jeg** skrive inn e-posten min på innloggingssiden og få en innloggingslenke selv **slik at** jeg ikke må vente på at administratoren sender meg noe.
Status: PARTIAL
Evidence: Self-serve works technically because teachers are guardians (`src/lib/portal/actions.ts:72-81` looks up `guardians` by email, no `is_teacher` filter). But nothing tells teachers about it: `registerTeacher` sends no email (`families-actions.ts:463-558`), portal copy talks only about enrollment (`messages/no.json` portal.login.intro), and the admin door `/login` has no link to the portal door (`login/page.tsx`, no reference to `min-side`).
Acceptance criteria:
- Given a guardian with `is_teacher = true` and a `class_teachers` row in the active year, When they submit their email on `/min-side/logg-inn`, Then one magic link email is sent and opening it lands on `/min-side` showing "Min klasse".
- Given the same teacher on `/login` (admin door), When the page renders, Then a visible link "Lærer eller foresatt? Logg inn med e-post" points to the portal door.
- Given the portal login page, When it renders, Then the intro text mentions both parents and teachers.
Test type: e2e (Playwright)
Priority: P1

### AUTH-02: Teacher is invited automatically when registered or assigned
**Som** administrator **vil jeg** at læreren får en invitasjon på e-post når jeg registrerer dem eller knytter dem til en klasse **slik at** jeg slipper å sende lenker manuelt.
Status: MISSING
Evidence: `registerTeacher` (`families-actions.ts:463-558`) and `assignTeacher` (`portal-admin-actions.ts:46-92`) write rows and audit only. The only way to email a teacher is the manual "Send innloggingslenke" button (`laerere/page.tsx:425-430`). Prod: 1 of 2 teachers has never had an auth user.
Acceptance criteria:
- Given a new teacher with a valid email, When the admin assigns them to a class with "Send invitasjon" checked, Then one invite email is sent and audit `portal.login_link_sent` (or `teacher.invited`) is written.
- Given the invite email, When the teacher opens it, Then they land on `/min-side` with "Min klasse" for that class.
- Given a teacher with placeholder email `mangler@islamskole.no` or no email, When assigned, Then no email is sent and the admin sees "Mangler e-post, invitasjon ikke sendt".
- Given the Lærere list, When it renders, Then each row shows "Ikke invitert", "Invitert <dato>" or "Sist innlogget <dato>".
Test type: integration (server action) + e2e
Priority: P1

### AUTH-03: Admin sees why a teacher cannot see their class
**Som** administrator **vil jeg** se tydelig om en lærer mangler klasse i aktivt skoleår **slik at** læreren ikke logger inn til en tom side.
Status: PARTIAL
Evidence: Lærere page shows "Ingen klasse i år" (`laerere/page.tsx:~410`), but "Send innloggingslenke" is still offered. A teacher without a `class_teachers` row gets the empty state "Ingen barn eller klasser ennå" (`min-side/page.tsx:41-69`) because `isTeacher = classes.length > 0` (`src/lib/portal/data.ts:94`).
Acceptance criteria:
- Given a teacher with no class in the active year, When the admin clicks "Send innloggingslenke", Then the admin is warned that the teacher will see no class, and can still send.
- Given that teacher logs in, When `/min-side` renders, Then the empty state says they are registered as a teacher but not assigned to a class yet (not the parent wording).
Test type: e2e
Priority: P2

### AUTH-04: Admin link email is sent and reported honestly
**Som** administrator **vil jeg** få beskjed om lenken faktisk ble sendt **slik at** jeg vet om læreren eller forelderen har fått den.
Status: WORKS
Evidence: `sendLoginLinkToGuardian` returns errors for invalid email, createUser failure and OTP failure, with a specific 429 message (`portal-admin-actions.ts:197-236`), and writes audit `portal.login_link_sent` (`:238-243`).
Acceptance criteria:
- Given a guardian with a valid email, When the admin clicks "Send innloggingslenke", Then the toast says "Innloggingslenke sendt til <email>" and an audit row exists.
- Given the same guardian twice within the Supabase email rate window, When clicked again, Then the toast shows "Det er nettopp sendt en lenke. Vent litt ...".
- Given a guardian with placeholder email, When clicked, Then the toast shows "Foresatt mangler gyldig e-post." and no auth user is created.
- Given a non-admin session calling the action directly, Then it returns the "ingen tilgang" error and no email is sent.
Test type: integration (server action)
Priority: P1

### AUTH-05: Magic link email is actually deliverable in production
**Som** forelder **vil jeg** få innloggingseposten innen få minutter **slik at** jeg kommer inn på Min side.
Status: UNVERIFIED
Evidence: Mail is sent by Supabase Auth (`signInWithOtp`, `src/lib/portal/actions.ts:98-101`), not Resend. Hosted SMTP settings, sender, template content and the hosted `email_sent` rate limit are not in the repo (local `supabase/config.toml` has `email_sent = 2` per hour). Supabase's built-in SMTP only delivers to project team addresses and is heavily rate limited, so custom SMTP is required for real parents. One member logged in on 2026-09-28 (SQL on `auth.users`), which proves at least one delivery.
Acceptance criteria:
- Given the hosted project, When auth settings are inspected, Then custom SMTP is enabled with a school sender domain (SPF/DKIM pass) and the email rate limit is at least 30/hour.
- Given the magic link template, When inspected, Then the link is `{{ .SiteURL }}/min-side/auth/bekreft?token_hash={{ .TokenHash }}&type=magiclink` and the text is Norwegian and school-branded.
- Given a real external mailbox (test address, not a real parent), When a link is requested, Then it arrives within 2 minutes and is not in spam.
Test type: e2e (manual smoke or mail-catcher) + config check
Priority: P0

### AUTH-06: Silent failures on portal login are visible to someone
**Som** administrator **vil jeg** kunne se når innloggingslenker ikke blir sendt **slik at** jeg kan hjelpe foreldre som sier de ikke fikk e-post.
Status: BROKEN
Evidence: `deliverLoginLink` runs in `after()` and swallows every failure (throttle, lookup error, createUser error, OTP error) with `console.error` only (`src/lib/portal/actions.ts:65-106`). No audit row is written on success or failure, unlike the admin path.
Acceptance criteria:
- Given a portal login request for a known guardian, When the link is sent, Then an audit row `portal.login_link_requested` exists with guardian id (no IP stored beyond what policy allows).
- Given the OTP call fails, When the admin opens the family or teacher row, Then a "Siste innloggingsforsøk feilet" note or audit entry is visible.
- Given an unknown email, Then no audit row with that email is stored (avoid collecting stranger emails).
Test type: integration (server action)
Priority: P2

### AUTH-07: Unknown email sees the same answer as a known email
**Som** skole **vil jeg** at innloggingssiden ikke avslører hvilke e-poster som finnes hos oss **slik at** ingen kan kartlegge hvem som har barn på skolen.
Status: WORKS
Evidence: `sendPortalLoginLink` returns `{ ok: true }` for honeypot, fast submit, unknown and known emails alike (`src/lib/portal/actions.ts:114-124`). Admin login shows a generic "Feil e-post eller passord" (`login/page.tsx:48`). Reset says "Hvis ... har en konto" (`login/page.tsx:241-242`).
Acceptance criteria:
- Given an email not in `guardians`, When submitted on `/min-side/logg-inn`, Then the UI shows "Sjekk e-posten din", no auth user is created and no email is sent.
- Given a known and an unknown email, When both are submitted, Then response body and status are identical and response time differs by under 300 ms (send happens in `after`).
- Given `/login` with a wrong password for an existing and a non-existing admin, Then the same error text is shown.
Test type: integration + e2e
Priority: P1

### AUTH-08: Global throttle cannot be used to lock out all parents
**Som** forelder **vil jeg** kunne få innloggingslenke selv om noen spammer skjemaet **slik at** jeg kommer inn på søndag morgen.
Status: BROKEN
Evidence: Global cap is 60 per hour and is consumed by any well-formed email, including unknown ones, before the guardian lookup (`src/lib/portal/actions.ts:68-81`). Per-IP limit is 5 per minute (`:110`), so one IP can burn the global budget in about 12 minutes. The UI still says "sent" (`:123-124`), so affected parents get nothing and no error.
Acceptance criteria:
- Given 60 requests for random unknown emails within an hour, When a real guardian requests a link, Then their link is still sent.
- Given the global cap is reached, When a request is made, Then an alert or log with severity error is produced and the admin can see it.
- Given the per-email limit (3 per 10 min) is hit, When the same guardian asks a 4th time, Then no email is sent and the UI still does not reveal existence.
Test type: integration (server action with throttle table)
Priority: P1

### AUTH-09: Expired or already used link gives a clear next step
**Som** forelder **vil jeg** få en forståelig melding når lenken er gammel **slik at** jeg kan be om en ny.
Status: WORKS (in code), UNVERIFIED end to end
Evidence: Confirm route redirects to `/min-side/logg-inn?lenke=ugyldig` on missing token, wrong type or `verifyOtp` error (`bekreft/route.ts:16-29`); login form shows `login.invalidLink` (`portal-login-form.tsx:62-66`). `otp_expiry` hosted value not verified (local 3600 s).
Acceptance criteria:
- Given a link that was already used, When opened again, Then the user lands on `/min-side/logg-inn?lenke=ugyldig` and sees "Lenken er brukt eller utløpt".
- Given a link older than the OTP expiry, When opened, Then same result.
- Given `type=recovery` or a missing `token_hash`, When `/min-side/auth/bekreft` is hit, Then no session is created and the same message shows.
- Given a valid link opened on another device than the one that requested it, Then login succeeds.
Test type: e2e
Priority: P1

### AUTH-10: Locale is kept through the magic link
**Som** engelskspråklig forelder **vil jeg** komme tilbake til engelsk Min side etter å ha klikket lenken **slik at** jeg forstår innholdet.
Status: BROKEN
Evidence: `signInWithOtp` passes no locale or `emailRedirectTo` (`src/lib/portal/actions.ts:98-101`, `portal-admin-actions.ts:223-226`). The confirm route takes the locale from its own URL (`bekreft/route.ts:11-12`), which is fixed by the single hosted template. An English user who requested the link from `/en/min-side/logg-inn` lands on the template's locale.
Acceptance criteria:
- Given a user on `/en/min-side/logg-inn`, When they request and open a link, Then they land on `/en/min-side`.
- Given a user on `/min-side/logg-inn`, Then they land on `/min-side`.
- Given the email itself, When sent to an English requester, Then the subject and body are in English (or bilingual).
Test type: e2e
Priority: P2

### AUTH-11: Deep link survives the login round trip
**Som** lærer **vil jeg** komme rett til klassen jeg klikket på etter innlogging **slik at** jeg slipper å lete.
Status: MISSING
Evidence: `/min-side/klasse/[classId]` and `/min-side/barn/[studentId]` redirect logged-out users to `/min-side/logg-inn` without a `next` param (`klasse/[classId]/page.tsx:37`, `barn/[studentId]/page.tsx:27`); the confirm route always redirects to `/min-side` (`bekreft/route.ts:23`). The admin door does support a safe `next` (`login/page.tsx:12-18`, `src/proxy.ts:31-41`).
Acceptance criteria:
- Given a logged-out teacher opening `/min-side/klasse/<id>`, When they log in via magic link, Then they land on `/min-side/klasse/<id>`.
- Given `next=https://evil.example` or `next=//evil`, Then it is ignored and they land on `/min-side`.
Test type: e2e
Priority: P2

### AUTH-12: Promote an existing parent or teacher to admin
**Som** administrator **vil jeg** gi en lærer eller forelder administratortilgang **slik at** en lærer også kan være admin.
Status: BROKEN
Evidence: The only way to create an admin is `createUser`, which calls `auth.admin.createUser` with a new password (`actions.ts:906-937`). If the person has ever used the portal, an auth user already exists and the call fails with "Det finnes allerede en bruker med denne e-postadressen" (`actions.ts:49-53`). There is no promote action, and members are filtered out of Brukere (`brukere/page.tsx:59`). `handle_new_user` uses `on conflict do nothing` (`lock_profile_roles.sql:18-24`), so role cannot change after creation except by SQL.
Acceptance criteria:
- Given a guardian who already has a member auth user, When an admin grants admin access, Then `profiles.role` becomes `admin`, the same auth user is kept, and portal access still works.
- Given a person with no auth user, When granted admin, Then an auth user is created with role admin and an invite email is sent (no password shown on screen).
- Given the change, Then an audit row `user.role_changed` with old and new role exists.
- Given a non-admin calling the action directly, Then it is rejected.
Test type: integration (server action) + e2e
Priority: P1

### AUTH-13: Demote an admin without deleting the person
**Som** administrator **vil jeg** fjerne administratortilgang uten å slette kontoen **slik at** personen fortsatt kan bruke Min side som forelder eller lærer.
Status: MISSING
Evidence: Only "Slett bruker" exists (`user-row-actions.tsx:119-130`, `actions.ts:956-976`). Deleting the auth user also removes their portal login until they request a new link, which silently recreates them as member.
Acceptance criteria:
- Given admin A and admin B, When A removes admin access from B, Then B's `profiles.role` is `member`, B's next `/admin` request redirects to `/login?ingen-tilgang=1`, and B can still open `/min-side`.
- Given B had an open admin tab, When B triggers any admin server action, Then it returns "Kontoen din har ikke tilgang" (checked via `getIsAdmin`, `src/lib/auth.ts:15-25`).
- Given the change, Then an audit row is written.
Test type: integration + e2e
Priority: P1

### AUTH-14: The last admin cannot be removed and an admin cannot lock themself out
**Som** skole **vil jeg** at det alltid finnes minst én administrator **slik at** vi aldri mister tilgangen til systemet.
Status: PARTIAL
Evidence: Self-delete is blocked in UI (`brukere/page.tsx:162`) and server (`actions.ts:964-966`), which implies the actor survives. No demote exists yet, so no guard for self-demote or last-admin demote. No DB-level guard (no trigger on `profiles`).
Acceptance criteria:
- Given admin A is the only admin, When A tries to delete or demote themself, Then the action is rejected with a clear message.
- Given two admins, When A deletes B, Then it succeeds and A remains.
- Given a direct SQL/RPC path that would leave zero admins, Then it is rejected (DB trigger or RPC check).
Test type: integration (server action + DB)
Priority: P1

### AUTH-15: New admin gets an invite instead of a password on screen
**Som** administrator **vil jeg** invitere en ny administrator på e-post **slik at** jeg ikke må formidle et passord manuelt.
Status: PARTIAL
Evidence: `createUser` generates a password and returns it to the UI to copy (`actions.ts:918-936`); `resetUserPassword` does the same (`actions.ts:939-954`, UI text "Gi det til brukeren på en trygg måte", `user-row-actions.tsx:169-172`). No email is sent. Prod: one admin created 2026-07-25 has never signed in (SQL on `auth.users`). Self-service "Glemt passord?" exists (`login/page.tsx:59-78`).
Acceptance criteria:
- Given the admin creates a user with email X, When submitted, Then an invite email with a set-password or magic link is sent to X and no password is displayed.
- Given the invite link, When opened, Then the new admin can set a password on `/login/nytt-passord` and lands on `/admin`.
- Given the Brukere list, Then "Invitert, ikke logget inn" is shown for users with `last_sign_in_at` null.
Test type: e2e
Priority: P2

### AUTH-16: Admin who is also a teacher can reach "Min klasse" from the admin shell
**Som** administrator som også er lærer **vil jeg** bytte mellom administrasjonen og Min klasse **slik at** jeg kan føre fravær uten å logge ut og inn.
Status: PARTIAL
Evidence: Same Supabase session covers both areas; `/min-side` shows tabs "Mine barn / Min klasse" when a user is both (`min-side/page.tsx:30-38`), and `portal_my_classes` works for any auth user whose email matches a teacher guardian. But the admin shell has no link to `/min-side` (no `min-side` reference in `src/components/admin` or `src/app/[locale]/admin`), and `/min-side` only shows "Til administrasjonen" in the no-role empty state (`min-side/page.tsx:62-66`). Prod: 0 admins are teachers today.
Acceptance criteria:
- Given an admin whose email matches a guardian with `is_teacher` and a class, When they open `/admin`, Then a "Min klasse" link is visible and leads to their class.
- Given the same user on `/min-side`, Then an "Administrasjon" link is visible in the header.
- Given an admin who is not a teacher or parent, Then no "Min klasse" link is shown in the admin shell.
Test type: e2e
Priority: P2

### AUTH-17: Admin gets passwordless login only if intended
**Som** skole **vil jeg** bestemme om administratorer kan logge inn med e-postlenke **slik at** adminkontoer ikke får en svakere dør enn vi tror.
Status: PARTIAL
Evidence: Portal login sends a magic link to any auth user whose email matches a guardian (`src/lib/portal/actions.ts:72-101`); for an admin who is also a guardian (1 in prod) this link logs into the admin account and `/admin` works without the password. Admins who are not guardians get no link. Behaviour is inconsistent and undocumented.
Acceptance criteria:
- Given an admin whose email matches a guardian, When they log in via magic link, Then the behaviour matches a written decision (either full admin access, or portal only until password is entered).
- Given an admin who is not a guardian, When they request a portal link, Then behaviour matches the same decision.
Test type: integration
Priority: P2

### AUTH-18: Non-admin who reaches /admin is guided to the right place
**Som** forelder eller lærer som havner på /admin **vil jeg** få beskjed om hvor jeg skal **slik at** jeg ikke tror systemet er ødelagt.
Status: PARTIAL
Evidence: Admin layout redirects non-admins to `/login?ingen-tilgang=1` (`src/app/[locale]/admin/layout.tsx:80-85`), which says "Logg ut og logg inn med en administratorkonto" and offers only "Logg ut" (`login/page.tsx:108-131`). No link to `/min-side`. The recovery flow (`login/nytt-passord/page.tsx:79`) always redirects to `/admin`, so a parent who used "Glemt passord?" also ends here.
Acceptance criteria:
- Given a logged-in member, When they open `/admin`, Then they see a message with a primary button "Gå til Min side" and a secondary "Logg ut".
- Given a member who completes password reset, Then they land on `/min-side`, not `/admin`.
- Given a logged-out user opening `/admin/elever`, Then they are redirected to `/login?next=/admin/elever` and after password login land on `/admin/elever`.
Test type: e2e
Priority: P2

### AUTH-19: User with no role sees a helpful empty state
**Som** innlogget person uten barn eller klasse **vil jeg** forstå hvorfor siden er tom **slik at** jeg vet hvem jeg skal kontakte.
Status: WORKS
Evidence: `min-side/page.tsx:41-69` shows "Ingen barn eller klasser ennå", the email used, contact email from site settings, and a link to admin if the user is admin.
Acceptance criteria:
- Given a guardian with no active enrollment and no class, When they open `/min-side`, Then the empty state shows their email and the school contact email.
- Given an admin with no guardian row, Then the empty state also shows "Til administrasjonen".
- Given the page, Then no other family's data is rendered.
Test type: e2e
Priority: P2

### AUTH-20: Removing a teacher cuts class access immediately
**Som** administrator **vil jeg** at en lærer som fjernes mister tilgang til klassen med en gang **slik at** elevdata ikke vises for feil person.
Status: WORKS
Evidence: `removeTeacher` sets `is_teacher = false` (`families-actions.ts:560-580`). `portal_my_classes`, `portal_is_teacher_of`, `portal_can_mark` all join `g.is_teacher` (`portal_rpcs.sql:87`, `portal_schema.sql:95`, `portal_hardening.sql:34`). Removing a class assignment deletes the `class_teachers` row (`portal-admin-actions.ts:94-124`).
Acceptance criteria:
- Given a logged-in teacher viewing their roster, When the admin removes them from the teacher register, Then the next roster request returns 404/forbidden and attendance upsert fails with RLS.
- Given the teacher is removed only from one class, Then that class disappears and other classes remain.
- Given the removed teacher is also a parent, Then "Mine barn" still works.
Test type: integration (RLS as authenticated user)
Priority: P0

### AUTH-21: Deleting a user ends access everywhere, promptly
**Som** administrator **vil jeg** at en slettet bruker mister all tilgang **slik at** en tidligere ansatt ikke kan lese data.
Status: PARTIAL
Evidence: `deleteUser` removes the auth user; `profiles` and `auth.sessions` cascade (SQL on `pg_constraint`), so `getIsAdmin` and `is_admin()` return false at once and refresh fails. But portal RPCs trust the JWT email claim (`portal_schema.sql:76-78`), and `getUser` uses `getClaims` (`src/lib/auth.ts:9`), so an unexpired access token (up to `jwt_expiry`, local 3600 s) can still read children or class data in `/min-side`.
Acceptance criteria:
- Given user U with an open `/min-side` tab, When an admin deletes U, Then within at most the configured JWT expiry U can no longer load `/min-side` data, and the expiry is documented.
- Given U is deleted, When U tries admin actions, Then they fail immediately.
- Given U requests a new portal link and is still a guardian, Then a new member account is created (documented behaviour), otherwise nothing is sent.
Test type: integration
Priority: P2

### AUTH-22: Changing a guardian's email moves portal access to the new address
**Som** administrator **vil jeg** kunne rette en forelders e-post **slik at** riktig person får tilgang og den gamle adressen mister den.
Status: PARTIAL
Evidence: Admin can edit guardian email (`supabase/migrations/20260829115533_family_admin_edits.sql:123`). Access follows `lower(guardians.email)` at query time (`portal_guardian_ids`), so the old address loses access on its next request and the new address can request a link. The old auth user is left orphaned and is invisible in Brukere (`brukere/page.tsx:59`). No email change for the user themself exists.
Acceptance criteria:
- Given guardian G with email old@x logged in, When the admin changes G's email to new@x, Then old@x's next `/min-side` load shows the no-role empty state.
- Given new@x requests a link, Then they see G's children.
- Given the change, Then the orphaned auth user for old@x is either deleted or flagged for the admin.
Test type: integration
Priority: P1

### AUTH-23: Shared or mistyped guardian emails do not leak other families
**Som** forelder **vil jeg** bare se mine egne barn **slik at** andre familiers data ikke vises for meg.
Status: PARTIAL
Evidence: Identity is email-only; every guardian row with the same `lower(email)` is merged into one login (`portal_guardian_ids`). Prod: 17 emails are shared by multiple guardian rows, 7 across different names, up to 6 rows on one email. If any of those is a typo or a shared family address, the mailbox owner sees all linked children. Author fields use `context.guardianIds[0]` arbitrarily (`src/lib/portal/actions.ts:247,289`).
Acceptance criteria:
- Given two guardians in different families with the same email, When the admin saves the second one, Then a warning "E-posten brukes allerede av <navn> i en annen familie" is shown.
- Given a list of shared emails, When the admin opens the duplicates page, Then emails shared across different families are listed for review.
- Given a logged-in parent, When `/min-side` renders, Then only students linked via `student_guardians` to a guardian with their email are shown (RLS test with two families).
Test type: integration (RLS) + e2e
Priority: P0

### AUTH-24: Public signup cannot be used to claim a parent's email
**Som** skole **vil jeg** at ingen kan opprette en konto med en forelders e-post uten å eie e-posten **slik at** barnedata ikke lekker.
Status: UNVERIFIED
Evidence: Portal access trusts the JWT email claim (`portal_schema.sql:76-78`). The anon key is public, so anyone can call `supabase.auth.signUp` directly. Local `supabase/config.toml` has `enable_signup = true` and `[auth.email] enable_confirmations = false`, which would allow exactly this locally. Memory notes state hosted signup is disabled; not verifiable via SQL. Prod `auth.users` has 0 unconfirmed users.
Acceptance criteria:
- Given the hosted project and the public anon key, When `auth.signUp({ email: <guardian email>, password })` is called, Then it fails with signups disabled.
- Given the same with `signInWithOtp({ shouldCreateUser: true })`, Then no user is created.
- Given the local config, Then `enable_signup = false` (or confirmations on) so local tests mirror prod.
Test type: integration (auth API)
Priority: P0

### AUTH-25: Logging out on one device does not log me out everywhere
**Som** lærer **vil jeg** logge ut på skolens PC uten å bli logget ut på telefonen **slik at** jeg ikke må be om ny lenke hele tiden.
Status: UNVERIFIED (likely BROKEN)
Evidence: Both logouts call `signOut()` without scope (`src/lib/portal/actions.ts:127-131`, `src/app/[locale]/admin/actions.ts:1333-1337`); supabase-js defaults to `scope: 'global'`, revoking all refresh tokens for the user.
Acceptance criteria:
- Given a user logged in on two browsers, When they log out in browser A, Then browser A is logged out and browser B still works after its access token refreshes.
- Given "Logg ut på alle enheter" is offered separately, Then it revokes every session.
- Given logout in the portal, Then the user lands on `/min-side/logg-inn` in their current locale.
Test type: e2e (two browser contexts)
Priority: P2

### AUTH-26: Admin login and password reset are rate limited and robust
**Som** administrator **vil jeg** at innloggingen tåler gjetting av passord **slik at** adminkontoen er trygg.
Status: UNVERIFIED
Evidence: Admin login calls Supabase directly from the browser (`login/page.tsx:42-46`); no app-level throttle. Protection relies on hosted `sign_in_sign_ups` rate limit (local 30 per 5 min per IP) and password length (UI requires 8, `nytt-passord/page.tsx:57`, hosted minimum unknown, local 6). No MFA.
Acceptance criteria:
- Given 31 wrong passwords from one IP in 5 minutes, Then further attempts are rejected with a rate limit and the UI shows a readable message.
- Given the reset form, When submitted twice quickly for the same email, Then only one email is sent and the UI says so.
- Given the hosted auth config, Then minimum password length is at least 8.
Test type: integration (auth API)
Priority: P2

### AUTH-27: Password recovery link works and ends in the right place
**Som** administrator **vil jeg** kunne velge nytt passord fra lenken i e-posten **slik at** jeg kommer inn igjen selv.
Status: WORKS (code), UNVERIFIED end to end
Evidence: `nytt-passord/page.tsx:23-50` handles both `token_hash` + `type=recovery` and an implicit session, shows "Lenken er utløpt eller allerede brukt" otherwise (`:106-127`), validates 8+ chars and match (`:57-64`), and redirects to `/admin` (`:79`).
Acceptance criteria:
- Given a valid recovery link, When opened, Then the form shows, a new password can be saved, and the user lands on `/admin` logged in.
- Given the link is reused, Then the invalid message and "Til innlogging" button show.
- Given the new password equals the old, Then "Det nye passordet må være forskjellig fra det gamle." shows.
Test type: e2e
Priority: P2

### AUTH-28: Admin path protection in the proxy and layout
**Som** skole **vil jeg** at ingen admin-side eller admin-handling kan brukes uten admin-rolle **slik at** elev- og betalingsdata er beskyttet.
Status: WORKS
Evidence: Proxy redirects logged-out GETs on `/admin` to `/login?next=...` (`src/proxy.ts:31-41`). Layout checks `getIsAdmin` (`admin/layout.tsx:80-85`). Server actions call `requireAdmin` (`actions.ts:38-47`, `portal-admin-actions.ts:21-30`, `families-actions.ts` uses `getIsAdmin`). RLS on data tables uses `is_admin()` except the portal policies listed in `pg_policies` (all scoped via portal helpers).
Acceptance criteria:
- Given a logged-out request to any `/admin/*` path, Then it redirects to `/login?next=<path>`.
- Given a member session, When any exported admin server action is invoked directly, Then it returns an error and changes nothing (loop over all exports).
- Given a member JWT, When selecting from `students`, `guardians`, `payments` via PostgREST, Then zero rows are returned except via portal RPCs.
Test type: integration (server actions + RLS)
Priority: P0

## 4. Suggested test setup notes
- Use only `test-admin@islamskole.no` and ZZTEST guardians; never create auth users for real parent emails (project rule).
- Mint sessions with `auth.admin.generateLink({ type: 'magiclink' })` + `verifyOtp` rather than waiting for email.
- RLS tests: create two ZZTEST families and one ZZTEST teacher, sign in as each, and assert row counts from the portal RPCs.
