import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRoundCheck, Users } from "lucide-react";
import { getIsAdmin, getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatOsloDate } from "@/lib/dates";
import { adminBasePath } from "@/components/admin/paths";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadError } from "@/components/admin/load-error";
import { StatusPill } from "@/components/admin/status-pill";
import { OptimisticRemovalList } from "@/components/admin/optimistic-removal-list";
import { GrantAdminForm } from "./grant-admin-form";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Brukere og tilganger" };

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isTeacher: boolean;
  isGuardian: boolean;
  isStudent: boolean;
  lastSignInAt: string | null;
};

async function listAllUsers() {
  const admin = createAdminClient();
  const users = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function getUsers(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false }
> {
  try {
    const admin = createAdminClient();
    const [users, profiles, guardians, students] = await Promise.all([
      listAllUsers(),
      admin.from("profiles").select("id, full_name, role"),
      admin
        .from("guardians")
        .select("email, is_teacher, family_guardians(family_id)")
        .not("email", "is", null),
      admin.from("students").select("child_email").not("child_email", "is", null),
    ]);
    if (profiles.error || guardians.error || students.error) return { ok: false };

    const profileMap = new Map(profiles.data.map((p) => [p.id, p]));
    const teacherEmails = new Set<string>();
    const guardianEmails = new Set<string>();
    for (const guardian of guardians.data) {
      const email = (guardian.email ?? "").trim().toLowerCase();
      if (guardian.is_teacher) teacherEmails.add(email);
      if (guardian.family_guardians.length > 0) guardianEmails.add(email);
    }
    const studentEmails = new Set(
      students.data.map((student) => (student.child_email ?? "").trim().toLowerCase()),
    );

    return {
      ok: true,
      users: users
        .map((user) => {
          const profile = profileMap.get(user.id);
          const email = (user.email ?? "").toLowerCase();
          return {
            id: user.id,
            email: user.email ?? "-",
            fullName:
              profile?.full_name ||
              (user.user_metadata?.full_name as string | undefined) ||
              null,
            role: profile?.role ?? "member",
            isTeacher: teacherEmails.has(email),
            isGuardian: guardianEmails.has(email),
            isStudent: studentEmails.has(email),
            lastSignInAt: user.last_sign_in_at ?? null,
          };
        })
        .sort(
          (a, b) =>
            Number(b.role === "admin") - Number(a.role === "admin") ||
            (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email, "nb"),
        ),
    };
  } catch {
    return { ok: false };
  }
}

export default async function BrukerePage({
  params,
}: PageProps<"/[locale]/admin/brukere">) {
  const { locale } = await params;
  if (!(await getIsAdmin())) notFound();

  const [result, currentUser] = await Promise.all([getUsers(), getUser()]);
  if (!result.ok) {
    return (
      <LoadError
        title="Brukerne kunne ikke lastes"
        retryHref={`${adminBasePath(locale)}/brukere`}
      />
    );
  }
  const users = result.users;
  const currentId = currentUser?.id ?? null;
  const adminCount = users.filter((user) => user.role === "admin").length;

  return (
    <div className="grid gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            Brukere og tilganger
          </h1>
          <p className="mt-1 max-w-2xl text-admin-muted">
            Alle som kan logge inn. Alle logger inn med en lenke på e-post.
            Administratorer ser skolens opplysninger om barn, familier og
            betalinger.
          </p>
        </div>
      </header>

      <GrantAdminForm />

      <section
        aria-labelledby="user-access-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <h2 id="user-access-title" className="font-heading text-xl font-bold">
            Innlogginger
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted">
            {users.length} {users.length === 1 ? "bruker" : "brukere"},{" "}
            {adminCount} {adminCount === 1 ? "administrator" : "administratorer"}
          </p>
        </div>
        {users.length === 0 ? (
          <EmptyState
            icon={<Users aria-hidden="true" />}
            title="Ingen brukere funnet"
            description="Gi noen administratortilgang for å komme i gang."
          />
        ) : (
          <OptimisticRemovalList
            className="divide-y divide-[#ECE8DF]"
            itemClassName="flex items-start gap-3 px-4 py-4 sm:items-center sm:px-5"
            rows={users.map((user) => ({
              id: user.id,
              content: (
                <>
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B] sm:flex">
                    <UserRoundCheck aria-hidden="true" className="size-5" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {user.fullName ?? user.email}
                        {user.id === currentId ? (
                          <StatusPill tone="info">Din konto</StatusPill>
                        ) : null}
                      </p>
                      {user.fullName ? (
                        <p className="mt-0.5 text-sm break-all text-admin-muted">
                          {user.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-admin-muted">
                      {user.role === "admin" ? (
                        <StatusPill tone="ok">Admin</StatusPill>
                      ) : null}
                      {user.isTeacher ? (
                        <StatusPill tone="info">Lærer</StatusPill>
                      ) : null}
                      {user.isGuardian ? (
                        <StatusPill tone="neutral">Foresatt</StatusPill>
                      ) : null}
                      {user.isStudent ? (
                        <StatusPill tone="neutral">Elev</StatusPill>
                      ) : null}
                      <span>
                        {user.lastSignInAt
                          ? `Sist innlogget ${formatOsloDate(user.lastSignInAt)}`
                          : "Har ikke logget inn ennå"}
                      </span>
                    </div>
                  </div>
                  <UserRowActions
                    userId={user.id}
                    email={user.email}
                    isSelf={user.id === currentId}
                    isAdmin={user.role === "admin"}
                    isTeacher={user.isTeacher}
                  />
                </>
              ),
            }))}
          />
        )}
      </section>
    </div>
  );
}
