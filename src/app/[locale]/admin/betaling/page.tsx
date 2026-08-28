import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  History,
  ReceiptText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { studentDisplayName, type NamedRecord } from "@/lib/student-name";
import { adminBasePath } from "@/components/admin/paths";
import { BatchSendButton } from "@/components/admin/batch-send-button";
import { ReallocateYearButton } from "@/components/admin/reallocate-year-button";
import { ExportButton } from "@/components/admin/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
type FeeRow = {
  student_id: string;
  school_year_id: string;
  amount: number | null;
  discount: number | null;
  note: string | null;
};
type BalanceRow = {
  student_id: string | null;
  school_year_id: string | null;
  owed: number | null;
  paid: number | null;
  remaining: number | null;
  state: string | null;
};
type LedgerState = "betalt" | "delvis" | "venter" | "ubetalt" | "fritatt";
type PaymentData = {
  years: YearRow[];
  enrollments: EnrollmentRow[];
  payments: PaymentRow[];
  balances: BalanceRow[];
  fees: FeeRow[];
  duplicateCount: number;
};
type YearStudent = EnrollmentRow & {
  state: LedgerState;
  paid: number;
  owed: number;
  remaining: number;
  feeNote: string | null;
};
type YearView = {
  students: YearStudent[];
  totalStudents: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  unpaidCount: number;
  exemptCount: number;
  unfinishedCount: number;
  billed: number;
  collected: number;
  outstanding: number;
  progress: number;
};

const stateOrder: Record<LedgerState, number> = {
  delvis: 0,
  venter: 1,
  ubetalt: 2,
  betalt: 3,
  fritatt: 4,
};

const stateLabels: Record<LedgerState, string> = {
  betalt: "Betalt",
  delvis: "Delvis betalt",
  venter: "Lenke sendt",
  ubetalt: "Ikke betalt",
  fritatt: "Fritatt",
};

const stateClasses: Record<LedgerState, string> = {
  betalt: "bg-[#DCEDDD] text-[#216A2B]",
  delvis: "bg-[#FEEDCA] text-[#775108]",
  venter: "bg-[#DDEEF9] text-[#245D84]",
  ubetalt: "bg-[#F9DEDB] text-[#8B2F2B]",
  fritatt: "bg-[#F0F0ED] text-[#4E5550]",
};

function formatNok(ore: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(ore / 100);
}

async function getData(): Promise<
  { ok: true; data: PaymentData } | { ok: false }
> {
  try {
    const supabase = await createClient();
    const [yearsResult, enrollmentsResult, paymentsResult] = await Promise.all([
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
      supabase
        .from("payments")
        .select("student_id, school_year_id, status, amount"),
    ]);
    const [balancesResult, feesResult, duplicateResult] = await Promise.all([
      supabase
        .from("student_balances")
        .select("student_id, school_year_id, owed, paid, remaining, state"),
      supabase
        .from("student_fees")
        .select("student_id, school_year_id, amount, discount, note"),
      supabase
        .from("duplicate_payment_candidates")
        .select("payment_id", { count: "exact", head: true }),
    ]);

    if (
      yearsResult.error ||
      enrollmentsResult.error ||
      paymentsResult.error ||
      balancesResult.error ||
      feesResult.error ||
      duplicateResult.error
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      data: {
        years: (yearsResult.data as YearRow[] | null) ?? [],
        enrollments: (enrollmentsResult.data as EnrollmentRow[] | null) ?? [],
        payments: (paymentsResult.data as PaymentRow[] | null) ?? [],
        balances: (balancesResult.data as BalanceRow[] | null) ?? [],
        fees: (feesResult.data as FeeRow[] | null) ?? [],
        duplicateCount: duplicateResult.count ?? 0,
      },
    };
  } catch {
    return { ok: false };
  }
}

function buildYearView(year: YearRow, data: PaymentData): YearView {
  const yearEnrollments = data.enrollments.filter(
    (enrollment) => enrollment.school_year_id === year.id,
  );
  const pendingStudentIds = new Set(
    data.payments
      .filter(
        (payment) =>
          payment.school_year_id === year.id &&
          (payment.status === "opprettet" || payment.status === "autorisert"),
      )
      .map((payment) => payment.student_id),
  );
  const balances = new Map<string, BalanceRow>();
  const fees = new Map<string, FeeRow>();

  for (const balance of data.balances) {
    if (balance.school_year_id === year.id && balance.student_id) {
      balances.set(balance.student_id, balance);
    }
  }
  for (const fee of data.fees) {
    if (fee.school_year_id === year.id) {
      fees.set(fee.student_id, fee);
    }
  }

  const seen = new Set<string>();
  const students = yearEnrollments
    .filter((enrollment) => {
      if (seen.has(enrollment.student_id)) return false;
      seen.add(enrollment.student_id);
      return true;
    })
    .map((enrollment): YearStudent => {
      const balance = balances.get(enrollment.student_id);
      const fee = fees.get(enrollment.student_id);
      const owed = balance?.owed ?? 0;
      const paid = balance?.paid ?? 0;
      const remaining = balance?.remaining ?? 0;
      const exempt =
        fee != null &&
        (fee.discount ?? 0) > 0 &&
        (fee.amount ?? 0) - (fee.discount ?? 0) <= 0;
      const state: LedgerState = exempt
        ? "fritatt"
        : owed > 0 && remaining <= 0
          ? "betalt"
          : paid > 0
            ? "delvis"
            : pendingStudentIds.has(enrollment.student_id)
              ? "venter"
              : "ubetalt";

      return {
        ...enrollment,
        state,
        paid,
        owed,
        remaining,
        feeNote: fee?.note ?? null,
      };
    })
    .sort((a, b) => {
      const stateDifference = stateOrder[a.state] - stateOrder[b.state];
      if (stateDifference !== 0) return stateDifference;
      const aName = a.students ? studentDisplayName(a.students) : "";
      const bName = b.students ? studentDisplayName(b.students) : "";
      return aName.localeCompare(bName, "nb");
    });

  const paidCount = students.filter(
    (student) => student.state === "betalt",
  ).length;
  const partialCount = students.filter(
    (student) => student.state === "delvis",
  ).length;
  const pendingCount = students.filter(
    (student) => student.state === "venter",
  ).length;
  const unpaidCount = students.filter(
    (student) => student.state === "ubetalt",
  ).length;
  const exemptCount = students.filter(
    (student) => student.state === "fritatt",
  ).length;
  const billed = students.reduce((sum, student) => sum + student.owed, 0);
  const collected = students.reduce((sum, student) => sum + student.paid, 0);
  const outstanding = students.reduce(
    (sum, student) => sum + student.remaining,
    0,
  );

  return {
    students,
    totalStudents: students.length,
    paidCount,
    partialCount,
    pendingCount,
    unpaidCount,
    exemptCount,
    unfinishedCount: partialCount + pendingCount + unpaidCount,
    billed,
    collected,
    outstanding,
    progress:
      billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0,
  };
}

export default async function BetalingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const result = await getData();

  if (!result.ok) {
    return (
      <section
        aria-labelledby="payment-load-error"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1
          id="payment-load-error"
          className="mt-4 font-heading text-3xl font-bold tracking-[-0.02em]"
        >
          Økonomien kunne ikke lastes
        </h1>
        <p className="mt-2 max-w-prose text-admin-muted">
          Ingen beløp er erstattet med null. Prøv å laste siden på nytt før du
          fortsetter betalingsarbeidet.
        </p>
        <Link
          href={`${basePath}/betaling`}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Prøv igjen
        </Link>
      </section>
    );
  }

  const data = result.data;
  const orderedYears = [...data.years].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active),
  );
  const hasActiveYear = orderedYears.some((year) => year.is_active);

  return (
    <div className="grid gap-7 lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            Økonomi
          </h1>
          <p className="mt-1 max-w-2xl text-admin-muted">
            Følg innkreving, finn det som gjenstår og åpne hele
            betalingshistorikken.
          </p>
        </div>
        <nav
          aria-label="Økonomiverktøy"
          className="flex w-full flex-wrap gap-2 sm:w-auto [&>a]:min-h-11"
        >
          <Link
            href={`${basePath}/betaling/logg`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <History aria-hidden="true" className="size-4" />
            Betalingslogg
          </Link>
          <ExportButton entity="payments" />
        </nav>
      </header>

      {data.duplicateCount > 0 ? (
        <Link
          href={`${basePath}/betaling/dobbeltforinger`}
          className="group grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-[#FFF8E9] px-4 py-4 outline-none ring-1 ring-[#E8D6AA] transition-colors hover:bg-[#FFF3D8] focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
            <ReceiptText aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block font-bold">
              {data.duplicateCount} betaling
              {data.duplicateCount === 1 ? "" : "er"} må kontrolleres
            </span>
            <span className="mt-0.5 block text-sm text-[#6B5524]">
              Mulige dobbeltføringer kan påvirke innbetalt beløp.
            </span>
          </span>
          <span className="hidden items-center gap-1 text-sm font-bold text-[#277A31] sm:flex">
            Kontroller
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-5 text-admin-muted sm:hidden"
          />
        </Link>
      ) : null}

      {orderedYears.length === 0 ? (
        <section className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-[#E3DED3]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F0F0ED] text-admin-muted">
            <ReceiptText aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 font-heading text-xl font-semibold">
            Ingen skoleår ennå
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-admin-muted">
            Opprett og aktiver et skoleår før betalingskrav kan følges her.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          {orderedYears.map((year, index) => {
            const primary = year.is_active || (!hasActiveYear && index === 0);
            const view = buildYearView(year, data);

            return primary ? (
              <YearWorkspace
                key={year.id}
                year={year}
                view={view}
                basePath={basePath}
                active={year.is_active}
              />
            ) : (
              <details
                key={year.id}
                className="group overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 outline-none transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-heading text-lg font-semibold">
                      {year.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-admin-muted">
                      {formatNok(view.collected)} av {formatNok(view.billed)}
                      innbetalt
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="hidden text-sm font-semibold text-admin-muted sm:block">
                      {view.unfinishedCount} ikke ferdig
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="size-5 text-admin-muted transition-transform group-open:rotate-180"
                    />
                  </span>
                </summary>
                <div className="border-t border-[#ECE8DF] p-4 sm:p-5">
                  <YearBody year={year} view={view} basePath={basePath} />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function YearWorkspace({
  year,
  view,
  basePath,
  active,
}: {
  year: YearRow;
  view: YearView;
  basePath: string;
  active: boolean;
}) {
  return (
    <section
      aria-labelledby={`year-${year.id}`}
      className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ECE8DF] px-5 py-5 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={`year-${year.id}`}
              className="font-heading text-2xl font-bold tracking-[-0.01em]"
            >
              {year.label}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                active
                  ? "bg-[#DCEDDD] text-[#216A2B]"
                  : "bg-[#F0F0ED] text-[#4E5550]",
              )}
            >
              <span className="size-2 rounded-full bg-current" />
              {active ? "Aktivt skoleår" : "Siste registrerte skoleår"}
            </span>
          </div>
          <p className="mt-1 text-sm text-admin-muted">
            {view.unfinishedCount > 0
              ? `${view.unfinishedCount} elever er ikke ferdig betalt.`
              : "Alle registrerte krav er ferdig behandlet."}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&_[data-slot=button]]:min-h-11">
          <ReallocateYearButton schoolYearId={year.id} yearLabel={year.label} />
          <BatchSendButton schoolYearId={year.id} yearLabel={year.label} />
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <YearBody year={year} view={view} basePath={basePath} />
      </div>
    </section>
  );
}

function YearBody({
  year,
  view,
  basePath,
}: {
  year: YearRow;
  view: YearView;
  basePath: string;
}) {
  return (
    <div className="grid gap-6">
      <dl className="grid overflow-hidden rounded-xl bg-[#FAF9F5] ring-1 ring-[#E8E3D9] sm:grid-cols-3">
        <FinanceFact label="Krav totalt" value={formatNok(view.billed)} />
        <FinanceFact
          label="Innbetalt"
          value={formatNok(view.collected)}
          tone="green"
        />
        <FinanceFact
          label="Gjenstår"
          value={formatNok(view.outstanding)}
          tone={view.outstanding > 0 ? "yellow" : "green"}
        />
      </dl>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">Innkrevingsstatus</span>
          <span className="font-semibold text-admin-muted tabular-nums">
            {view.paidCount} av {view.totalStudents} ferdig betalt
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-[#EEEAE1]"
          role="progressbar"
          aria-label={`Innbetalt for ${year.label}`}
          aria-valuenow={view.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full w-full origin-left rounded-full bg-[#3C8F44]"
            style={{ transform: `scaleX(${view.progress / 100})` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-admin-muted">
          <StatusCount
            icon={CheckCircle2}
            label="Betalt"
            value={view.paidCount}
            tone="green"
          />
          <StatusCount
            icon={Clock3}
            label="Delvis"
            value={view.partialCount}
            tone="yellow"
          />
          <StatusCount
            icon={Clock3}
            label="Lenke sendt"
            value={view.pendingCount}
            tone="blue"
          />
          <StatusCount
            icon={AlertTriangle}
            label="Ikke betalt"
            value={view.unpaidCount}
            tone="red"
          />
          {view.exemptCount > 0 ? (
            <StatusCount
              icon={CheckCircle2}
              label="Fritatt"
              value={view.exemptCount}
              tone="neutral"
            />
          ) : null}
        </div>
      </div>

      <section aria-labelledby={`ledger-${year.id}`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3
              id={`ledger-${year.id}`}
              className="font-heading text-xl font-semibold"
            >
              Elever og krav
            </h3>
            <p className="mt-0.5 text-sm text-admin-muted">
              Uferdige betalinger vises først.
            </p>
          </div>
          <Link
            href={`${basePath}/betaling/logg`}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold text-[#277A31] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Se alle transaksjoner
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {view.students.length === 0 ? (
          <div className="rounded-xl bg-[#F7F6F1] px-4 py-6 text-sm text-admin-muted">
            Ingen aktive elever er registrert for dette skoleåret.
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[#E8E3D9] md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAF9F5] hover:bg-[#FAF9F5]">
                    <TableHead className="px-4">Elev</TableHead>
                    <TableHead>Klasse</TableHead>
                    <TableHead>Innbetalt</TableHead>
                    <TableHead>Gjenstår</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell className="px-4 py-3 font-bold">
                        <Link
                          href={`${basePath}/elever/${student.student_id}`}
                          className="outline-none underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {student.students
                            ? studentDisplayName(student.students) ||
                              "Navn mangler"
                            : "Navn mangler"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {student.classes?.name_no ?? "Ikke plassert"}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatNok(student.paid)}
                        <span className="ml-1 text-admin-muted">
                          av {formatNok(student.owed)}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatNok(student.remaining)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <PaymentState
                          state={student.state}
                          note={student.feeNote}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-[#ECE8DF] overflow-hidden rounded-xl border border-[#E8E3D9] md:hidden">
              {view.students.map((student) => (
                <li key={student.student_id}>
                  <Link
                    href={`${basePath}/elever/${student.student_id}`}
                    className="grid min-h-[6.5rem] grid-cols-[1fr_auto] gap-3 px-4 py-4 outline-none transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {student.students
                          ? studentDisplayName(student.students) ||
                            "Navn mangler"
                          : "Navn mangler"}
                      </span>
                      <span className="mt-0.5 block text-sm text-admin-muted">
                        {student.classes?.name_no ?? "Ikke plassert"}
                      </span>
                      <span className="mt-2 block text-sm font-semibold tabular-nums">
                        {formatNok(student.paid)} av {formatNok(student.owed)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end justify-between gap-2">
                      <PaymentState
                        state={student.state}
                        note={student.feeNote}
                      />
                      <ChevronRight
                        aria-hidden="true"
                        className="size-5 text-admin-muted"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function FinanceFact({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "yellow";
}) {
  return (
    <div className="border-b border-[#E8E3D9] px-4 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <dt className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 font-heading text-2xl font-bold tabular-nums",
          tone === "green" && "text-[#216A2B]",
          tone === "yellow" && "text-[#775108]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusCount({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number;
  tone: "green" | "yellow" | "blue" | "red" | "neutral";
}) {
  const tones = {
    green: "text-[#216A2B]",
    yellow: "text-[#775108]",
    blue: "text-[#245D84]",
    red: "text-[#8B2F2B]",
    neutral: "text-[#4E5550]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold",
        tones[tone],
      )}
    >
      <Icon aria-hidden={true} className="size-4" />
      {label} <span className="tabular-nums">{value}</span>
    </span>
  );
}

function PaymentState({
  state,
  note,
}: {
  state: LedgerState;
  note: string | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        stateClasses[state],
      )}
      title={state === "fritatt" ? (note ?? "Skal ikke betale") : undefined}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {stateLabels[state]}
    </span>
  );
}
