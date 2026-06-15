import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StudentRow = {
  id: string;
  full_name: string | null;
  guardian_name: string | null;
  child_age: number | null;
  enrollments: { term: string; classes: { name_no: string | null } | null }[];
  payments: { status: string; amount: number }[];
};

async function getStudents(): Promise<StudentRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("students")
      .select(
        "id, full_name, guardian_name, child_age, enrollments(term, classes(name_no)), payments(status, amount)",
      )
      .order("created_at", { ascending: false });
    return (data as StudentRow[] | null) ?? [];
  } catch {
    return [];
  }
}

function classLabel(enrollments: StudentRow["enrollments"]) {
  if (!enrollments || enrollments.length === 0) return "-";
  return enrollments
    .map((e) => e.classes?.name_no)
    .filter(Boolean)
    .join(", ") || "-";
}

function paidTotal(payments: StudentRow["payments"]) {
  const total = (payments ?? [])
    .filter((p) => p.status === "fanget")
    .reduce((sum, p) => sum + p.amount, 0);
  return `${(total / 100).toLocaleString("nb-NO")} NOK`;
}

function hasPending(payments: StudentRow["payments"]) {
  return (payments ?? []).some(
    (p) => p.status === "opprettet" || p.status === "autorisert",
  );
}

export default async function RegistrertePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const students = await getStudents();

  return (
    <div>
      <PageHeader
        title="Elever"
        description="Registrerte elever, klasseplassering og betaling."
        newHref={`${basePath}/registrerte/ny`}
        newLabel="Ny elev"
      />

      <Card>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen registrerte elever ennå.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Alder</TableHead>
                  <TableHead>Foresatt</TableHead>
                  <TableHead>Klasse</TableHead>
                  <TableHead>Betalt</TableHead>
                  <TableHead>Betaling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`${basePath}/registrerte/${student.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {student.full_name ?? "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{student.child_age ?? "-"}</TableCell>
                    <TableCell>{student.guardian_name ?? "-"}</TableCell>
                    <TableCell>{classLabel(student.enrollments)}</TableCell>
                    <TableCell>{paidTotal(student.payments)}</TableCell>
                    <TableCell>
                      {hasPending(student.payments) ? (
                        <Badge variant="secondary">Venter</Badge>
                      ) : null}
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
