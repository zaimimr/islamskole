import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getIsAdmin, getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatOsloDate } from "@/lib/dates";
import { adminBasePath } from "@/components/admin/paths";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadError } from "@/components/admin/load-error";
import { StatusPill } from "@/components/admin/status-pill";
import { OptimisticRemovalList } from "@/components/admin/optimistic-removal-list";
import { Pagination } from "@/components/admin/pagination";
import { cn } from "@/lib/utils";
import { GrantAdminForm } from "./grant-admin-form";
import { UserRowActions } from "./user-row-actions";
import { UserSearch } from "./user-search";

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

const PAGE_SIZE = 25;

const roleFilters = [
  { value: "admin", label: "Admin", match: (user: AdminUser) => user.role === "admin" },
  { value: "alle", label: "Alle", match: () => true },
  { value: "laerer", label: "Lærere", match: (user: AdminUser) => user.isTeacher },
  { value: "foresatt", label: "Foresatte", match: (user: AdminUser) => user.isGuardian },
  { value: "elev", label: "Elever", match: (user: AdminUser) => user.isStudent },
];

export default async function BrukerePage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/brukere">) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const roleParam = typeof sp.rolle === "string" ? sp.rolle : "";
  const activeRole =
    roleFilters.find((filter) => filter.value === roleParam) ?? roleFilters[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const basePath = `${adminBasePath(locale)}/brukere`;
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
  const allUsers = result.users;
  const currentId = currentUser?.id ?? null;
  const searched = q
    ? allUsers.filter((user) =>
        `${user.fullName ?? ""} ${user.email}`.toLowerCase().includes(q),
      )
    : allUsers;
  const filtered = searched.filter(activeRole.match);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const users = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function roleHref(value: string) {
    const params = new URLSearchParams();
    if (typeof sp.q === "string" && sp.q) params.set("q", sp.q);
    if (value !== roleFilters[0].value) params.set("rolle", value);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

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
        <div className="grid gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="user-access-title" className="font-heading text-xl font-bold">
              Innlogginger
            </h2>
            <div className="w-full lg:max-w-sm">
              <UserSearch />
            </div>
          </div>
          <nav aria-label="Filtrer på rolle" className="-mx-1 overflow-x-auto">
            <ul className="flex gap-1 px-1">
              {roleFilters.map((filter) => {
                const active = filter.value === activeRole.value;
                const count = searched.filter(filter.match).length;
                return (
                  <li key={filter.value}>
                    <Link
                      href={roleHref(filter.value)}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "bg-[#DCEDDD] text-[#216A2B]"
                          : "text-admin-muted hover:bg-[#F4F1EA] hover:text-foreground",
                      )}
                    >
                      {filter.label}
                      <span className="tabular-nums opacity-70">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        {users.length === 0 ? (
          <EmptyState
            icon={<Users aria-hidden="true" />}
            title="Ingen brukere funnet"
            description={
              q || activeRole.value !== "alle"
                ? "Prøv et annet søk eller en annen rolle."
                : "Gi noen administratortilgang for å komme i gang."
            }
          />
        ) : (
          <OptimisticRemovalList
            className="divide-y divide-[#ECE8DF]"
            itemClassName="flex items-center gap-3 px-4 py-3 sm:px-5"
            rows={users.map((user) => ({
              id: user.id,
              content: (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      <span className="break-all">{user.fullName ?? user.email}</span>
                      {user.id === currentId ? (
                        <StatusPill tone="info">Din konto</StatusPill>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-admin-muted">
                      {user.fullName ? (
                        <span className="break-all">{user.email} · </span>
                      ) : null}
                      {user.lastSignInAt
                        ? `Sist inne ${formatOsloDate(user.lastSignInAt)}`
                        : "Aldri logget inn"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
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
        {filtered.length > 0 ? (
          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            basePath={basePath}
            searchParams={sp}
          />
        ) : null}
      </section>
    </div>
  );
}
