import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { InstallmentRowActions } from "@/components/admin/installment-row-actions";
import { formatNok } from "@/lib/money";
import { cn } from "@/lib/utils";

type InstallmentRow = {
  id: string;
  student_id: string;
  school_year_id: string;
  due_date: string;
  amount: number;
  status: string;
  sent_at: string | null;
  payment_id: string | null;
  payment_plans: {
    family_id: string;
    status: string;
    paused_at: string | null;
  } | null;
  students: {
    child_first_name: string | null;
    child_last_name: string | null;
  } | null;
};

function studentName(row: InstallmentRow) {
  const parts = [
    row.students?.child_first_name,
    row.students?.child_last_name,
  ].filter(Boolean);
  return parts.join(" ") || "Ukjent barn";
}

function formatDueDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3]">
      <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-bold tabular-nums",
          tone === "danger" && "text-[#8B2F2B]",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-admin-muted">{hint}</p> : null}
    </div>
  );
}

export default async function InstallmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const supabase = await createClient();

  const [{ data: yearRow }, { data: installmentData }, { data: familyData }] =
    await Promise.all([
      supabase
        .from("school_years")
        .select("id, label")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("installments")
        .select(
          "id, student_id, school_year_id, due_date, amount, status, sent_at, payment_id, payment_plans!inner(family_id, status, paused_at), students(child_first_name, child_last_name)",
        )
        .eq("payment_plans.status", "aktiv")
        .order("due_date", { ascending: true }),
      supabase.from("families").select("id, display_name"),
    ]);

  const activeYear = yearRow as { id: string; label: string } | null;
  const rows = ((installmentData as unknown as InstallmentRow[] | null) ?? [])
    .filter((row) => !activeYear || row.school_year_id === activeYear.id);
  const familyNameById = new Map(
    (
      (familyData as { id: string; display_name: string | null }[] | null) ??
      []
    ).map((family) => [family.id, family.display_name ?? "Familie uten navn"]),
  );

  const paymentIds = [
    ...new Set(
      rows
        .map((row) => row.payment_id)
        .filter((paymentId): paymentId is string => Boolean(paymentId)),
    ),
  ];
  const { data: paymentData } = paymentIds.length
    ? await supabase
        .from("payments")
        .select("id, status")
        .in("id", paymentIds)
    : { data: [] };
  const paymentStatusById = new Map(
    ((paymentData as { id: string; status: string }[] | null) ?? []).map(
      (payment) => [payment.id, payment.status],
    ),
  );

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const planned = rows.filter(
    (row) => row.status === "planlagt" && row.amount > 0,
  );
  const sent = rows.filter((row) => row.status === "sendt");
  const stopped = rows.filter((row) => row.status === "stoppet");
  const pausedFamilies = new Set(
    rows
      .filter((row) => row.payment_plans?.paused_at)
      .map((row) => row.payment_plans?.family_id),
  );

  const upcoming = planned.filter((row) => row.due_date <= horizonDate);
  const upcomingSum = upcoming.reduce((sum, row) => sum + row.amount, 0);
  const sentUnpaid = sent.filter(
    (row) =>
      !row.payment_id ||
      paymentStatusById.get(row.payment_id) === "opprettet" ||
      paymentStatusById.get(row.payment_id) === "autorisert",
  );
  const sentUnpaidSum = sentUnpaid.reduce((sum, row) => sum + row.amount, 0);
  const overdue = [...planned, ...sentUnpaid].filter(
    (row) => row.due_date < today,
  );
  const overdueSum = overdue.reduce((sum, row) => sum + row.amount, 0);

  function renderRows(list: InstallmentRow[], showActions: boolean) {
    return (
      <ul className="grid gap-1.5">
        {list.map((row) => {
          const familyId = row.payment_plans?.family_id ?? "";
          const familyName = familyNameById.get(familyId) ?? "Ukjent familie";
          const overdueRow = row.due_date < today;
          const paymentStatus = row.payment_id
            ? paymentStatusById.get(row.payment_id)
            : null;
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF9F5] px-3 py-2 text-sm ring-1 ring-[#E8E3D9]"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`${basePath}/familier/${familyId}`}
                  className="font-bold outline-none underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {familyName}
                </Link>
                <span className="text-admin-muted">{studentName(row)}</span>
                <span
                  className={cn(
                    "text-admin-muted",
                    overdueRow && "font-bold text-[#8B2F2B]",
                  )}
                >
                  Frist {formatDueDate(row.due_date)}
                  {overdueRow ? " (forfalt)" : ""}
                </span>
                {pausedFamilies.has(familyId) ? (
                  <span className="rounded-full bg-[#F9DEDB] px-2 py-0.5 text-xs font-bold text-[#8B2F2B]">
                    Utsendinger stoppet
                  </span>
                ) : null}
                {row.status === "sendt" && paymentStatus === "fanget" ? (
                  <span className="rounded-full bg-[#DCEDDD] px-2 py-0.5 text-xs font-bold text-[#216A2B]">
                    Betalt
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-bold tabular-nums">
                  {formatNok(row.amount)}
                </span>
                {showActions ? (
                  <InstallmentRowActions
                    installmentId={row.id}
                    status={row.status}
                    amount={row.amount}
                    familyName={familyName}
                    dueDateLabel={formatDueDate(row.due_date)}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

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
          Avdrag
        </h1>
        <p className="mt-1 max-w-3xl text-admin-muted">
          Automatiske betalingslenker for familier med betalingsplan
          {activeYear ? ` i ${activeYear.label}` : ""}. Lenker sendes på e-post
          cirka 14 dager før frist, med påminnelse en uke etter fristen.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Kommende 30 dager"
          value={formatNok(upcomingSum)}
          hint={`${upcoming.length} avdrag`}
        />
        <Stat
          label="Sendt, ikke betalt"
          value={formatNok(sentUnpaidSum)}
          hint={`${sentUnpaid.length} avdrag`}
        />
        <Stat
          label="Forfalt"
          value={formatNok(overdueSum)}
          hint={`${overdue.length} avdrag over frist`}
          tone={overdue.length > 0 ? "danger" : undefined}
        />
        <Stat
          label="Stoppet"
          value={String(stopped.length)}
          hint="avdrag holdt tilbake"
        />
      </div>

      <section
        aria-labelledby="upcoming-installments"
        className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
      >
        <h2
          id="upcoming-installments"
          className="flex items-center gap-2 font-heading text-xl font-bold"
        >
          <CalendarClock aria-hidden="true" className="size-5" />
          Kommende utsendinger
        </h2>
        <div className="mt-3">
          {planned.length > 0 ? (
            renderRows(planned, true)
          ) : (
            <p className="text-sm text-admin-muted">
              Ingen planlagte avdrag. Tildel en betalingsplan fra familiesiden
              for å komme i gang.
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="sent-installments"
        className="rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]"
      >
        <h2
          id="sent-installments"
          className="font-heading text-xl font-bold"
        >
          Sendte betalingslenker
        </h2>
        <div className="mt-3">
          {sent.length > 0 ? (
            renderRows(sent, false)
          ) : (
            <p className="text-sm text-admin-muted">
              Ingen avdrag er sendt ennå.
            </p>
          )}
        </div>
      </section>

      {stopped.length > 0 ? (
        <details className="group rounded-2xl bg-white p-5 ring-1 ring-[#E3DED3]">
          <summary className="cursor-pointer list-none font-heading text-xl font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            Stoppede avdrag ({stopped.length})
          </summary>
          <div className="mt-3">{renderRows(stopped, true)}</div>
        </details>
      ) : null}
    </div>
  );
}
