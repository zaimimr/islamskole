import { createClient } from "@/lib/supabase/server";
import { deleteStudentApplication } from "@/app/[locale]/admin/actions";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { StudentStatusSelect } from "@/components/admin/student-status-select";
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
  message: string | null;
  status: string | null;
  created_at: string | null;
};

async function getApplications(): Promise<StudentApplicationRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("student_applications")
      .select(
        "id, child_name, child_age, guardian_name, email, phone, desired_class, message, status, created_at",
      )
      .order("created_at", { ascending: false });
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

export default async function EleverPage() {
  const applications = await getApplications();

  return (
    <div>
      <PageHeader
        title="Påmeldinger"
        description="Påmeldinger av elever fra foresatte."
      />

      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen påmeldinger ennå.
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
