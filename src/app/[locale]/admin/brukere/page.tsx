import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserRoundCheck, Users } from "lucide-react";
import { getIsAdmin, getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatOsloDate } from "@/lib/dates";
import { adminBasePath } from "@/components/admin/paths";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadError } from "@/components/admin/load-error";
import { StatusPill } from "@/components/admin/status-pill";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Brukere" };

type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
};

async function getUsers(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false }
> {
  try {
    const admin = createAdminClient();
    const [list, profiles] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 200 }),
      admin.from("profiles").select("id, full_name, role"),
    ]);
    if (list.error || profiles.error) return { ok: false };

    const profileMap = new Map(
      (
        (profiles.data as
          { id: string; full_name: string | null; role: string }[] | null) ?? []
      ).map((p) => [p.id, p]),
    );

    return {
      ok: true,
      users: list.data.users.map((user) => {
        const profile = profileMap.get(user.id);
        return {
          id: user.id,
          email: user.email ?? "-",
          fullName:
            profile?.full_name ||
            (user.user_metadata?.full_name as string | undefined) ||
            null,
          role: profile?.role ?? "member",
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        };
      }).filter((user) => user.role === "admin"),
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
            Brukere
          </h1>
          <p className="mt-1 max-w-2xl text-admin-muted">
            Hvem som kan logge inn og se skolens opplysninger om barn, familier
            og betalinger.
          </p>
        </div>
        <CreateUserDialog />
      </header>

      <section
        aria-labelledby="user-access-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <h2 id="user-access-title" className="font-heading text-xl font-bold">
            Tilgang til administrasjonen
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted">
            {users.length} {users.length === 1 ? "bruker" : "brukere"},{" "}
            {adminCount === users.length
              ? "alle er administratorer"
              : `${adminCount} administratorer`}
          </p>
        </div>
        {users.length === 0 ? (
          <EmptyState
            icon={<Users aria-hidden="true" />}
            title="Ingen brukere funnet"
            description="Opprett en administrator for å gi tilgang til systemet."
          />
        ) : (
          <ul className="divide-y divide-[#ECE8DF]">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-start gap-3 px-4 py-4 sm:items-center sm:px-5"
              >
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
                    <StatusPill tone={user.role === "admin" ? "ok" : "neutral"}>
                      {user.role === "admin"
                        ? "Administrator"
                        : "Ingen administratortilgang"}
                    </StatusPill>
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
                  canDelete={user.id !== currentId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
