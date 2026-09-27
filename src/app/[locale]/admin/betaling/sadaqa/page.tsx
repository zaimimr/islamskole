import type { Metadata } from "next";
import Link from "next/link";
import { HandHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { formatNok } from "@/lib/money";
import { formatOsloDate, osloMonthKey } from "@/lib/dates";
import { isSadaqaFritak } from "@/lib/balances";
import { FinanceLoadError } from "../load-error";

export const metadata: Metadata = { title: "Sadaqa" };

type DisbursementRow = {
  payment_id: string;
  school_year_id: string | null;
  amount: number;
  refunded_amount: number;
  net_paid_amount: number;
  description: string | null;
  disbursed_at: string;
  student_id: string | null;
  allocated_amount: number | null;
};

type FritakRow = {
  id: string;
  student_id: string;
  school_year_id: string;
  type: string;
  amount: number;
  note: string;
  created_at: string;
};

type StudentRow = {
  id: string;
  family_id: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
};

type UsageEntry = {
  key: string;
  studentId: string | null;
  schoolYearId: string | null;
  date: string;
  amount: number;
  refunded: number;
  note: string;
  fritak: boolean;
};

export default async function SadaqaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const supabase = await createClient();

  const [yearResult, disbursementResult, fritakResult, feeResult] =
    await Promise.all([
      supabase
        .from("school_years")
        .select("id, label")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("sadaqa_disbursements")
        .select(
          "payment_id, school_year_id, amount, refunded_amount, net_paid_amount, description, disbursed_at, student_id, allocated_amount",
        )
        .order("disbursed_at", { ascending: false }),
      supabase
        .from("student_fee_adjustments")
        .select("id, student_id, school_year_id, type, amount, note, created_at")
        .eq("type", "annet")
        .ilike("note", "%sadaqa%")
        .is("revoked_at", null),
      supabase
        .from("student_fees")
        .select("student_id, school_year_id, amount, discount"),
    ]);
  if (
    yearResult.error ||
    disbursementResult.error ||
    fritakResult.error ||
    feeResult.error
  ) {
    return (
      <FinanceLoadError
        title="Sadaqa-oversikten kunne ikke lastes"
        retryHref={`${basePath}/betaling/sadaqa`}
      />
    );
  }

  const activeYear = yearResult.data as { id: string; label: string } | null;
  const rows = (disbursementResult.data as DisbursementRow[] | null) ?? [];
  const feeCaps = new Map(
    (
      (feeResult.data as
        | { student_id: string; school_year_id: string; amount: number; discount: number }[]
        | null) ?? []
    ).map((fee) => [
      `${fee.student_id}:${fee.school_year_id}`,
      Math.max(fee.amount - fee.discount, 0),
    ]),
  );
  const fritak = ((fritakResult.data as FritakRow[] | null) ?? []).filter(
    isSadaqaFritak,
  );

  const netByPayment = new Map<string, number>();
  const allocatedByPayment = new Map<string, number>();
  for (const row of rows) {
    netByPayment.set(row.payment_id, row.net_paid_amount);
    allocatedByPayment.set(
      row.payment_id,
      (allocatedByPayment.get(row.payment_id) ?? 0) + (row.allocated_amount ?? 0),
    );
  }

  const entries: UsageEntry[] = [
    ...rows.map((row) => ({
      key: `${row.payment_id}-${row.student_id ?? "none"}`,
      studentId: row.student_id,
      schoolYearId: row.school_year_id,
      date: row.disbursed_at,
      amount: (() => {
        const net = netByPayment.get(row.payment_id) ?? 0;
        const allocated = allocatedByPayment.get(row.payment_id) ?? 0;
        if (row.allocated_amount == null) return Math.max(net - allocated, 0);
        return allocated > net && allocated > 0
          ? Math.round((row.allocated_amount * net) / allocated)
          : row.allocated_amount;
      })(),
      refunded: row.refunded_amount,
      note: row.description?.replace(/^Sadaqa - /, "") ?? "",
      fritak: false,
    })),
    ...fritak.map((row) => ({
      key: `fritak-${row.id}`,
      studentId: row.student_id,
      schoolYearId: row.school_year_id,
      date: row.created_at,
      amount: Math.min(
        row.amount,
        feeCaps.get(`${row.student_id}:${row.school_year_id}`) ?? row.amount,
      ),
      refunded: 0,
      note: row.note,
      fritak: true,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const studentIds = [
    ...new Set(
      entries
        .map((entry) => entry.studentId)
        .filter((studentId): studentId is string => Boolean(studentId)),
    ),
  ];
  const { data: studentData, error: studentError } = studentIds.length
    ? await supabase
        .from("students")
        .select("id, family_id, child_first_name, child_last_name")
        .in("id", studentIds)
    : { data: [], error: null };
  if (studentError) {
    return (
      <FinanceLoadError
        title="Sadaqa-oversikten kunne ikke lastes"
        retryHref={`${basePath}/betaling/sadaqa`}
      />
    );
  }
  const students = new Map(
    ((studentData as StudentRow[] | null) ?? []).map((student) => [
      student.id,
      student,
    ]),
  );

  const yearEntries = entries.filter(
    (entry) => activeYear && entry.schoolYearId === activeYear.id,
  );
  const totalThisYear = yearEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const fritakThisYear = yearEntries
    .filter((entry) => entry.fritak)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalAllTime = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const familiesThisYear = new Set(
    yearEntries
      .map((entry) =>
        entry.studentId
          ? (students.get(entry.studentId)?.family_id ?? entry.studentId)
          : null,
      )
      .filter(Boolean),
  );
  const childrenThisYear = new Set(
    yearEntries.map((entry) => entry.studentId).filter(Boolean),
  );

  const byMonth = new Map<string, { amount: number; count: number }>();
  for (const entry of entries) {
    const key = osloMonthKey(entry.date);
    const month = byMonth.get(key) ?? { amount: 0, count: 0 };
    month.amount += entry.amount;
    month.count += 1;
    byMonth.set(key, month);
  }
  const monthKeys = [...byMonth.keys()].sort().reverse();
  const yearLabel = activeYear ? activeYear.label : "i år";

  return (
    <div className="grid gap-6 lg:gap-7">
      <header>
        <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          Sadaqa
        </h1>
        <p className="mt-1 max-w-3xl text-admin-muted">
          Skolepenger dekket av sadaqa-kontoen. Systemet holder ikke saldo
          eller grense, dette er en oversikt over bruken. Dekning registreres
          fra familiesiden.
        </p>
      </header>

      {entries.length === 0 ? (
        <section className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-[#E3DED3]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F0F0ED] text-admin-muted">
            <HandHeart aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 font-heading text-xl font-semibold">
            Ingen sadaqa er brukt ennå
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-admin-muted">
            Når sadaqa-kontoen dekker skolepenger for et barn, registrer du det
            under Rabatter, fritak og sadaqa på familiesiden.
          </p>
          <Link
            href={`${basePath}/familier`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Gå til familier
          </Link>
        </section>
      ) : (
        <>
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
            <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
              <div>
                <dt className="text-sm font-bold text-admin-muted">
                  Brukt {yearLabel}
                </dt>
                <dd className="font-heading text-2xl font-bold tabular-nums">
                  {formatNok(totalThisYear)}
                </dd>
                <dd className="text-xs text-admin-muted">
                  {familiesThisYear.size}{" "}
                  {familiesThisYear.size === 1 ? "familie" : "familier"},{" "}
                  {childrenThisYear.size} barn
                </dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-admin-muted">Brukt totalt</dt>
                <dd className="font-heading text-xl font-bold tabular-nums">
                  {formatNok(totalAllTime)}
                </dd>
              </div>
            </dl>
            {fritakThisYear > 0 ? (
              <p className="mt-3 text-sm text-[#6B5524]">
                {formatNok(fritakThisYear)} av dette er registrert som fritak med
                «Sadaqa» i begrunnelsen, for eksempel fra migreringen. Beløpet er
                begrenset til barnets skolepenger.
              </p>
            ) : null}
          </section>

          <section
            aria-labelledby="sadaqa-usage"
            className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
          >
            <h2 id="sadaqa-usage" className="font-heading text-xl font-bold">
              Bruk over tid
            </h2>
            <ul className="mt-3 grid gap-1.5">
              {monthKeys.map((key) => {
                const entry = byMonth.get(key)!;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                  >
                    <span className="font-bold capitalize">
                      {formatOsloDate(`${key}-15`, { month: "long", year: "numeric" })}
                    </span>
                    <span className="text-admin-muted">
                      {entry.count}{" "}
                      {entry.count === 1 ? "tildeling" : "tildelinger"} ·{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {formatNok(entry.amount)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            aria-labelledby="sadaqa-details"
            className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
          >
            <h2 id="sadaqa-details" className="font-heading text-xl font-bold">
              Alle tildelinger
            </h2>
            <ul className="mt-3 grid gap-1.5">
              {entries.map((entry) => {
                const student = entry.studentId
                  ? students.get(entry.studentId)
                  : null;
                const name = student
                  ? [student.child_first_name, student.child_last_name]
                      .filter(Boolean)
                      .join(" ") || "Ukjent barn"
                  : "Ikke fordelt";
                return (
                  <li
                    key={entry.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {student ? (
                        <Link
                          href={`${basePath}/elever/${student.id}`}
                          className="font-bold outline-none underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-bold">{name}</span>
                      )}
                      <span className="text-admin-muted">{entry.note}</span>
                      {entry.fritak ? (
                        <span className="rounded-full bg-[#F0F0ED] px-2 py-0.5 text-xs font-bold text-[#4E5550]">
                          Ført som fritak
                        </span>
                      ) : null}
                      {entry.refunded > 0 ? (
                        <span className="rounded-full bg-[#FEEDCA] px-2 py-0.5 text-xs font-bold text-[#775108]">
                          {formatNok(entry.refunded)} tilbakeført
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3 text-admin-muted">
                      <span>{formatOsloDate(entry.date)}</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {formatNok(entry.amount)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
