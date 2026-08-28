import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  CircleDollarSign,
  CircleUserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { guardianName, studentDisplayName } from "@/lib/student-name";
import { formatAge, schoolYearStart } from "@/lib/age";
import { adminBasePath } from "@/components/admin/paths";
import { EleverFilters } from "@/components/admin/elever-filters";
import { ClickableRow } from "@/components/admin/clickable-row";
import { Pagination } from "@/components/admin/pagination";
import { ExportButton } from "@/components/admin/export-button";
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
  child_first_name: string | null;
  child_last_name: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
  child_birth_date: string | null;
  enrollments: {
    school_year_id: string;
    school_years: { label: string } | null;
    classes: { id: string; name_no: string | null } | null;
  }[];
  payments: { status: string; amount: number; school_year_id: string | null }[];
};

async function getStudents(q: string): Promise<StudentRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("students")
      .select(
        "id, child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_birth_date, enrollments(school_year_id, school_years(label), classes(id, name_no)), payments(status, amount, school_year_id)",
      )
      .order("created_at", { ascending: false });

    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `child_first_name.ilike.%${term}%,child_last_name.ilike.%${term}%,mother_first_name.ilike.%${term}%,mother_last_name.ilike.%${term}%,father_first_name.ilike.%${term}%,father_last_name.ilike.%${term}%,child_email.ilike.%${term}%`,
      );
    }

    const { data } = await query;
    return (data as StudentRow[] | null) ?? [];
  } catch {
    return [];
  }
}

type BalanceRow = {
  student_id: string | null;
  school_year_id: string | null;
  owed: number | null;
  paid: number | null;
  remaining: number | null;
};

async function getBalances(): Promise<BalanceRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("student_balances")
      .select("student_id, school_year_id, owed, paid, remaining");
    return (data as BalanceRow[] | null) ?? [];
  } catch {
    return [];
  }
}

async function getClasses() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("id, name_no")
      .order("sort_order", { ascending: true });
    return (
      (data as { id: string; name_no: string | null }[] | null) ?? []
    ).map((c) => ({ id: c.id, name: c.name_no ?? "(uten navn)" }));
  } catch {
    return [];
  }
}

async function getSchoolYears() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("school_years")
      .select("id, label, is_active")
      .order("label", { ascending: false });
    return (
      (data as { id: string; label: string; is_active: boolean }[] | null) ?? []
    ).map((y) => ({ id: y.id, label: y.label, is_active: y.is_active }));
  } catch {
    return [];
  }
}

function classLabel(enrollments: StudentRow["enrollments"]) {
  if (!enrollments || enrollments.length === 0) return "-";
  return (
    enrollments
      .map((e) => e.classes?.name_no)
      .filter(Boolean)
      .join(", ") || "-"
  );
}

function yearLabels(enrollments: StudentRow["enrollments"]) {
  if (!enrollments || enrollments.length === 0) return [];
  return [
    ...new Set(
      enrollments
        .map((e) => e.school_years?.label)
        .filter((l): l is string => Boolean(l)),
    ),
  ]
    .sort()
    .reverse();
}

type Ledger = { owed: number; paid: number; remaining: number };

function emptyLedger(): Ledger {
  return { owed: 0, paid: 0, remaining: 0 };
}

function sumLedger(rows: Ledger[]): Ledger {
  return rows.reduce(
    (acc, row) => ({
      owed: acc.owed + row.owed,
      paid: acc.paid + row.paid,
      remaining: acc.remaining + row.remaining,
    }),
    emptyLedger(),
  );
}

function hasPendingLink(payments: StudentRow["payments"]) {
  return (payments ?? []).some(
    (p) => p.status === "opprettet" || p.status === "autorisert",
  );
}

type PayState = "betalt" | "delvis" | "venter" | "ubetalt";

function payState(ledger: Ledger, payments: StudentRow["payments"]): PayState {
  if (ledger.owed > 0 && ledger.remaining <= 0) return "betalt";
  if (ledger.paid > 0) return "delvis";
  if (
    ledger.owed === 0 &&
    (payments ?? []).some((p) => p.status === "fanget")
  ) {
    return "betalt";
  }
  if (hasPendingLink(payments)) return "venter";
  return "ubetalt";
}

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

const PAGE_SIZE = 25;

export default async function RegistrertePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const classFilter = typeof sp.class === "string" ? sp.class : "";
  const payFilter = typeof sp.pay === "string" ? sp.pay : "";
  const yearFilter = typeof sp.year === "string" ? sp.year : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const basePath = adminBasePath(locale);

  const [allStudents, classes, schoolYears, balanceRows] = await Promise.all([
    getStudents(q),
    getClasses(),
    getSchoolYears(),
    getBalances(),
  ]);

  const balancesByStudent = new Map<string, Map<string, Ledger>>();
  for (const row of balanceRows) {
    if (!row.student_id || !row.school_year_id) continue;
    const byYear = balancesByStudent.get(row.student_id) ?? new Map();
    byYear.set(row.school_year_id, {
      owed: row.owed ?? 0,
      paid: row.paid ?? 0,
      remaining: row.remaining ?? 0,
    });
    balancesByStudent.set(row.student_id, byYear);
  }

  const activeYear = schoolYears.find((y) => y.is_active);
  const activeYearId = activeYear?.id ?? null;
  const activeYearLabel = activeYear?.label ?? null;

  const filterYearLabel =
    schoolYears.find((y) => y.id === yearFilter)?.label ?? activeYearLabel;
  const ageYear = schoolYearStart(filterYearLabel) ?? new Date().getFullYear();

  const realYear =
    yearFilter && yearFilter !== "needs_rollover" ? yearFilter : null;
  const scoped = (payments: StudentRow["payments"]) =>
    realYear ? payments.filter((p) => p.school_year_id === realYear) : payments;

  const ledgerFor = (studentId: string): Ledger => {
    const byYear = balancesByStudent.get(studentId);
    if (!byYear) return emptyLedger();
    if (realYear) return byYear.get(realYear) ?? emptyLedger();
    return sumLedger([...byYear.values()]);
  };

  const students = allStudents.filter((student) => {
    if (yearFilter === "needs_rollover") {
      const hasEnrollments = (student.enrollments ?? []).length > 0;
      const inActive =
        activeYearId != null &&
        (student.enrollments ?? []).some(
          (e) => e.school_year_id === activeYearId,
        );
      if (!hasEnrollments || inActive) return false;
    } else if (realYear) {
      const inYear = (student.enrollments ?? []).some(
        (e) => e.school_year_id === realYear,
      );
      if (!inYear) return false;
    }
    if (classFilter) {
      const inClass = (student.enrollments ?? []).some(
        (e) => e.classes?.id === classFilter,
      );
      if (!inClass) return false;
    }
    if (payFilter && payFilter !== "alle") {
      const state = payState(ledgerFor(student.id), scoped(student.payments));
      if (payFilter === "ikke_betalt") {
        if (state === "betalt") return false;
      } else if (state !== payFilter) {
        return false;
      }
    }
    return true;
  });

  const ledgerTotals = sumLedger(students.map((st) => ledgerFor(st.id)));
  const totalPaid = ledgerTotals.paid;
  const totalRemaining = ledgerTotals.remaining;

  const total = students.length;
  const from = (page - 1) * PAGE_SIZE;
  const pageStudents = students.slice(from, from + PAGE_SIZE);

  const filtered = Boolean(q || classFilter || payFilter || yearFilter);

  return (
    <div className="grid gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Elever
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
            Finn elevens familie, klasseplassering og betalingsstatus i ett
            samlet register.
          </p>
        </div>
        <Link
          href={`${basePath}/elever/ny`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <UserRoundPlus aria-hidden="true" className="size-4" />
          Ny elev
        </Link>
      </header>

      <section
        aria-label="Status for elevregisteret"
        className="grid overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] sm:grid-cols-3"
      >
        <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF8FD] text-[#245D7C]">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {students.length}
            </p>
            <p className="text-sm text-admin-muted">Elever i utvalget</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <CircleCheck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {formatNok(totalPaid)}
            </p>
            <p className="text-sm text-admin-muted">Registrert betalt</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
            <CircleDollarSign aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {formatNok(totalRemaining)}
            </p>
            <p className="text-sm text-admin-muted">Gjenstår å betale</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <EleverFilters classes={classes} schoolYears={schoolYears} />
          </div>
          <ExportButton entity="students" />
        </div>
      </section>

      <section
        aria-labelledby="student-register-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <div>
            <h2
              id="student-register-title"
              className="font-heading text-xl font-bold"
            >
              Elevregister
            </h2>
            <p className="mt-0.5 text-sm text-admin-muted" aria-live="polite">
              {total} {total === 1 ? "elev" : "elever"}
              {filterYearLabel ? `, skoleår ${filterYearLabel}` : ""}
            </p>
          </div>
          <CircleUserRound
            aria-hidden="true"
            className="size-5 text-admin-muted"
          />
        </div>
        {pageStudents.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <Users aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 font-heading text-xl font-bold">
              {filtered ? "Ingen elever passer filtrene" : "Ingen elever ennå"}
            </p>
            <p className="mt-1 max-w-md text-sm text-admin-muted">
              {filtered
                ? "Juster søket, skoleåret, klassen eller betalingsstatusen."
                : "Registrerte elever vises her med plassering og betaling."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Alder</TableHead>
                    <TableHead>Foresatt</TableHead>
                    <TableHead>Klasse</TableHead>
                    <TableHead>Skoleår</TableHead>
                    <TableHead>Betalt</TableHead>
                    <TableHead>Betaling</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageStudents.map((student) => {
                    const studentPayments = scoped(student.payments);
                    const ledger = ledgerFor(student.id);
                    const state = payState(ledger, studentPayments);
                    return (
                      <ClickableRow
                        key={student.id}
                        href={`${basePath}/elever/${student.id}`}
                      >
                        <TableCell className="font-medium">
                          {studentDisplayName(student) || "-"}
                        </TableCell>
                        <TableCell>
                          {formatAge(student.child_birth_date, ageYear)}
                        </TableCell>
                        <TableCell>{guardianName(student) ?? "-"}</TableCell>
                        <TableCell>{classLabel(student.enrollments)}</TableCell>
                        <TableCell>
                          {(() => {
                            const years = yearLabels(student.enrollments);
                            if (years.length === 0)
                              return (
                                <span className="text-muted-foreground">-</span>
                              );
                            const missingActive =
                              activeYearLabel != null &&
                              !years.includes(activeYearLabel);
                            return (
                              <div className="flex flex-wrap items-center gap-1">
                                {years.map((y) => (
                                  <Badge key={y} variant="outline">
                                    {y}
                                  </Badge>
                                ))}
                                {missingActive ? (
                                  <Badge
                                    variant="secondary"
                                    title={`Ikke i ${activeYearLabel}`}
                                  >
                                    Ny termin?
                                  </Badge>
                                ) : null}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatNok(ledger.paid)}
                          {ledger.owed > 0 ? (
                            <span className="text-muted-foreground">
                              {" "}
                              av {formatNok(ledger.owed)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {state === "betalt" ? (
                              <Badge>Betalt</Badge>
                            ) : state === "delvis" ? (
                              <Badge
                                variant="secondary"
                                title={`Gjenstår ${formatNok(ledger.remaining)}`}
                              >
                                Delvis · {formatNok(ledger.remaining)} igjen
                              </Badge>
                            ) : state === "venter" ? (
                              <Badge variant="secondary">Lenke sendt</Badge>
                            ) : (
                              <Badge variant="outline">Ikke sendt</Badge>
                            )}
                            {state === "delvis" &&
                            hasPendingLink(studentPayments) ? (
                              <Badge variant="outline">Lenke ute</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-admin-muted">
                          <ArrowRight className="size-4" />
                        </TableCell>
                      </ClickableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-[#ECE8DF] lg:hidden">
              {pageStudents.map((student) => {
                const studentPayments = scoped(student.payments);
                const ledger = ledgerFor(student.id);
                const state = payState(ledger, studentPayments);
                const years = yearLabels(student.enrollments);
                return (
                  <li key={student.id}>
                    <Link
                      href={`${basePath}/elever/${student.id}`}
                      className="group block px-4 py-4 outline-none transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span className="min-w-0">
                          <span className="block font-heading text-lg font-bold">
                            {studentDisplayName(student) || "-"}
                          </span>
                          <span className="mt-0.5 block text-sm text-admin-muted">
                            {formatAge(student.child_birth_date, ageYear)} år,{" "}
                            {guardianName(student) ?? "foresatt mangler"}
                          </span>
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="mt-1 size-5 shrink-0 text-admin-muted transition-transform group-hover:translate-x-0.5"
                        />
                      </span>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-[#F8F6F0] p-3 text-sm">
                        <div>
                          <dt className="text-xs font-bold text-admin-muted">
                            Klasse
                          </dt>
                          <dd className="mt-1 font-bold">
                            {classLabel(student.enrollments)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold text-admin-muted">
                            Skoleår
                          </dt>
                          <dd className="mt-1 font-bold">
                            {years.join(", ") || "Ikke plassert"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold text-admin-muted">
                            Betalt
                          </dt>
                          <dd className="mt-1 font-bold tabular-nums">
                            {formatNok(ledger.paid)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold text-admin-muted">
                            Status
                          </dt>
                          <dd className="mt-1 font-bold">
                            {state === "betalt"
                              ? "Betalt"
                              : state === "delvis"
                                ? `${formatNok(ledger.remaining)} igjen`
                                : state === "venter"
                                  ? "Lenke sendt"
                                  : "Ikke sendt"}
                          </dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {total > PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath={`${basePath}/elever`}
            searchParams={sp}
          />
        ) : null}
      </section>
    </div>
  );
}
