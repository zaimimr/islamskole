import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import {
  AllocatePaymentDialog,
  type AllocationStudent,
} from "@/components/admin/allocate-payment-dialog";
import { RefundPaymentDialog } from "@/components/admin/refund-payment-dialog";
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

const PAGE_SIZE = 100;

const statusLabels: Record<string, string> = {
  opprettet: "Venter",
  autorisert: "Autorisert",
  fanget: "Betalt",
  avbrutt: "Avbrutt",
  refundert: "Refundert",
  feilet: "Feilet",
};

const methodLabels: Record<string, string> = {
  vipps: "Vipps",
  kontant: "Kontant",
  bank: "Bankoverføring",
  annet: "Annet",
};

type PaymentRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  method: string;
  description: string | null;
  paid_at: string | null;
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

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function getData(query: string) {
  const supabase = await createClient();

  let paymentQuery = supabase
    .from("payments")
    .select(
      "id, reference, amount, status, method, description, paid_at, created_at, payer_name, payer_phone, payer_email, vipps_payment_method, voided_at, last_synced_at, school_years(label)",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const term = query.replace(/[%,()]/g, " ").trim();
  if (term) {
    paymentQuery = paymentQuery.or(
      `reference.ilike.%${term}%,description.ilike.%${term}%,payer_name.ilike.%${term}%,payer_phone.ilike.%${term}%`,
    );
  }

  const { data: payments } = await paymentQuery;
  const rows = (payments as PaymentRow[] | null) ?? [];
  const ids = rows.map((row) => row.id);
  const references = rows.map((row) => row.reference);

  const [{ data: allocations }, { data: events }, { data: applications }, { data: students }] =
    await Promise.all([
    ids.length
      ? supabase
          .from("payment_allocations")
          .select(
            "payment_id, student_id, amount, students(child_first_name, child_last_name)",
          )
          .in("payment_id", ids)
      : Promise.resolve({ data: [] }),
    references.length
      ? supabase
          .from("payment_events")
          .select("reference, name, occurred_at, success")
          .in("reference", references)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("student_applications")
          .select("payment_id, child_first_name, child_last_name, status")
          .in("payment_id", ids)
      : Promise.resolve({ data: [] }),
    supabase
      .from("students")
      .select("id, child_first_name, child_last_name")
      .order("child_first_name", { ascending: true }),
  ]);

  return {
    payments: rows,
    allocations: (allocations as AllocationRow[] | null) ?? [],
    events: (events as EventRow[] | null) ?? [],
    applications: (applications as ApplicationRow[] | null) ?? [],
    students: (
      (students as
        | {
            id: string;
            child_first_name: string | null;
            child_last_name: string | null;
          }[]
        | null) ?? []
    ).map((student) => ({
      id: student.id,
      name: studentDisplayName(student) || "Uten navn",
    })) as AllocationStudent[],
  };
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
  const basePath = adminBasePath(locale);

  const { payments, allocations, events, applications, students } =
    await getData(query);

  const allocationsByPayment = new Map<string, AllocationRow[]>();
  for (const allocation of allocations) {
    const list = allocationsByPayment.get(allocation.payment_id) ?? [];
    list.push(allocation);
    allocationsByPayment.set(allocation.payment_id, list);
  }

  const applicationsByPayment = new Map<string, ApplicationRow[]>();
  for (const application of applications) {
    if (!application.payment_id) continue;
    const list = applicationsByPayment.get(application.payment_id) ?? [];
    list.push(application);
    applicationsByPayment.set(application.payment_id, list);
  }

  const eventsByReference = new Map<string, EventRow[]>();
  for (const event of events) {
    const list = eventsByReference.get(event.reference) ?? [];
    list.push(event);
    eventsByReference.set(event.reference, list);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Betalingslogg"
        description="Alle betalinger med hvem som betalte, hvilke barn de dekker, og hva Vipps har rapportert."
      />

      <form className="flex flex-wrap gap-2" action={`${basePath}/betaling/logg`}>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Søk på navn, telefon eller referanse"
          className="h-9 min-w-64 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        />
        <button
          type="submit"
          className="h-9 rounded-md border px-4 text-sm font-medium"
        >
          Søk
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {query
                ? "Ingen betalinger samsvarer med søket."
                : "Ingen betalinger ennå."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dato</TableHead>
                    <TableHead>Beløp</TableHead>
                    <TableHead>Måte</TableHead>
                    <TableHead>Betaler</TableHead>
                    <TableHead>Barn</TableHead>
                    <TableHead>Skoleår</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vipps</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const rows = allocationsByPayment.get(payment.id) ?? [];
                    const apps = applicationsByPayment.get(payment.id) ?? [];
                    const log = eventsByReference.get(payment.reference) ?? [];
                    const voided = Boolean(payment.voided_at);
                    return (
                      <TableRow
                        key={payment.id}
                        className={voided ? "opacity-55" : undefined}
                      >
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(payment.paid_at ?? payment.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          <span className={voided ? "line-through" : undefined}>
                            {formatNok(payment.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {methodLabels[payment.method] ?? payment.method}
                          {payment.vipps_payment_method ? (
                            <span className="block text-xs text-muted-foreground">
                              {payment.vipps_payment_method}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-56">
                          {payment.payer_name ? (
                            <span className="block">{payment.payer_name}</span>
                          ) : null}
                          {payment.payer_phone ? (
                            <span className="block text-xs text-muted-foreground">
                              {payment.payer_phone}
                            </span>
                          ) : null}
                          {payment.payer_email ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {payment.payer_email}
                            </span>
                          ) : null}
                          {!payment.payer_name &&
                          !payment.payer_phone &&
                          !payment.payer_email ? (
                            <span className="text-sm text-muted-foreground">
                              -
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-64">
                          {rows.length > 0 ? (
                            rows.map((allocation, index) => (
                              <span
                                key={`${payment.id}-${index}`}
                                className="block text-sm"
                              >
                                <Link
                                  href={`${basePath}/elever/${allocation.student_id}`}
                                  className="underline-offset-2 hover:underline"
                                >
                                  {allocation.students
                                    ? studentDisplayName(allocation.students) ||
                                      "Ukjent"
                                    : "Ukjent"}
                                </Link>
                                <span className="text-muted-foreground">
                                  {" "}
                                  {formatNok(allocation.amount)}
                                </span>
                              </span>
                            ))
                          ) : apps.length > 0 ? (
                            <>
                              {apps.map((application, index) => (
                                <span
                                  key={`${payment.id}-app-${index}`}
                                  className="block text-sm"
                                >
                                  {studentDisplayName(application) || "Ukjent"}
                                </span>
                              ))}
                              <span className="block text-xs text-muted-foreground">
                                Påmelding ikke godkjent ennå
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Ikke fordelt
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{payment.school_years?.label ?? "-"}</TableCell>
                        <TableCell>
                          {voided ? (
                            <Badge variant="destructive">Annullert</Badge>
                          ) : (
                            <Badge
                              variant={
                                payment.status === "fanget"
                                  ? "default"
                                  : payment.status === "avbrutt" ||
                                      payment.status === "feilet"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {statusLabels[payment.status] ?? payment.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-64">
                          <span
                            className="block truncate font-mono text-xs text-muted-foreground"
                            title={payment.reference}
                          >
                            {payment.reference}
                          </span>
                          {log.length > 0 ? (
                            <span className="block text-xs text-muted-foreground">
                              {log[0].name} · {formatDateTime(log[0].occurred_at)}
                              {log.length > 1 ? ` (+${log.length - 1})` : ""}
                            </span>
                          ) : payment.last_synced_at ? (
                            <span className="block text-xs text-muted-foreground">
                              Sist synk {formatDateTime(payment.last_synced_at)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <AllocatePaymentDialog
                              paymentId={payment.id}
                              paymentAmount={payment.amount}
                              students={students}
                              existing={rows.map((allocation) => ({
                                studentId: allocation.student_id,
                                amount: allocation.amount,
                              }))}
                            />
                            {payment.method === "vipps" &&
                            payment.status === "fanget" &&
                            !voided ? (
                              <RefundPaymentDialog
                                paymentId={payment.id}
                                amount={payment.amount}
                                payerName={payment.payer_name}
                                childNames={rows
                                  .map((allocation) =>
                                    allocation.students
                                      ? studentDisplayName(allocation.students)
                                      : "",
                                  )
                                  .filter(Boolean)}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Viser de siste {PAGE_SIZE} betalingene.{" "}
        <Link
          href={`${basePath}/betaling/dobbeltforinger`}
          className="underline underline-offset-2"
        >
          Se mistenkte dobbeltføringer
        </Link>
      </p>
    </div>
  );
}
