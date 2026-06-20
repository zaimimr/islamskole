import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { BatchSendButton } from "@/components/admin/batch-send-button";
import { YearActions } from "@/components/admin/year-actions";
import {
  SchoolYearForm,
  type SchoolYearRecord,
} from "@/components/admin/school-year-form";
import { deleteSchoolYear } from "@/app/[locale]/admin/school-years-actions";
import {
  guardianName,
  studentDisplayName,
  type NamedRecord,
} from "@/lib/student-name";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EnrollmentRow = {
  student_id: string;
  students:
    | (NamedRecord & {
        child_first_name: string | null;
        child_last_name: string | null;
        mother_first_name: string | null;
        mother_last_name: string | null;
        father_first_name: string | null;
        father_last_name: string | null;
      })
    | null;
  classes: { name_no: string | null } | null;
};

type PaymentRow = { student_id: string; amount: number; status: string };

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

export default async function SkolearDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const basePath = adminBasePath(locale);
  const listHref = `${basePath}/skolear`;
  const supabase = await createClient();

  const [
    { data: yearData },
    { data: enrollmentData },
    { data: paymentData },
    { data: activeData },
  ] = await Promise.all([
    supabase
      .from("school_years")
      .select("id, label, starts_on, ends_on, is_active, fee")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        "student_id, students(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name), classes(name_no)",
      )
      .eq("school_year_id", id),
    supabase
      .from("payments")
      .select("student_id, amount, status")
      .eq("school_year_id", id),
    supabase
      .from("school_years")
      .select("label")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const year = yearData as SchoolYearRecord | null;
  if (!year) notFound();

  const enrollments = (enrollmentData as EnrollmentRow[] | null) ?? [];
  const payments = (paymentData as PaymentRow[] | null) ?? [];
  const activeYearLabel =
    (activeData as { label: string } | null)?.label ?? null;

  const paidByStudent = new Map<string, number>();
  const stateByStudent = new Map<string, "betalt" | "venter" | "ubetalt">();
  for (const p of payments) {
    if (p.status === "fanget") {
      paidByStudent.set(
        p.student_id,
        (paidByStudent.get(p.student_id) ?? 0) + p.amount,
      );
    }
    const current = stateByStudent.get(p.student_id);
    if (p.status === "fanget") stateByStudent.set(p.student_id, "betalt");
    else if (
      (p.status === "opprettet" || p.status === "autorisert") &&
      current !== "betalt"
    )
      stateByStudent.set(p.student_id, "venter");
  }

  const totalPaid = payments
    .filter((p) => p.status === "fanget")
    .reduce((s, p) => s + p.amount, 0);
  const totalPending = payments
    .filter((p) => p.status === "opprettet" || p.status === "autorisert")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={year.label ?? "Skoleår"}
        description="Elever og betaling for skoleåret."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BatchSendButton
              schoolYearId={year.id}
              yearLabel={year.label ?? "skoleåret"}
            />
            <YearActions
              schoolYearId={year.id}
              isActiveYear={Boolean(year.is_active)}
              activeYearLabel={activeYearLabel}
            />
            <DeleteButton id={year.id} label="skoleår" action={deleteSchoolYear} />
          </div>
        }
      />

      <SchoolYearForm schoolYear={year} listHref={listHref} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Elever</p>
            <p className="text-2xl font-bold">{enrollments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Betalt</p>
            <p className="text-2xl font-bold">{formatNok(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Utestående</p>
            <p className="text-2xl font-bold">{formatNok(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elever dette skoleåret</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enrollments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Ingen elever plassert dette skoleåret.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Foresatt</TableHead>
                  <TableHead>Klasse</TableHead>
                  <TableHead>Betalt</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => {
                  const state = stateByStudent.get(e.student_id) ?? "ubetalt";
                  return (
                    <TableRow key={`${e.student_id}-${e.classes?.name_no}`}>
                      <TableCell className="font-medium">
                        <Link
                          href={`${basePath}/elever/${e.student_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {e.students
                            ? studentDisplayName(e.students) || "-"
                            : "-"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {e.students ? guardianName(e.students) ?? "-" : "-"}
                      </TableCell>
                      <TableCell>{e.classes?.name_no ?? "-"}</TableCell>
                      <TableCell>
                        {formatNok(paidByStudent.get(e.student_id) ?? 0)}
                      </TableCell>
                      <TableCell>
                        {state === "betalt" ? (
                          <Badge>Betalt</Badge>
                        ) : state === "venter" ? (
                          <Badge variant="secondary">Venter</Badge>
                        ) : (
                          <Badge variant="outline">Ingen</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
