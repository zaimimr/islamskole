import Link from "next/link";
import { ArrowLeft, HandHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { formatNok } from "@/lib/money";

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

type StudentRow = {
  id: string;
  family_id: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
};

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nb-NO", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

export default async function SadaqaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const supabase = await createClient();

  const [{ data: yearRow }, { data: disbursementData }] = await Promise.all([
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
  ]);

  const activeYear = yearRow as { id: string; label: string } | null;
  const rows = (disbursementData as DisbursementRow[] | null) ?? [];

  const studentIds = [
    ...new Set(
      rows
        .map((row) => row.student_id)
        .filter((studentId): studentId is string => Boolean(studentId)),
    ),
  ];
  const { data: studentData } = studentIds.length
    ? await supabase
        .from("students")
        .select("id, family_id, child_first_name, child_last_name")
        .in("id", studentIds)
    : { data: [] };
  const students = new Map(
    ((studentData as StudentRow[] | null) ?? []).map((student) => [
      student.id,
      student,
    ]),
  );

  const paymentsSeen = new Set<string>();
  const uniquePayments = rows.filter((row) => {
    if (paymentsSeen.has(row.payment_id)) return false;
    paymentsSeen.add(row.payment_id);
    return true;
  });

  const netByPayment = new Map(
    uniquePayments.map((row) => [row.payment_id, row.net_paid_amount]),
  );
  const totalAllTime = [...netByPayment.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const yearPayments = uniquePayments.filter(
    (row) => activeYear && row.school_year_id === activeYear.id,
  );
  const totalThisYear = yearPayments.reduce(
    (sum, row) => sum + row.net_paid_amount,
    0,
  );

  const familiesThisYear = new Set(
    rows
      .filter((row) => activeYear && row.school_year_id === activeYear.id)
      .map((row) =>
        row.student_id ? students.get(row.student_id)?.family_id : null,
      )
      .filter(Boolean),
  );
  const childrenThisYear = new Set(
    rows
      .filter(
        (row) =>
          activeYear && row.school_year_id === activeYear.id && row.student_id,
      )
      .map((row) => row.student_id),
  );

  const byMonth = new Map<string, { amount: number; count: number }>();
  for (const row of uniquePayments) {
    const key = row.disbursed_at.slice(0, 7);
    const entry = byMonth.get(key) ?? { amount: 0, count: 0 };
    entry.amount += row.net_paid_amount;
    entry.count += 1;
    byMonth.set(key, entry);
  }
  const monthKeys = [...byMonth.keys()].sort().reverse();

  return (
    <div className="grid gap-7 lg:gap-8">
      <header>
        <Link
          href={`${basePath}/betaling`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[#277A31] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tilbake til økonomi
        </Link>
        <h1 className="mt-3 text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          Sadaqa
        </h1>
        <p className="mt-1 max-w-3xl text-admin-muted">
          Skoleavgifter dekket av sadaqa-kontoen. Systemet holder ikke saldo
          eller grense, dette er en oversikt over bruken. Dekning registreres
          fra familie- eller elevsiden.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]">
          <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
            Brukt {activeYear ? activeYear.label : "i år"}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
            {formatNok(totalThisYear)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]">
          <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
            Familier {activeYear ? activeYear.label : "i år"}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
            {familiesThisYear.size}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]">
          <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
            Barn {activeYear ? activeYear.label : "i år"}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
            {childrenThisYear.size}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]">
          <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
            Brukt totalt
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
            {formatNok(totalAllTime)}
          </p>
        </div>
      </div>

      <section
        aria-labelledby="sadaqa-usage"
        className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
      >
        <h2
          id="sadaqa-usage"
          className="flex items-center gap-2 font-heading text-xl font-bold"
        >
          <HandHeart aria-hidden="true" className="size-5" />
          Bruk over tid
        </h2>
        <div className="mt-3">
          {monthKeys.length > 0 ? (
            <ul className="grid gap-1.5">
              {monthKeys.map((key) => {
                const entry = byMonth.get(key)!;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                  >
                    <span className="font-bold capitalize">
                      {formatMonth(`${key}-15`)}
                    </span>
                    <span className="text-admin-muted">
                      {entry.count} tildelinger ·{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {formatNok(entry.amount)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-admin-muted">
              Ingen sadaqa-tildelinger ennå. Registrer dekning fra familie-
              eller elevsiden, så vises bruken her.
            </p>
          )}
        </div>
      </section>

      {rows.length > 0 ? (
        <section
          aria-labelledby="sadaqa-details"
          className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
        >
          <h2 id="sadaqa-details" className="font-heading text-xl font-bold">
            Alle tildelinger
          </h2>
          <ul className="mt-3 grid gap-1.5">
            {rows.map((row) => {
              const student = row.student_id
                ? students.get(row.student_id)
                : null;
              const name = student
                ? [student.child_first_name, student.child_last_name]
                    .filter(Boolean)
                    .join(" ") || "Ukjent barn"
                : "Ikke fordelt";
              const refunded = row.refunded_amount > 0;
              return (
                <li
                  key={`${row.payment_id}-${row.student_id ?? "none"}`}
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
                    <span className="text-admin-muted">
                      {row.description?.replace(/^Sadaqa - /, "") ?? ""}
                    </span>
                    {refunded ? (
                      <span className="rounded-full bg-[#FEEDCA] px-2 py-0.5 text-xs font-bold text-[#775108]">
                        {formatNok(row.refunded_amount)} tilbakeført
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-3 text-admin-muted">
                    <span>{formatDate(row.disbursed_at)}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatNok(row.allocated_amount ?? row.amount)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
