import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
import { adminBasePath } from "@/components/admin/paths";
import {
  AllocatePaymentDialog,
  type AllocationStudent,
} from "@/components/admin/allocate-payment-dialog";
import { RefundPaymentDialog } from "@/components/admin/refund-payment-dialog";
import { PaymentLinkActions } from "@/components/admin/payment-link-actions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const statusLabels: Record<string, string> = {
  opprettet: "Venter",
  autorisert: "Autorisert",
  fanget: "Betalt",
  avbrutt: "Avbrutt",
  refundert: "Refundert",
  feilet: "Feilet",
};

const statusClasses: Record<string, string> = {
  opprettet: "bg-[#DDEEF9] text-[#245D84]",
  autorisert: "bg-[#FEEDCA] text-[#775108]",
  fanget: "bg-[#DCEDDD] text-[#216A2B]",
  avbrutt: "bg-[#F0F0ED] text-[#4E5550]",
  refundert: "bg-[#F0F0ED] text-[#4E5550]",
  feilet: "bg-[#F9DEDB] text-[#8B2F2B]",
};

const methodLabels: Record<string, string> = {
  vipps: "Vipps",
  kontant: "Kontant",
  bank: "Bankoverføring",
  annet: "Annet",
  sadaqa: "Sadaqa",
};

type PaymentRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  method: string;
  captured_amount: number;
  refunded_amount: number;
  description: string | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string;
  payer_name: string | null;
  payer_phone: string | null;
  payer_email: string | null;
  vipps_payment_method: string | null;
  voided_at: string | null;
  last_synced_at: string | null;
  school_years: { label: string } | null;
};

type AllocationRow = {
  payment_id: string;
  student_id: string;
  amount: number;
  students: {
    child_first_name: string | null;
    child_last_name: string | null;
  } | null;
};

type ApplicationRow = {
  payment_id: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
  status: string | null;
};

type EventRow = {
  reference: string;
  name: string;
  occurred_at: string;
  success: boolean | null;
};

type RefundRow = {
  payment_id: string;
  student_id: string | null;
  amount: number;
  method: string;
  reason: string;
  refunded_on: string;
  refunded_by: string;
};

type PaymentLogData = {
  payments: PaymentRow[];
  allocations: AllocationRow[];
  events: EventRow[];
  applications: ApplicationRow[];
  students: AllocationStudent[];
  refunds: RefundRow[];
  total: number;
};

const statusFilters: Record<string, string[]> = {
  venter: ["opprettet", "autorisert"],
  betalt: ["fanget"],
  avbrutt: ["avbrutt", "feilet"],
  refundert: ["refundert"],
};

function formatNok(ore: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(ore / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Oslo",
  });
}

function buildLogHref(
  basePath: string,
  values: { query: string; status: string; page?: number },
) {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.status) params.set("status", values.status);
  if ((values.page ?? 1) > 1) params.set("page", String(values.page));
  const suffix = params.toString();
  return `${basePath}/betaling/logg${suffix ? `?${suffix}` : ""}`;
}

async function getData(
  query: string,
  status: string,
  page: number,
): Promise<{ ok: true; data: PaymentLogData } | { ok: false }> {
  try {
    const supabase = await createClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let paymentQuery = supabase
      .from("payments")
      .select(
        "id, reference, amount, status, method, description, paid_at, due_date, created_at, captured_amount, refunded_amount, payer_name, payer_phone, payer_email, vipps_payment_method, voided_at, last_synced_at, school_years(label)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    const statuses = statusFilters[status];
    if (statuses) paymentQuery = paymentQuery.in("status", statuses);

    const term = query.replace(/[%,()]/g, " ").trim();
    if (term) {
      paymentQuery = paymentQuery.or(
        `reference.ilike.%${term}%,description.ilike.%${term}%,payer_name.ilike.%${term}%,payer_phone.ilike.%${term}%`,
      );
    }

    const paymentResult = await paymentQuery;
    if (paymentResult.error) return { ok: false };

    const payments = (paymentResult.data as PaymentRow[] | null) ?? [];
    const ids = payments.map((payment) => payment.id);
    const references = payments.map((payment) => payment.reference);
    const [
      allocationResult,
      eventResult,
      applicationResult,
      studentResult,
      refundResult,
    ] = await Promise.all([
        ids.length > 0
          ? supabase
              .from("payment_allocations")
              .select(
                "payment_id, student_id, amount, students(child_first_name, child_last_name)",
              )
              .in("payment_id", ids)
          : Promise.resolve({ data: [], error: null }),
        references.length > 0
          ? supabase
              .from("payment_events")
              .select("reference, name, occurred_at, success")
              .in("reference", references)
              .order("occurred_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        ids.length > 0
          ? supabase
              .from("student_applications")
              .select("payment_id, child_first_name, child_last_name, status")
              .in("payment_id", ids)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("students")
          .select("id, child_first_name, child_last_name")
          .order("child_first_name", { ascending: true }),
        ids.length > 0
          ? supabase
              .from("refunds")
              .select(
                "payment_id, student_id, amount, method, reason, refunded_on, refunded_by",
              )
              .in("payment_id", ids)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (
      allocationResult.error ||
      eventResult.error ||
      applicationResult.error ||
      studentResult.error ||
      refundResult.error
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      data: {
        payments,
        allocations: (allocationResult.data as AllocationRow[] | null) ?? [],
        events: (eventResult.data as EventRow[] | null) ?? [],
        applications: (applicationResult.data as ApplicationRow[] | null) ?? [],
        refunds: (refundResult.data as RefundRow[] | null) ?? [],
        students: (
          (studentResult.data as
            | {
                id: string;
                child_first_name: string | null;
                child_last_name: string | null;
              }[]
            | null) ?? []
        ).map((student) => ({
          id: student.id,
          name: studentDisplayName(student) || "Uten navn",
        })),
        total: paymentResult.count ?? 0,
      },
    };
  } catch {
    return { ok: false };
  }
}

export default async function PaymentLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const basePath = adminBasePath(locale);
  const result = await getData(query, status, page);

  if (!result.ok) {
    return (
      <section
        aria-labelledby="payment-log-error"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1
          id="payment-log-error"
          className="mt-4 font-heading text-3xl font-bold tracking-[-0.02em]"
        >
          Betalingsloggen kunne ikke lastes
        </h1>
        <p className="mt-2 max-w-prose text-admin-muted">
          Historikken er ikke erstattet med en tom liste. Prøv igjen før du
          avstemmer eller endrer en betaling.
        </p>
        <Link
          href={buildLogHref(basePath, { query, status, page })}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Prøv igjen
        </Link>
      </section>
    );
  }

  const data = result.data;
  const allocationsByPayment = new Map<string, AllocationRow[]>();
  const applicationsByPayment = new Map<string, ApplicationRow[]>();
  const eventsByReference = new Map<string, EventRow[]>();

  for (const allocation of data.allocations) {
    const list = allocationsByPayment.get(allocation.payment_id) ?? [];
    list.push(allocation);
    allocationsByPayment.set(allocation.payment_id, list);
  }
  for (const application of data.applications) {
    if (!application.payment_id) continue;
    const list = applicationsByPayment.get(application.payment_id) ?? [];
    list.push(application);
    applicationsByPayment.set(application.payment_id, list);
  }
  for (const event of data.events) {
    const list = eventsByReference.get(event.reference) ?? [];
    list.push(event);
    eventsByReference.set(event.reference, list);
  }
  const refundsByPayment = new Map<string, RefundRow[]>();
  for (const refund of data.refunds) {
    const list = refundsByPayment.get(refund.payment_id) ?? [];
    list.push(refund);
    refundsByPayment.set(refund.payment_id, list);
  }

  const fromRecord = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRecord = Math.min(page * PAGE_SIZE, data.total);
  const hasPrevious = page > 1;
  const hasNext = page * PAGE_SIZE < data.total;
  const filtered = Boolean(query || status);

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
          Betalingslogg
        </h1>
        <p className="mt-1 max-w-3xl text-admin-muted">
          Se hvem som betalte, hvilke barn betalingen dekker og hva Vipps sist
          rapporterte.
        </p>
      </header>

      <form
        action={`${basePath}/betaling/logg`}
        className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] md:grid-cols-[minmax(16rem,1fr)_15rem_auto] md:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="payment-search" className="text-sm font-bold">
            Søk i betalinger
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-muted"
            />
            <input
              id="payment-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Navn, telefon eller referanse"
              spellCheck={false}
              className="min-h-11 w-full rounded-xl border border-[#DCD7CC] bg-white pr-3 pl-10 text-sm outline-none transition-colors placeholder:text-[#6A716C] focus-visible:border-[#3C8F44] focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="payment-status" className="text-sm font-bold">
            Status
          </label>
          <select
            id="payment-status"
            name="status"
            defaultValue={status}
            className="min-h-11 w-full rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm outline-none focus-visible:border-[#3C8F44] focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">Alle statuser</option>
            <option value="venter">Sendt, venter på betaling</option>
            <option value="betalt">Betalt</option>
            <option value="avbrutt">Avbrutt eller feilet</option>
            <option value="refundert">Refundert</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-none"
          >
            Vis resultater
          </button>
          {filtered ? (
            <Link
              href={`${basePath}/betaling/logg`}
              aria-label="Nullstill søk og status"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-[#DCD7CC] bg-white outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="payment-results-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="payment-results-title"
              className="font-heading text-xl font-semibold"
            >
              {filtered ? "Søkeresultater" : "Nyeste betalinger"}
            </h2>
            <p className="mt-0.5 text-sm text-admin-muted" aria-live="polite">
              {data.total === 0
                ? "Ingen betalinger funnet"
                : `Viser ${fromRecord}-${toRecord} av ${data.total}`}
            </p>
          </div>
          <Link
            href={`${basePath}/betaling/dobbeltforinger`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[#277A31] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ReceiptText aria-hidden="true" className="size-4" />
            Kontroller dobbeltføringer
          </Link>
        </div>

        {data.payments.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-[#E3DED3]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F0F0ED] text-admin-muted">
              <ReceiptText aria-hidden="true" className="size-6" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-semibold">
              {filtered
                ? "Ingen betalinger samsvarer"
                : "Ingen betalinger ennå"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-admin-muted">
              {filtered
                ? "Prøv et annet navn, telefonnummer, referanse eller status."
                : "Betalinger vises her så snart de er opprettet eller registrert."}
            </p>
          </div>
        ) : (
          <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
            <li
              aria-hidden="true"
              className="hidden grid-cols-[8.5rem_minmax(10rem,1fr)_minmax(12rem,1.2fr)_7.5rem_8rem_minmax(10rem,auto)] gap-4 border-b border-[#E8E3D9] bg-[#FAF9F5] px-5 py-3 text-xs font-bold tracking-[0.04em] text-admin-muted uppercase xl:grid"
            >
              <span>Betaling</span>
              <span>Betaler</span>
              <span>Barn</span>
              <span>Beløp</span>
              <span>Status</span>
              <span className="text-right">Handlinger</span>
            </li>
            {data.payments.map((payment) => {
              const allocations = allocationsByPayment.get(payment.id) ?? [];
              const applications = applicationsByPayment.get(payment.id) ?? [];
              const refunds = refundsByPayment.get(payment.id) ?? [];
              const refundedByStudent = new Map<string, number>();
              for (const refund of refunds) {
                if (!refund.student_id) continue;
                refundedByStudent.set(
                  refund.student_id,
                  (refundedByStudent.get(refund.student_id) ?? 0) +
                    refund.amount,
                );
              }
              const events = eventsByReference.get(payment.reference) ?? [];
              const latestEvent = events[0] ?? null;
              const voided = Boolean(payment.voided_at);
              const vippsPayment =
                payment.method === "vipps" &&
                !payment.reference.startsWith("manual-");
              const dueDate = formatDueDate(payment.due_date);

              return (
                <li
                  key={payment.id}
                  className={cn(
                    "border-b border-[#ECE8DF] px-4 py-4 last:border-b-0 sm:px-5",
                    voided && "bg-[#FAF9F5]",
                  )}
                >
                  <div className="grid gap-4 xl:grid-cols-[8.5rem_minmax(10rem,1fr)_minmax(12rem,1.2fr)_7.5rem_8rem_minmax(10rem,auto)] xl:items-start">
                    <div className="flex items-start justify-between gap-3 xl:block">
                      <div>
                        <p className="font-bold xl:text-sm">
                          {formatDateTime(
                            payment.paid_at ?? payment.created_at,
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-admin-muted">
                          {methodLabels[payment.method] ?? payment.method}
                          {payment.vipps_payment_method
                            ? `, ${payment.vipps_payment_method}`
                            : ""}
                        </p>
                      </div>
                      <PaymentStatus
                        status={payment.status}
                        voided={voided}
                        capturedAmount={payment.captured_amount}
                        refundedAmount={payment.refunded_amount}
                        className="xl:hidden"
                      />
                    </div>

                    <div>
                      <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase xl:hidden">
                        Betaler
                      </p>
                      <p className="mt-1 font-bold xl:mt-0">
                        {payment.payer_name ?? "Betaler ikke oppgitt"}
                      </p>
                      {payment.payer_phone || payment.payer_email ? (
                        <p className="mt-0.5 break-words text-sm text-admin-muted">
                          {[payment.payer_phone, payment.payer_email]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase xl:hidden">
                        Barn
                      </p>
                      {allocations.length > 0 ? (
                        <ul className="mt-1 grid gap-1 xl:mt-0">
                          {allocations.map((allocation) => (
                            <li
                              key={`${payment.id}-${allocation.student_id}`}
                              className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"
                            >
                              <Link
                                href={`${basePath}/elever/${allocation.student_id}`}
                                className="font-bold outline-none underline-offset-2 hover:underline focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                {allocation.students
                                  ? studentDisplayName(allocation.students) ||
                                    "Ukjent barn"
                                  : "Ukjent barn"}
                              </Link>
                              <span className="text-admin-muted tabular-nums">
                                {formatNok(allocation.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : applications.length > 0 ? (
                        <div className="mt-1 xl:mt-0">
                          <p className="font-bold">
                            {applications
                              .map(
                                (application) =>
                                  studentDisplayName(application) ||
                                  "Ukjent barn",
                              )
                              .join(", ")}
                          </p>
                          <p className="mt-0.5 text-xs text-admin-muted">
                            Påmelding ikke godkjent ennå
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-[#8B2F2B] xl:mt-0">
                          Ikke fordelt
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-3 xl:block">
                      <div>
                        <p className="text-xs font-bold tracking-[0.04em] text-admin-muted uppercase xl:hidden">
                          Beløp
                        </p>
                        <p
                          className={cn(
                            "mt-1 font-heading text-xl font-bold tabular-nums xl:mt-0 xl:text-base",
                            voided && "line-through text-admin-muted",
                          )}
                        >
                          {formatNok(payment.amount)}
                        </p>
                        <p className="mt-0.5 text-xs text-admin-muted">
                          {payment.school_years?.label ?? "Skoleår mangler"}
                        </p>
                      </div>
                      {dueDate && payment.status !== "fanget" ? (
                        <span className="rounded-full bg-[#FEEDCA] px-2.5 py-1 text-xs font-bold text-[#775108] xl:mt-2 xl:inline-flex">
                          Frist {dueDate}
                        </span>
                      ) : null}
                    </div>

                    <div className="hidden xl:block">
                      <PaymentStatus
                        status={payment.status}
                        voided={voided}
                        capturedAmount={payment.captured_amount}
                        refundedAmount={payment.refunded_amount}
                      />
                      {latestEvent?.success === false ? (
                        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#8B2F2B]">
                          <AlertTriangle
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          Vipps-feil
                        </p>
                      ) : latestEvent ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-admin-muted">
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          Synkronisert
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end [&_[data-slot=button]]:min-h-11">
                      <AllocatePaymentDialog
                        paymentId={payment.id}
                        paymentAmount={payment.amount}
                        students={data.students}
                        existing={allocations.map((allocation) => ({
                          studentId: allocation.student_id,
                          amount: allocation.amount,
                        }))}
                      />
                      {vippsPayment &&
                      (payment.status === "opprettet" ||
                        payment.status === "autorisert") &&
                      !voided ? (
                        <PaymentLinkActions paymentId={payment.id} />
                      ) : null}
                      {!voided &&
                      payment.captured_amount > 0 &&
                      payment.refunded_amount < payment.captured_amount ? (
                        <RefundPaymentDialog
                          paymentId={payment.id}
                          capturedAmount={payment.captured_amount}
                          refundedAmount={payment.refunded_amount}
                          payerName={payment.payer_name}
                          vippsRefundAvailable={vippsPayment}
                          allocations={allocations.map((allocation) => ({
                            studentId: allocation.student_id,
                            name: allocation.students
                              ? studentDisplayName(allocation.students) ||
                                "Ukjent barn"
                              : "Ukjent barn",
                            amount: allocation.amount,
                            refunded:
                              refundedByStudent.get(allocation.student_id) ??
                              0,
                          }))}
                        />
                      ) : null}
                    </div>
                  </div>

                  <details className="group mt-3 rounded-xl bg-[#FAF9F5] ring-1 ring-[#E8E3D9]">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-bold outline-none hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2">
                        {vippsPayment ? (
                          <Smartphone aria-hidden="true" className="size-4" />
                        ) : (
                          <ReceiptText aria-hidden="true" className="size-4" />
                        )}
                        Referanse og hendelser
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-admin-muted transition-transform group-open:rotate-90"
                      />
                    </summary>
                    <dl className="grid gap-3 border-t border-[#E8E3D9] px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <LogDetail
                        label="Referanse"
                        value={payment.reference}
                        mono
                      />
                      <LogDetail
                        label="Siste Vipps-hendelse"
                        value={
                          latestEvent
                            ? `${latestEvent.name}, ${formatDateTime(latestEvent.occurred_at)}${latestEvent.success === false ? ", feilet" : ""}`
                            : "Ingen hendelser registrert"
                        }
                      />
                      <LogDetail
                        label="Sist synkronisert"
                        value={formatDateTime(payment.last_synced_at)}
                      />
                      {payment.description ? (
                        <LogDetail
                          label="Beskrivelse"
                          value={payment.description}
                        />
                      ) : null}
                      {events.length > 1 ? (
                        <LogDetail
                          label="Antall Vipps-hendelser"
                          value={String(events.length)}
                        />
                      ) : null}
                      {refunds.length > 0 ? (
                        <LogDetail
                          label="Refusjoner"
                          value={refunds
                            .map((refund) => {
                              const child = refund.student_id
                                ? allocations.find(
                                    (allocation) =>
                                      allocation.student_id ===
                                      refund.student_id,
                                  )
                                : null;
                              const childName = child?.students
                                ? studentDisplayName(child.students)
                                : null;
                              return `${formatNok(refund.amount)} (${methodLabels[refund.method] ?? refund.method}${childName ? `, ${childName}` : ""}, ${formatDueDate(refund.refunded_on) ?? refund.refunded_on}) - ${refund.reason}`;
                            })
                            .join("\n")}
                        />
                      ) : null}
                    </dl>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {data.total > 0 ? (
        <nav
          aria-label="Sider i betalingsloggen"
          className="flex items-center justify-between gap-3"
        >
          {hasPrevious ? (
            <Link
              href={buildLogHref(basePath, {
                query,
                status,
                page: page - 1,
              })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Forrige
            </Link>
          ) : (
            <span className="min-h-11" />
          )}
          <span className="text-sm font-semibold text-admin-muted">
            Side {page} av {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
          </span>
          {hasNext ? (
            <Link
              href={buildLogHref(basePath, {
                query,
                status,
                page: page + 1,
              })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Neste
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <span className="min-h-11" />
          )}
        </nav>
      ) : null}
    </div>
  );
}

function PaymentStatus({
  status,
  voided,
  capturedAmount = 0,
  refundedAmount = 0,
  className,
}: {
  status: string;
  voided: boolean;
  capturedAmount?: number;
  refundedAmount?: number;
  className?: string;
}) {
  const partiallyRefunded =
    !voided &&
    status === "fanget" &&
    refundedAmount > 0 &&
    refundedAmount < capturedAmount;
  const label = voided ? "Annullert" : (statusLabels[status] ?? status);
  const tone = voided
    ? "bg-[#F9DEDB] text-[#8B2F2B]"
    : (statusClasses[status] ?? "bg-[#F0F0ED] text-[#4E5550]");

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
          tone,
        )}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {label}
      </span>
      {partiallyRefunded ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#FEEDCA] px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[#775108]">
          Delvis refundert · {formatNok(refundedAmount)}
        </span>
      ) : null}
    </span>
  );
}

function LogDetail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-admin-muted">{label}</dt>
      <dd
        className={cn("mt-0.5 break-words", mono && "font-mono text-xs")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
