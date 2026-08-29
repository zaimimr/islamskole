import {
  Clock3,
  KeyRound,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUser } from "@/app/[locale]/admin/actions";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
};

async function getUsers(): Promise<AdminUser[]> {
  try {
    const admin = createAdminClient();
    const [{ data: list }, { data: profiles }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 200 }),
      admin.from("profiles").select("id, full_name, role"),
    ]);

    const profileMap = new Map(
      (
        (profiles as
          | { id: string; full_name: string | null; role: string }[]
          | null) ?? []
      ).map((p) => [p.id, p]),
    );

    return (list?.users ?? []).map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "-",
        fullName:
          profile?.full_name ||
          (user.user_metadata?.full_name as string | undefined) ||
          "-",
        role: profile?.role ?? "member",
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
      };
    });
  } catch {
    return [];
  }
}

async function getCurrentUserId() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("nb-NO", {
    dateStyle: "medium",
    timeZone: "Europe/Oslo",
  });
}

export default async function BrukerePage() {
  const [users, currentId] = await Promise.all([
    getUsers(),
    getCurrentUserId(),
  ]);
  const adminCount = users.filter((user) => user.role === "admin").length;
  const signedInCount = users.filter((user) => user.lastSignInAt).length;

  return (
    <div className="grid gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Brukere
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
            Administrer hvem som har tilgang til skolens følsomme opplysninger
            og administrative verktøy.
          </p>
        </div>
        <CreateUserDialog />
      </header>

      <section
        aria-label="Status for brukertilgang"
        className="grid overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] sm:grid-cols-3"
      >
        <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF8FD] text-[#245D7C]">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {users.length}
            </p>
            <p className="text-sm text-admin-muted">Brukerkontoer</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {adminCount}
            </p>
            <p className="text-sm text-admin-muted">Administratorer</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
            <Clock3 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {signedInCount}
            </p>
            <p className="text-sm text-admin-muted">Har logget inn</p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="user-access-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <div>
            <h2
              id="user-access-title"
              className="font-heading text-xl font-bold"
            >
              Tilgang til administrasjonen
            </h2>
            <p className="mt-0.5 text-sm text-admin-muted">
              Kontroller rolle, siste innlogging og passordtilgang.
            </p>
          </div>
          <KeyRound aria-hidden="true" className="size-5 text-admin-muted" />
        </div>
        {users.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <Users aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 font-heading text-xl font-bold">
              Ingen brukere funnet
            </p>
            <p className="mt-1 max-w-md text-sm text-admin-muted">
              Opprett en administrator for å gi tilgang til systemet.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Brukernavn</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Opprettet</TableHead>
                    <TableHead>Sist innlogget</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName}
                        {user.id === currentId ? (
                          <span className="ml-2 rounded-full bg-[#DCEDDD] px-2 py-0.5 text-xs font-bold text-[#216A2B]">
                            Din konto
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {user.role === "admin"
                            ? "Administrator"
                            : "Begrenset tilgang"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.lastSignInAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <ResetPasswordButton
                            userId={user.id}
                            email={user.email}
                          />
                          {user.id !== currentId ? (
                            <DeleteButton
                              id={user.id}
                              label="bruker"
                              action={deleteUser}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-[#ECE8DF] lg:hidden">
              {users.map((user) => (
                <li key={user.id} className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
                      <UserRoundCheck aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-heading text-lg font-bold">
                          {user.fullName}
                        </p>
                        {user.id === currentId ? (
                          <span className="rounded-full bg-[#DCEDDD] px-2 py-0.5 text-xs font-bold text-[#216A2B]">
                            Din konto
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 break-all text-sm text-admin-muted">
                        {user.email}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-[#F8F6F0] p-3 text-sm">
                        <div>
                          <dt className="text-xs font-bold text-admin-muted">
                            Rolle
                          </dt>
                          <dd className="mt-1 font-bold">
                            {user.role === "admin"
                              ? "Administrator"
                              : "Begrenset tilgang"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold text-admin-muted">
                            Sist innlogget
                          </dt>
                          <dd className="mt-1 font-bold">
                            {formatDate(user.lastSignInAt)}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#ECE8DF] pt-3">
                        <ResetPasswordButton
                          userId={user.id}
                          email={user.email}
                        />
                        {user.id !== currentId ? (
                          <DeleteButton
                            id={user.id}
                            label="bruker"
                            action={deleteUser}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
