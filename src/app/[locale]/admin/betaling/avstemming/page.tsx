import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { Pagination } from "@/components/admin/pagination";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatNok } from "@/lib/money";
import { formatOsloDateTime } from "@/lib/dates";
import { studentDisplayName } from "@/lib/student-name";
import { vippsAccountLabels } from "@/lib/reconciliation-match";
import { vippsReportMsns } from "@/lib/vipps-report";
import { cn } from "@/lib/utils";
import { FinanceLoadError } from "../load-error";
import {
  ImportPanel,
  TransactionInbox,
  type InboxTransaction,
  type PickerFamily,
} from "./reconciliation-client";

export const metadata: Metadata = { title: "Avstemming" };

const PAGE_SIZE = 25;

const statusTabs = [
  { value: "ny", label: "Til behandling" },
  { value: "matchet", label: "Koblet" },
  { value: "sadaqa", label: "Sadaqa" },
  { value: "familie", label: "Skolepenger" },
  { value: "ignorert", label: "Ignorert" },
  { value: "alle", label: "Alle" },
];

type TransactionRow = {
  id: string;
  source: string;
  account: string;
  external_id: string;
  booked_on: string;
  amount: number;
  counterparty_name: string | null;
  counterparty_phone: string | null;
  message: string | null;
  reference: string | null;
  psp_reference: string | null;
  status: string;
  suggested_status: string | null;
  suggestion_reason: string | null;
  matched_payment_id: string | null;
  sadaqa_gift_id: string | null;
  family_id: string | null;
  mapped_by: string | null;
  mapped_at: string | null;
  note: string | null;
};

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function accountLabel(source: string, account: string) {
  if (source === "vipps") {
    return vippsAccountLabels[account]
      ? `${vippsAccountLabels[account]} #${account}`
      : `Vipps #${account}`;
  }
  return `DNB ${account.replace(/^(\d{4})(\d{2})(\d{5})$/, "$1.$2.$3")}`;
}

export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const basePath = adminBasePath(locale);
  const pageHref = `${basePath}/betaling/avstemming`;
  const supabase = await createClient();

  const status = statusTabs.some((tab) => tab.value === one(sp.status)) ? one(sp.status) : "ny";
  const source = one(sp.kilde) === "vipps" || one(sp.kilde) === "dnb" ? one(sp.kilde) : "";
  const account = one(sp.konto).replace(/\D/g, "");
  const from = isDate(one(sp.fra)) ? one(sp.fra) : "";
  const to = isDate(one(sp.til)) ? one(sp.til) : "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  let listQuery = supabase
    .from("external_transactions")
    .select(
      "id, source, account, external_id, booked_on, amount, counterparty_name, counterparty_phone, message, reference, psp_reference, status, suggested_status, suggestion_reason, matched_payment_id, sadaqa_gift_id, family_id, mapped_by, mapped_at, note",
      { count: "exact" },
    )
    .order("booked_on", { ascending: false })
    .order("imported_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "alle") listQuery = listQuery.eq("status", status);
  if (source) listQuery = listQuery.eq("source", source);
  if (account) listQuery = listQuery.eq("account", account);
  if (from) listQuery = listQuery.gte("booked_on", from);
  if (to) listQuery = listQuery.lte("booked_on", to);

  const [listResult, openResult, accountResult, batchResult, yearResult] = await Promise.all([
    listQuery,
    supabase
      .from("external_transactions")
      .select("amount")
      .eq("status", "ny")
      .limit(5000),
    supabase.from("import_batches").select("source, account").not("account", "is", null).limit(500),
    supabase
      .from("import_batches")
      .select("id, source, kind, account, file_name, inserted_count, duplicate_count, matched_count, errors, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("school_years").select("id, label, is_active").eq("is_active", true).maybeSingle(),
  ]);
  if (listResult.error || openResult.error || batchResult.error) {
    return (
      <FinanceLoadError title="Avstemmingen kunne ikke lastes" retryHref={pageHref} />
    );
  }

  const activeYear = yearResult.data ?? null;
  const [balanceResult, studentResult, familyResult] = await Promise.all([
    activeYear
      ? supabase
          .from("student_balances")
          .select("student_id, remaining")
          .eq("school_year_id", activeYear.id)
      : Promise.resolve({ data: [] as { student_id: string | null; remaining: number | null }[] }),
    supabase.from("students").select("id, family_id, child_first_name, child_last_name"),
    supabase.from("families").select("id, display_name"),
  ]);

  const rows = (listResult.data as TransactionRow[] | null) ?? [];
  const familyNames = new Map(
    (familyResult.data ?? []).map((family) => [family.id, family.display_name || "Familie uten navn"]),
  );
  const students = new Map((studentResult.data ?? []).map((student) => [student.id, student]));

  const paymentIds = rows.flatMap((row) => (row.matched_payment_id ? [row.matched_payment_id] : []));
  const { data: paymentData } = paymentIds.length
    ? await supabase
        .from("payments")
        .select("id, reference, student_id, payer_name, description")
        .in("id", paymentIds)
    : { data: [] };
  const payments = new Map((paymentData ?? []).map((payment) => [payment.id, payment]));

  const transactions: InboxTransaction[] = rows.map((row) => {
    let linkLabel: string | null = null;
    let linkHref: string | null = null;
    if (row.status === "sadaqa") {
      linkLabel = `Sadaqa-gave${row.family_id ? ` fra ${familyNames.get(row.family_id) ?? "familie"}` : ""}`;
      linkHref = `${basePath}/betaling/sadaqa`;
    } else if (row.matched_payment_id) {
      const payment = payments.get(row.matched_payment_id);
      const student = payment?.student_id ? students.get(payment.student_id) : null;
      const familyId = row.family_id ?? student?.family_id ?? null;
      linkLabel =
        row.status === "familie" && familyId
          ? `Skolepenger for ${familyNames.get(familyId) ?? "familien"}`
          : `Betaling ${payment?.reference ?? ""}${student ? ` for ${studentDisplayName(student)}` : ""}`;
      linkHref = familyId
        ? `${basePath}/familier/${familyId}`
        : `${basePath}/betaling/logg?q=${encodeURIComponent(payment?.reference ?? "")}`;
    }
    return {
      id: row.id,
      source: row.source === "dnb" ? "dnb" : "vipps",
      account: row.account,
      accountLabel: accountLabel(row.source, row.account),
      bookedOn: row.booked_on,
      amount: row.amount,
      counterpartyName: row.counterparty_name,
      counterpartyPhone: row.counterparty_phone,
      message: row.message,
      reference: row.reference,
      pspReference: row.psp_reference,
      externalId: row.external_id,
      status: row.status,
      suggestedStatus: row.suggested_status,
      suggestionReason: row.suggestion_reason,
      note: row.note,
      mappedBy: row.mapped_by,
      mappedAt: row.mapped_at,
      linkLabel,
      linkHref,
    };
  });

  const familyGroups = new Map<string, PickerFamily>();
  for (const balance of balanceResult.data ?? []) {
    const student = balance.student_id ? students.get(balance.student_id) : null;
    if (!student) continue;
    const key = student.family_id ?? student.id;
    const group = familyGroups.get(key) ?? {
      key,
      familyId: student.family_id,
      name: student.family_id
        ? (familyNames.get(student.family_id) ?? `Familien ${student.child_last_name ?? ""}`.trim())
        : studentDisplayName(student) || "Ukjent barn",
      children: [],
    };
    group.children.push({
      id: student.id,
      name: studentDisplayName(student) || "Ukjent barn",
      remainingOre: balance.remaining ?? 0,
    });
    familyGroups.set(key, group);
  }
  const pickerFamilies = [...familyGroups.values()]
    .map((family) => ({
      ...family,
      children: family.children.sort((a, b) => a.name.localeCompare(b.name, "nb-NO")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));
  const giftFamilies = [...familyNames.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));

  const msns = vippsReportMsns();
  const vippsAccounts = msns.map((msn) => ({ value: msn, label: accountLabel("vipps", msn) }));
  const knownAccounts = new Map<string, { source: string; account: string }>();
  for (const msn of msns) knownAccounts.set(`vipps:${msn}`, { source: "vipps", account: msn });
  for (const row of accountResult.data ?? []) {
    if (row.account) knownAccounts.set(`${row.source}:${row.account}`, { source: row.source, account: row.account });
  }
  const dnbAccount =
    [...knownAccounts.values()].find((entry) => entry.source === "dnb")?.account ?? "";

  const openRows = openResult.data ?? [];
  const openIncoming = openRows.filter((row) => row.amount > 0);
  const openTotal = openIncoming.reduce((sum, row) => sum + row.amount, 0);
  const total = listResult.count ?? 0;

  const filterParams = (next: Record<string, string>) => {
    const query = new URLSearchParams();
    const merged = { status, kilde: source, konto: account, fra: from, til: to, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === "status" && value === "ny")) query.set(key, value);
    }
    const text = query.toString();
    return text ? `${pageHref}?${text}` : pageHref;
  };
  const exportQuery = new URLSearchParams(
    Object.entries({ status: status === "alle" ? "" : status, kilde: source, konto: account, fra: from, til: to }).filter(
      ([, value]) => value,
    ),
  ).toString();

  return (
    <div className="grid gap-6 lg:gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            Avstemming
          </h1>
          <p className="mt-1 max-w-3xl text-admin-muted">
            Innbetalinger fra Vipps og DNB som ikke er gjort gjennom systemet.
            Før dem som sadaqa, som skolepenger for en familie, eller koble dem
            til en betaling som allerede finnes.
          </p>
        </div>
        <a
          href={`/api/export/avstemming${exportQuery ? `?${exportQuery}` : ""}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold ring-1 ring-[#DCD7CC] outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Download aria-hidden="true" className="size-4" />
          Eksporter til regnskap
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid min-w-0 gap-4">
          <p className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[#E3DED3] sm:px-5">
            <span className="font-bold">{openIncoming.length} innbetalinger</span> på{" "}
            <span className="font-bold tabular-nums">{formatNok(openTotal)}</span> venter på
            behandling
            {openRows.length > openIncoming.length
              ? `, pluss ${openRows.length - openIncoming.length} utbetalinger`
              : ""}
            .
          </p>

          <nav aria-label="Status" className="relative -mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-1">
              {statusTabs.map((tab) => (
                <li key={tab.value}>
                  <Link
                    href={filterParams({ status: tab.value })}
                    aria-current={tab.value === status ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      tab.value === status
                        ? "bg-[#DCEDDD] text-[#216A2B]"
                        : "text-admin-muted hover:bg-[#F2F1EB]",
                    )}
                  >
                    {tab.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <form
            method="get"
            action={pageHref}
            className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_1fr_auto] xl:items-end"
          >
            {status !== "ny" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="grid gap-1.5">
              <Label htmlFor="filter-source">Kilde</Label>
              <SelectField
                id="filter-source"
                name="kilde"
                defaultValue={source}
                options={[
                  { value: "", label: "Alle" },
                  { value: "vipps", label: "Vipps" },
                  { value: "dnb", label: "DNB" },
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-account">Konto</Label>
              <SelectField
                id="filter-account"
                name="konto"
                defaultValue={account}
                options={[
                  { value: "", label: "Alle kontoer" },
                  ...[...knownAccounts.values()].map((entry) => ({
                    value: entry.account,
                    label: accountLabel(entry.source, entry.account),
                  })),
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-from">Fra</Label>
              <Input id="filter-from" type="date" name="fra" defaultValue={from} className="h-11 rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-to">Til</Label>
              <Input id="filter-to" type="date" name="til" defaultValue={to} className="h-11 rounded-xl" />
            </div>
            <Button type="submit" variant="outline" className="min-h-11 rounded-xl px-4 font-bold">
              Filtrer
            </Button>
          </form>

          <TransactionInbox
            transactions={transactions}
            families={pickerFamilies}
            giftFamilies={giftFamilies}
            schoolYearId={activeYear?.id ?? null}
            schoolYearLabel={activeYear?.label ?? null}
          />

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath={pageHref}
            searchParams={sp}
          />
        </div>

        <aside className="grid gap-4">
          <ImportPanel vippsAccounts={vippsAccounts} dnbAccount={dnbAccount} />

          <section
            aria-labelledby="import-history"
            className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5"
          >
            <h2 id="import-history" className="font-heading text-lg font-bold">
              Siste importer
            </h2>
            {(batchResult.data ?? []).length === 0 ? (
              <p className="text-sm text-admin-muted">Ingenting importert ennå.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {(batchResult.data ?? []).map((batch) => {
                  const errors = Array.isArray(batch.errors) ? batch.errors.length : 0;
                  return (
                    <li key={batch.id} className="grid gap-0.5 border-t border-[#ECE8DF] pt-2 first:border-t-0 first:pt-0">
                      <span className="font-bold">
                        {batch.kind === "api" ? "Hentet fra Vipps" : batch.file_name ?? "Fil"}
                        {batch.account ? ` · ${accountLabel(batch.source, batch.account)}` : ""}
                      </span>
                      <span className="text-admin-muted">
                        {formatOsloDateTime(batch.created_at)}
                        {batch.created_by ? ` · ${batch.created_by}` : ""}
                      </span>
                      <span className="text-admin-muted">
                        {batch.inserted_count} nye · {batch.duplicate_count} fantes fra før ·{" "}
                        {batch.matched_count} koblet
                        {errors > 0 ? ` · ${errors} feil` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
