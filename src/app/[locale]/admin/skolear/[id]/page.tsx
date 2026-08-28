import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  CircleAlert,
  Settings2,
  UsersRound,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
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
type PaymentState = "betalt" | "delvis" | "venter" | "ubetalt";

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

function paymentStateLabel(state: PaymentState) {
  const labels: Record<PaymentState, string> = {
    betalt: "Betalt",
    delvis: "Delvis betalt",
    venter: "Venter på betaling",
    ubetalt: "Ikke betalt",
  };
  return labels[state];
}

function paymentStateClasses(state: PaymentState) {
  const classes: Record<PaymentState, string> = {
    betalt: "bg-[#DCEDDD] text-[#216A2B] hover:bg-[#DCEDDD]",
    delvis: "bg-[#FEEDCA] text-[#775108] hover:bg-[#FEEDCA]",
    venter: "bg-[#DDEEF9] text-[#245D84] hover:bg-[#DDEEF9]",
    ubetalt: "bg-[#F0F0ED] text-[#4D554F] hover:bg-[#F0F0ED]",
  };
  return classes[state];
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
  for (const balance of balances) {
    if (!balance.student_id) continue;
    balanceByStudent.set(balance.student_id, {
      owed: balance.owed ?? 0,
      paid: balance.paid ?? 0,
      remaining: balance.remaining ?? 0,
    });
  }

  const hasPending = new Set(
    payments
      .filter(
        (payment) =>
          payment.status === "opprettet" || payment.status === "autorisert",
      )
      .map((payment) => payment.student_id),
  );

  const stateByStudent = new Map<string, PaymentState>();
  for (const enrollment of enrollments) {
    const balance = balanceByStudent.get(enrollment.student_id);
    const owed = balance?.owed ?? 0;
    const paid = balance?.paid ?? 0;
    const remaining = balance?.remaining ?? 0;
    if (owed > 0 && remaining <= 0) {
      stateByStudent.set(enrollment.student_id, "betalt");
    } else if (paid > 0) {
      stateByStudent.set(enrollment.student_id, "delvis");
    } else if (hasPending.has(enrollment.student_id)) {
      stateByStudent.set(enrollment.student_id, "venter");
    } else {
      stateByStudent.set(enrollment.student_id, "ubetalt");
    }
  }

  const enrolledIds = [
    ...new Set(enrollments.map((enrollment) => enrollment.student_id)),
  ];
  const totalPaid = enrolledIds.reduce(
    (sum, studentId) => sum + (balanceByStudent.get(studentId)?.paid ?? 0),
    0,
  );
  const totalRemaining = enrolledIds.reduce(
    (sum, studentId) => sum + (balanceByStudent.get(studentId)?.remaining ?? 0),
    0,
  );
  const unsettledCount = enrolledIds.filter(
    (studentId) => (balanceByStudent.get(studentId)?.remaining ?? 0) > 0,
  ).length;

  return (
    <div className="grid gap-6 lg:gap-7">
      <header>
        <Link
          href={listHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#277A31] outline-none transition-colors hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tilbake til skoleår
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            {year.label ?? "Skoleår"}
          </h1>
          {year.is_active ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCEDDD] px-2.5 py-1 text-xs font-bold text-[#216A2B]">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[#3C8F44]"
              />
              Aktivt
            </span>
          ) : null}
        </div>
        <p className="mt-1 max-w-2xl text-admin-muted">
          Elever, betalinger og videreføring for dette skoleåret.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
        <dl className="grid divide-y divide-[#ECE8DF] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#DDEEF9] text-[#245D84]">
              <UsersRound aria-hidden="true" className="size-5" />
            </span>
            <div>
              <dt className="text-sm text-admin-muted">Elever med plass</dt>
              <dd className="font-heading text-2xl font-bold tabular-nums">
                {enrollments.length}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <Wallet aria-hidden="true" className="size-5" />
            </span>
            <div>
              <dt className="text-sm text-admin-muted">Registrert betalt</dt>
              <dd className="font-heading text-2xl font-bold tabular-nums">
                {formatNok(totalPaid)}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
              <CircleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
              <dt className="text-sm text-admin-muted">
                Gjenstår fra {unsettledCount} elever
              </dt>
              <dd className="font-heading text-2xl font-bold tabular-nums">
                {formatNok(totalRemaining)}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl bg-[#FFF8E9] p-5 ring-1 ring-[#ECDCB9] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
            <Settings2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold">
              Felles handlinger
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-[#6D5A2D]">
              Bruk disse når en hel elevgruppe skal følges opp. Hver handling
              bekreftes før den gjennomføres.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <BatchSendButton
            schoolYearId={year.id}
            yearLabel={year.label ?? "skoleåret"}
          />
          <YearActions
            schoolYearId={year.id}
            isActiveYear={Boolean(year.is_active)}
            activeYearLabel={activeYearLabel}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
        <div className="border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <h2 className="font-heading text-xl font-bold">
            Elever dette skoleåret
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted">
            Klasse og betalingsstatus holdes adskilt for hver elev.
          </p>
        </div>

        {enrollments.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
            <CalendarRange
              aria-hidden="true"
              className="size-7 text-admin-muted"
            />
            <p className="mt-3 font-bold">Ingen elever plassert</p>
            <p className="mt-1 max-w-sm text-sm text-admin-muted">
              Elever vil vises her når de får en klasse i dette skoleåret.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
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
                  {enrollments.map((enrollment) => {
                    const state =
                      stateByStudent.get(enrollment.student_id) ?? "ubetalt";
                    const balance = balanceByStudent.get(enrollment.student_id);
                    return (
                      <TableRow
                        key={`${enrollment.student_id}-${enrollment.classes?.name_no}`}
                      >
                        <TableCell className="font-bold">
                          <Link
                            href={`${basePath}/elever/${enrollment.student_id}`}
                            className="rounded underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {enrollment.students
                              ? studentDisplayName(enrollment.students) || "-"
                              : "-"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-admin-muted">
                          {enrollment.students
                            ? (guardianName(enrollment.students) ?? "-")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {enrollment.classes?.name_no ?? "Ikke plassert"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatNok(balance?.paid ?? 0)}
                          <span className="text-admin-muted">
                            {` av ${formatNok(balance?.owed ?? 0)}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={paymentStateClasses(state)}>
                            {paymentStateLabel(state)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-[#ECE8DF] md:hidden">
              {enrollments.map((enrollment) => {
                const state =
                  stateByStudent.get(enrollment.student_id) ?? "ubetalt";
                const balance = balanceByStudent.get(enrollment.student_id);
                return (
                  <li
                    key={`${enrollment.student_id}-${enrollment.classes?.name_no}`}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`${basePath}/elever/${enrollment.student_id}`}
                          className="rounded font-bold underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {enrollment.students
                            ? studentDisplayName(enrollment.students) || "-"
                            : "-"}
                        </Link>
                        <p className="mt-0.5 truncate text-sm text-admin-muted">
                          {enrollment.students
                            ? (guardianName(enrollment.students) ??
                              "Foresatt mangler")
                            : "Foresatt mangler"}
                        </p>
                      </div>
                      <Badge className={paymentStateClasses(state)}>
                        {paymentStateLabel(state)}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-[#F7F6F1] p-3 text-sm">
                      <div>
                        <dt className="text-xs text-admin-muted">Klasse</dt>
                        <dd className="mt-0.5 font-bold">
                          {enrollment.classes?.name_no ?? "Ikke plassert"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-admin-muted">Betalt</dt>
                        <dd className="mt-0.5 font-bold tabular-nums">
                          {formatNok(balance?.paid ?? 0)}
                          <span className="block text-xs font-normal text-admin-muted">
                            av {formatNok(balance?.owed ?? 0)}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <SchoolYearForm schoolYear={year} listHref={listHref} />

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold">Slett skoleåret</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-admin-muted">
            Sletting følger eksisterende kontroll av tilknyttede data og kan
            ikke omgås her.
          </p>
        </div>
        <DeleteButton
          id={year.id}
          label="skoleår"
          action={deleteSchoolYear}
          redirectTo={listHref}
        />
      </section>
    </div>
  );
}
