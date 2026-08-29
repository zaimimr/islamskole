import Link from "next/link";
import { ArrowLeft, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { formatNok } from "@/lib/money";

type AdjustmentRow = {
  id: string;
  student_id: string;
  school_year_id: string;
  type: string;
  amount: number;
  note: string;
  granted_by: string;
  created_at: string;
  revoked_at: string | null;
  students: {
    child_first_name: string | null;
    child_last_name: string | null;
    family_id: string | null;
  } | null;
  guardians: { first_name: string | null; last_name: string | null } | null;
};

const typeLabels: Record<string, string> = {
  soskenrabatt: "Søskenrabatt",
  laererbarn: "Lærerbarn",
  frivillig: "Frivillig",
  annet: "Annet fritak",
};

function personName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback: string,
) {
  return [first, last].filter(Boolean).join(" ") || fallback;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

export default async function DiscountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const supabase = await createClient();

  const [{ data: yearData }, { data: adjustmentData }] = await Promise.all([
    supabase
      .from("school_years")
      .select("id, label, is_active")
      .order("label", { ascending: false }),
    supabase
      .from("student_fee_adjustments")
      .select(
        "id, student_id, school_year_id, type, amount, note, granted_by, created_at, revoked_at, students(child_first_name, child_last_name, family_id), guardians(first_name, last_name)",
      )
      .order("created_at", { ascending: false }),
  ]);

  const years =
    (yearData as { id: string; label: string; is_active: boolean }[] | null) ??
    [];
  const yearLabelById = new Map(years.map((year) => [year.id, year.label]));
  const activeYear = years.find((year) => year.is_active) ?? years[0] ?? null;
  const adjustments =
    (adjustmentData as unknown as AdjustmentRow[] | null) ?? [];

  const activeAdjustments = adjustments.filter(
    (adjustment) => !adjustment.revoked_at,
  );
  const activeYearAdjustments = activeYear
    ? activeAdjustments.filter(
        (adjustment) => adjustment.school_year_id === activeYear.id,
      )
    : [];

  const totalsByType = new Map<string, { amount: number; count: number }>();
  for (const adjustment of activeYearAdjustments) {
    const entry = totalsByType.get(adjustment.type) ?? { amount: 0, count: 0 };
    entry.amount += adjustment.amount;
    entry.count += 1;
    totalsByType.set(adjustment.type, entry);
  }
  const totalActive = activeYearAdjustments.reduce(
    (sum, adjustment) => sum + adjustment.amount,
    0,
  );

  const teacherTotals = new Map<
    string,
    { name: string; amount: number; students: Set<string> }
  >();
  for (const adjustment of activeAdjustments) {
    if (adjustment.type !== "laererbarn") continue;
    const name = personName(
      adjustment.guardians?.first_name,
      adjustment.guardians?.last_name,
      "Ukjent lærer",
    );
    const entry = teacherTotals.get(name) ?? {
      name,
      amount: 0,
      students: new Set<string>(),
    };
    entry.amount += adjustment.amount;
    entry.students.add(adjustment.student_id);
    teacherTotals.set(name, entry);
  }

  const adjustmentsByYear = new Map<string, AdjustmentRow[]>();
  for (const adjustment of adjustments) {
    const list = adjustmentsByYear.get(adjustment.school_year_id) ?? [];
    list.push(adjustment);
    adjustmentsByYear.set(adjustment.school_year_id, list);
  }
  const yearIdsInOrder = years
    .map((year) => year.id)
    .filter((yearId) => adjustmentsByYear.has(yearId));

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
          Rabatter og fritak
        </h1>
        <p className="mt-1 max-w-3xl text-admin-muted">
          Alle rabatter og fritak logges med type, begrunnelse og hvem som ga
          dem, slik at du kan se effekten over tid. Rabatter gis fra familie-
          eller elevsiden.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]">
          <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
            Totalt {activeYear ? activeYear.label : "i år"}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
            {formatNok(totalActive)}
          </p>
          <p className="mt-0.5 text-xs text-admin-muted">
            {activeYearAdjustments.length} aktive fradrag
          </p>
        </div>
        {(["soskenrabatt", "laererbarn", "frivillig", "annet"] as const).map(
          (type) => {
            const entry = totalsByType.get(type);
            return (
              <div
                key={type}
                className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]"
              >
                <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
                  {typeLabels[type]}
                </p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {formatNok(entry?.amount ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-admin-muted">
                  {entry?.count ?? 0} fradrag
                </p>
              </div>
            );
          },
        )}
      </div>

      <section
        aria-labelledby="teacher-report"
        className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
      >
        <h2
          id="teacher-report"
          className="flex items-center gap-2 font-heading text-xl font-bold"
        >
          <Percent aria-hidden="true" className="size-5" />
          Gitt gratis per lærer
        </h2>
        <p className="mt-1 text-sm text-admin-muted">
          Summen av lærerbarn-fradrag per lærer, alle skoleår.
        </p>
        <div className="mt-3">
          {teacherTotals.size > 0 ? (
            <ul className="grid gap-1.5">
              {[...teacherTotals.values()]
                .sort((left, right) => right.amount - left.amount)
                .map((teacher) => (
                  <li
                    key={teacher.name}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                  >
                    <span className="font-bold">{teacher.name}</span>
                    <span className="text-admin-muted">
                      {teacher.students.size}{" "}
                      {teacher.students.size === 1 ? "barn" : "barn"} ·{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {formatNok(teacher.amount)}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-admin-muted">
              Ingen lærerbarn-fradrag er gitt ennå. Registrer lærere under
              Lærere og gi fradraget fra familie- eller elevsiden.
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="all-adjustments"
        className="grid gap-3"
      >
        <h2 id="all-adjustments" className="font-heading text-xl font-bold">
          Alle fradrag per skoleår
        </h2>
        {yearIdsInOrder.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-admin-muted ring-1 ring-[#E3DED3]">
            Ingen fradrag er registrert ennå.
          </p>
        ) : (
          yearIdsInOrder.map((yearId) => {
            const list = adjustmentsByYear.get(yearId) ?? [];
            const activeSum = list
              .filter((adjustment) => !adjustment.revoked_at)
              .reduce((sum, adjustment) => sum + adjustment.amount, 0);
            return (
              <details
                key={yearId}
                open={activeYear?.id === yearId}
                className="group rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-lg font-bold">
                    {yearLabelById.get(yearId) ?? "Ukjent skoleår"}
                  </span>
                  <span className="text-sm text-admin-muted">
                    {list.length} fradrag ·{" "}
                    <span className="font-bold text-foreground tabular-nums">
                      {formatNok(activeSum)}
                    </span>{" "}
                    aktivt
                  </span>
                </summary>
                <ul className="mt-3 grid gap-1.5">
                  {list.map((adjustment) => (
                    <li
                      key={adjustment.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
                    >
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Link
                          href={`${basePath}/elever/${adjustment.student_id}`}
                          className="font-bold outline-none underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {personName(
                            adjustment.students?.child_first_name,
                            adjustment.students?.child_last_name,
                            "Ukjent barn",
                          )}
                        </Link>
                        <span className="rounded-full bg-[#DCEDDD] px-2 py-0.5 text-xs font-bold text-[#216A2B]">
                          {typeLabels[adjustment.type] ?? adjustment.type}
                          {adjustment.type === "laererbarn"
                            ? ` (${personName(adjustment.guardians?.first_name, adjustment.guardians?.last_name, "ukjent lærer")})`
                            : ""}
                        </span>
                        <span className="text-admin-muted">
                          {adjustment.note}
                        </span>
                        {adjustment.revoked_at ? (
                          <span className="rounded-full bg-[#F0F0ED] px-2 py-0.5 text-xs font-bold text-[#4E5550]">
                            Opphevet
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-3 text-admin-muted">
                        <span>
                          {formatDate(adjustment.created_at)} ·{" "}
                          {adjustment.granted_by}
                        </span>
                        <span
                          className={`font-bold tabular-nums ${adjustment.revoked_at ? "text-admin-muted line-through" : "text-foreground"}`}
                        >
                          −{formatNok(adjustment.amount)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })
        )}
      </section>
    </div>
  );
}
