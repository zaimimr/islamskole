import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { studentDisplayName, type NamedRecord } from "@/lib/student-name";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { BatchSendButton } from "@/components/admin/batch-send-button";
import { ExportButton } from "@/components/admin/export-button";
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

type YearRow = { id: string; label: string; is_active: boolean };
type EnrollmentRow = {
  student_id: string;
  school_year_id: string;
  students:
    | (NamedRecord & {
        child_first_name: string | null;
        child_last_name: string | null;
      })
    | null;
  classes: { name_no: string | null } | null;
};
type PaymentRow = {
  student_id: string;
  school_year_id: string;
  status: string;
  amount: number;
};

type BalanceRow = {
  student_id: string | null;
  school_year_id: string | null;
  owed: number | null;
  paid: number | null;
  remaining: number | null;
  state: string | null;
};

type LedgerState = "betalt" | "delvis" | "venter" | "ubetalt";

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
          "student_id, school_year_id, students(child_first_name, child_last_name), classes(name_no)",
        )
        .eq("status", "aktiv"),
      supabase.from("payments").select("student_id, school_year_id, status, amount"),
    ]);

  const [{ data: balances }, { count: duplicateCount }] = await Promise.all([
    supabase
      .from("student_balances")
      .select("student_id, school_year_id, owed, paid, remaining, state"),
    supabase
      .from("duplicate_payment_candidates")
      .select("payment_id", { count: "exact", head: true }),
  ]);

  return {
    years: (years as YearRow[] | null) ?? [],
    enrollments: (enrollments as EnrollmentRow[] | null) ?? [],
    payments: (payments as PaymentRow[] | null) ?? [],
    balances: (balances as BalanceRow[] | null) ?? [],
    duplicateCount: duplicateCount ?? 0,
  };
}

export default async function BetalingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const { years, enrollments, payments, balances, duplicateCount } =
    await getData();

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Betaling"
        description="Oversikt over betaling per skoleår."
      />

      {duplicateCount > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <span className="font-medium">
                {duplicateCount} mistenkte dobbeltføringer
              </span>
              <span className="text-muted-foreground">
                {" "}
                · betalinger som ser ut til å være registrert manuelt i tillegg
                til Vipps
              </span>
            </p>
            <Link
              href={`${basePath}/betaling/dobbeltforinger`}
              className="text-sm font-medium underline underline-offset-2"
            >
              Gå gjennom
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Link
          href={`${basePath}/betaling/logg`}
          className="text-sm font-medium underline underline-offset-2"
        >
          Betalingslogg
        </Link>
        <ExportButton entity="payments" />
      </div>

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

          const studentIds = [
            ...new Set(yearEnrollments.map((e) => e.student_id)),
          ];

          const yearBalances = new Map<string, BalanceRow>();
          for (const b of balances) {
            if (b.school_year_id === year.id && b.student_id) {
              yearBalances.set(b.student_id, b);
            }
          }

          const hasPending = new Set(
            yearPayments
              .filter(
                (p) => p.status === "opprettet" || p.status === "autorisert",
              )
              .map((p) => p.student_id),
          );

          const stateByStudent = new Map<string, LedgerState>();
          for (const studentId of studentIds) {
            const balance = yearBalances.get(studentId);
            const owed = balance?.owed ?? 0;
            const paid = balance?.paid ?? 0;
            const remaining = balance?.remaining ?? 0;
            if (owed > 0 && remaining <= 0) {
              stateByStudent.set(studentId, "betalt");
            } else if (paid > 0) {
              stateByStudent.set(studentId, "delvis");
            } else if (hasPending.has(studentId)) {
              stateByStudent.set(studentId, "venter");
            } else {
              stateByStudent.set(studentId, "ubetalt");
            }
          }

          const paidCount = studentIds.filter(
            (id) => stateByStudent.get(id) === "betalt",
          ).length;
          const partialCount = studentIds.filter(
            (id) => stateByStudent.get(id) === "delvis",
          ).length;
          const missingCount = studentIds.length - paidCount;

          const enrolledBalances = studentIds.map((id) => yearBalances.get(id));
          const billed = enrolledBalances.reduce(
            (s, b) => s + (b?.owed ?? 0),
            0,
          );
          const collected = enrolledBalances.reduce(
            (s, b) => s + (b?.paid ?? 0),
            0,
          );
          const outstanding = enrolledBalances.reduce(
            (s, b) => s + (b?.remaining ?? 0),
            0,
          );

          const seen = new Set<string>();
          const rows = yearEnrollments.filter((e) => {
            if (seen.has(e.student_id)) return false;
            seen.add(e.student_id);
            return true;
          });

          return (
            <Card key={year.id} className="overflow-hidden p-0">
              <details open={year.is_active}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2 font-heading text-lg font-semibold">
                    {year.label}
                    {year.is_active ? <Badge>Aktivt</Badge> : null}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {paidCount}/{studentIds.length} betalt
                    {partialCount > 0 ? ` · ${partialCount} delvis` : ""} ·{" "}
                    {formatNok(collected)} av {formatNok(billed)} innbetalt
                  </span>
                </summary>
                <div className="grid gap-4 border-t p-4">
                  <div className="flex justify-end">
                    <BatchSendButton
                      schoolYearId={year.id}
                      yearLabel={year.label}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Elever" value={String(studentIds.length)} />
                    <Stat label="Betalt" value={String(paidCount)} />
                    <Stat label="Delvis" value={String(partialCount)} />
                    <Stat label="Mangler" value={String(missingCount)} />
                    <Stat label="Innbetalt" value={formatNok(collected)} />
                    <Stat label="Gjenstår" value={formatNok(outstanding)} />
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
                                {e.students
                                  ? studentDisplayName(e.students) || "-"
                                  : "-"}
                              </Link>
                            </TableCell>
                            <TableCell>{e.classes?.name_no ?? "-"}</TableCell>
                            <TableCell>
                              {formatNok(yearBalances.get(e.student_id)?.paid ?? 0)}
                              <span className="text-muted-foreground">
                                {" "}
                                av{" "}
                                {formatNok(
                                  yearBalances.get(e.student_id)?.owed ?? 0,
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
                                    yearBalances.get(e.student_id)?.remaining ??
                                      0,
                                  )}{" "}
                                  igjen
                                </Badge>
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
                </div>
              </details>
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
