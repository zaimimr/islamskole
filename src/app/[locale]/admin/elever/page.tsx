import { createClient } from "@/lib/supabase/server";
import { deleteStudentApplication } from "@/app/[locale]/admin/actions";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { StudentStatusSelect } from "@/components/admin/student-status-select";
import { StudentFilters } from "@/components/admin/student-filters";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StudentApplicationRow = {
  id: string;
  child_name: string | null;
  child_age: number | null;
  guardian_name: string | null;
  email: string | null;
  phone: string | null;
  desired_class: string | null;
  level_quran: string | null;
  level_arabic: string | null;
  level_islam: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
};

const levelLabels: Record<string, string> = {
  nybegynner: "Nybegynner",
  litt: "Litt erfaring",
  middels: "Middels",
  god: "God",
};

function levelLabel(value: string | null) {
  if (!value) return "-";
  return levelLabels[value] ?? value;
}

async function getApplications(
  q: string,
  status: string,
): Promise<StudentApplicationRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("student_applications")
      .select(
        "id, child_name, child_age, guardian_name, email, phone, desired_class, level_quran, level_arabic, level_islam, message, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `child_name.ilike.%${term}%,guardian_name.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }

    const { data } = await query;
    return (data as StudentApplicationRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function EleverPage({
  searchParams,
}: PageProps<"/[locale]/admin/elever">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const applications = await getApplications(q, status);
  const filtered = Boolean(q || status);

  return (
    <div>
      <PageHeader
        title="Påmeldinger"
        description="Påmeldinger av elever fra foresatte."
      />

      <StudentFilters />

      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {filtered
                ? "Ingen påmeldinger samsvarer med søket."
                : "Ingen påmeldinger ennå."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barn</TableHead>
                  <TableHead>Alder</TableHead>
                  <TableHead>Foresatt</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Ønsket klasse</TableHead>
                  <TableHead>Nivå (Koran / Arabisk / Islam)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">
                      {application.child_name ?? "-"}
                    </TableCell>
                    <TableCell>{application.child_age ?? "-"}</TableCell>
                    <TableCell>{application.guardian_name ?? "-"}</TableCell>
                    <TableCell>
                      {application.email ? (
                        <a
                          href={`mailto:${application.email}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {application.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{application.phone ?? "-"}</TableCell>
                    <TableCell>{application.desired_class ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {levelLabel(application.level_quran)} /{" "}
                      {levelLabel(application.level_arabic)} /{" "}
                      {levelLabel(application.level_islam)}
                    </TableCell>
                    <TableCell>
                      <StudentStatusSelect
                        id={application.id}
                        status={application.status ?? "ny"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(application.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <DeleteButton
                          id={application.id}
                          label="påmelding"
                          action={deleteStudentApplication}
                        />
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
