import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { BatchSendButton } from "@/components/admin/batch-send-button";
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

type YearRow = { id: string; label: string; is_active: boolean };
type EnrollmentRow = {
  student_id: string;
  school_year_id: string;
  students: { full_name: string | null; guardian_name: string | null } | null;
  classes: { name_no: string | null } | null;
};
type PaymentRow = {
  student_id: string;
  school_year_id: string;
  status: string;
  amount: number;
};

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

async function getData() {
  const supabase = await createClient();
  const [{ data: years }, { data: enrollments }, { data: payments }] =
    await Promise.all([
      supabase
        .from("school_years")
        .select("id, label, is_active")
        .order("label", { ascending: false }),
      supabase
        .from("enrollments")
        .select(
          "student_id, school_year_id, students(full_name, guardian_name), classes(name_no)",
        )
        .eq("status", "aktiv"),
      supabase.from("payments").select("student_id, school_year_id, status, amount"),
    ]);
  return {
    years: (years as YearRow[] | null) ?? [],
    enrollments: (enrollments as EnrollmentRow[] | null) ?? [],
    payments: (payments as PaymentRow[] | null) ?? [],
  };
}

export default async function BetalingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const { years, enrollments, payments } = await getData();

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Betaling"
        description="Oversikt over betaling per skoleår."
      />

      {years.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ingen skoleår ennå.
          </CardContent>
        </Card>
      ) : (
        years.map((year) => {
          const yearEnrollments = enrollments.filter(
            (e) => e.school_year_id === year.id,
          );
          const yearPayments = payments.filter(
            (p) => p.school_year_id === year.id,
          );

          const paidByStudent = new Map<string, number>();
          const stateByStudent = new Map<
            string,
            "betalt" | "venter" | "ubetalt"
          >();
          for (const p of yearPayments) {
            if (p.status === "fanget") {
              paidByStudent.set(
                p.student_id,
                (paidByStudent.get(p.student_id) ?? 0) + p.amount,
              );
              stateByStudent.set(p.student_id, "betalt");
            } else if (
              (p.status === "opprettet" || p.status === "autorisert") &&
              stateByStudent.get(p.student_id) !== "betalt"
            ) {
              stateByStudent.set(p.student_id, "venter");
            }
          }

          const studentIds = [
            ...new Set(yearEnrollments.map((e) => e.student_id)),
          ];
          const paidCount = studentIds.filter(
            (id) => stateByStudent.get(id) === "betalt",
          ).length;
          const missingCount = studentIds.length - paidCount;
          const collected = yearPayments
            .filter((p) => p.status === "fanget")
            .reduce((s, p) => s + p.amount, 0);

          const seen = new Set<string>();
          const rows = yearEnrollments.filter((e) => {
            if (seen.has(e.student_id)) return false;
            seen.add(e.student_id);
            return true;
          });

          return (
            <Card key={year.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  {year.label}
                  {year.is_active ? <Badge>Aktivt</Badge> : null}
                </CardTitle>
                <BatchSendButton schoolYearId={year.id} yearLabel={year.label} />
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Elever" value={String(studentIds.length)} />
                  <Stat label="Betalt" value={String(paidCount)} />
                  <Stat label="Mangler" value={String(missingCount)} />
                  <Stat label="Samlet" value={formatNok(collected)} />
                </div>

                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ingen elever plassert dette skoleåret.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead>Klasse</TableHead>
                        <TableHead>Betalt</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((e) => {
                        const state =
                          stateByStudent.get(e.student_id) ?? "ubetalt";
                        return (
                          <TableRow key={e.student_id}>
                            <TableCell className="font-medium">
                              <Link
                                href={`${basePath}/elever/${e.student_id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {e.students?.full_name ?? "-"}
                              </Link>
                            </TableCell>
                            <TableCell>{e.classes?.name_no ?? "-"}</TableCell>
                            <TableCell>
                              {formatNok(paidByStudent.get(e.student_id) ?? 0)}
                            </TableCell>
                            <TableCell>
                              {state === "betalt" ? (
                                <Badge>Betalt</Badge>
                              ) : state === "venter" ? (
                                <Badge variant="secondary">Lenke sendt</Badge>
                              ) : (
                                <Badge variant="outline">Ikke betalt</Badge>
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
          );
        })
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
