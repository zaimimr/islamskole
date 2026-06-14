import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUser } from "@/app/[locale]/admin/actions";
import { PageHeader } from "@/components/admin/page-header";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      ((profiles as { id: string; full_name: string | null; role: string }[] | null) ?? []).map(
        (p) => [p.id, p],
      ),
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
  return date.toLocaleDateString("nb-NO", { dateStyle: "medium" });
}

export default async function BrukerePage() {
  const [users, currentId] = await Promise.all([getUsers(), getCurrentUserId()]);

  return (
    <div>
      <PageHeader
        title="Brukere"
        description="Opprett og administrer administratorer. Nye brukere får et midlertidig passord."
        action={<CreateUserDialog />}
      />

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen brukere funnet.
            </p>
          ) : (
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
                        <span className="ml-2 text-xs text-muted-foreground">
                          (deg)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "admin" ? "default" : "secondary"}
                      >
                        {user.role === "admin" ? "Administrator" : "Medlem"}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
