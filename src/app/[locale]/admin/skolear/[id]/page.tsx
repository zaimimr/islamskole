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
    { data: balanceData },
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
    supabase
      .from("student_balances")
      .select("student_id, owed, paid, remaining")
      .eq("school_year_id", id),
  ]);
  const year = yearData as SchoolYearRecord | null;
  if (!year) notFound();

  const enrollments = (enrollmentData as EnrollmentRow[] | null) ?? [];
  const payments = (paymentData as PaymentRow[] | null) ?? [];
  const activeYearLabel =
    (activeData as { label: string } | null)?.label ?? null;
  const balances =
    (balanceData as
      | {
          student_id: string | null;
          owed: number | null;
          paid: number | null;
          remaining: number | null;
        }[]
      | null) ?? [];

  const balanceByStudent = new Map<
    string,
    { owed: number; paid: number; remaining: number }
  >();
  for (const b of balances) {
    if (!b.student_id) continue;
    balanceByStudent.set(b.student_id, {
      owed: b.owed ?? 0,
      paid: b.paid ?? 0,
      remaining: b.remaining ?? 0,
    });
  }

  const hasPending = new Set(
    payments
      .filter((p) => p.status === "opprettet" || p.status === "autorisert")
      .map((p) => p.student_id),
  );

  const stateByStudent = new Map<
    string,
    "betalt" | "delvis" | "venter" | "ubetalt"
  >();
  for (const e of enrollments) {
    const balance = balanceByStudent.get(e.student_id);
    const owed = balance?.owed ?? 0;
    const paid = balance?.paid ?? 0;
    const remaining = balance?.remaining ?? 0;
    if (owed > 0 && remaining <= 0) stateByStudent.set(e.student_id, "betalt");
    else if (paid > 0) stateByStudent.set(e.student_id, "delvis");
    else if (hasPending.has(e.student_id))
      stateByStudent.set(e.student_id, "venter");
    else stateByStudent.set(e.student_id, "ubetalt");
  }

  const enrolledIds = [...new Set(enrollments.map((e) => e.student_id))];
  const totalPaid = enrolledIds.reduce(
    (s, id) => s + (balanceByStudent.get(id)?.paid ?? 0),
    0,
  );
  const totalRemaining = enrolledIds.reduce(
    (s, id) => s + (balanceByStudent.get(id)?.remaining ?? 0),
    0,
  );

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
            <p className="text-sm text-muted-foreground">Gjenstår</p>
            <p className="text-2xl font-bold">{formatNok(totalRemaining)}</p>
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
                        {formatNok(balanceByStudent.get(e.student_id)?.paid ?? 0)}
                        <span className="text-muted-foreground">
                          {" "}
                          av{" "}
                          {formatNok(
                            balanceByStudent.get(e.student_id)?.owed ?? 0,
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {state === "betalt" ? (
                          <Badge>Betalt</Badge>
                        ) : state === "delvis" ? (
                          <Badge variant="secondary">
                            Delvis ·{" "}
                            {formatNok(
                              balanceByStudent.get(e.student_id)?.remaining ?? 0,
                            )}{" "}
                            igjen
                          </Badge>
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
