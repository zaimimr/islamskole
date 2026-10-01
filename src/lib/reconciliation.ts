import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { ParsedTransaction, TransactionSource } from "@/lib/bank-statement";
import {
  matchAll,
  suggestStatus,
  type MatchCandidate,
} from "@/lib/reconciliation-match";
import { osloToday } from "@/lib/dates";
import { fetchVippsReport, vippsReportMsns } from "@/lib/vipps-report";

type Client = SupabaseClient<Database>;

export type ImportSummary = {
  batchId: string | null;
  rows: number;
  inserted: number;
  duplicates: number;
  matched: number;
  skipped: number;
  errors: string[];
};

const CHUNK = 200;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function loadCandidates(
  client: Client,
  fromDate: string,
  references: string[],
): Promise<MatchCandidate[]> {
  const columns = "id, reference, psp_reference, captured_amount, refunded_amount, paid_at, payer_phone";
  type Row = {
    id: string;
    reference: string;
    psp_reference: string | null;
    captured_amount: number;
    refunded_amount: number;
    paid_at: string | null;
    payer_phone: string | null;
  };
  const byId = new Map<string, Row>();
  const recent = await client
    .from("payments")
    .select(columns)
    .gt("captured_amount", 0)
    .is("voided_at", null)
    .gte("paid_at", `${shiftDate(fromDate, -3)}T00:00:00Z`)
    .limit(5000);
  if (recent.error) throw new Error(recent.error.message);
  for (const row of (recent.data as Row[] | null) ?? []) byId.set(row.id, row);
  for (const part of chunks(references, 100)) {
    const quoted = part.map((value) => `"${value.replace(/"/g, "")}"`).join(",");
    const exact = await client
      .from("payments")
      .select(columns)
      .gt("captured_amount", 0)
      .is("voided_at", null)
      .or(`reference.in.(${quoted}),psp_reference.in.(${quoted})`);
    if (exact.error) throw new Error(exact.error.message);
    for (const row of (exact.data as Row[] | null) ?? []) byId.set(row.id, row);
  }
  return [...byId.values()].map((row) => ({
    id: row.id,
    reference: row.reference,
    pspReference: row.psp_reference,
    amount: row.captured_amount,
    paidOn: row.paid_at ? osloToday(new Date(row.paid_at)) : null,
    payerPhone: row.payer_phone,
  }));
}

async function takenPaymentIds(client: Client): Promise<string[]> {
  const { data, error } = await client
    .from("external_transactions")
    .select("matched_payment_id")
    .not("matched_payment_id", "is", null)
    .limit(10000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.matched_payment_id as string);
}

export async function autoMatchOpen(client: Client, actor: string | null): Promise<number> {
  const { data, error } = await client
    .from("external_transactions")
    .select("id, source, account, amount, booked_on, counterparty_phone, message, reference, psp_reference")
    .eq("status", "ny")
    .is("note", null)
    .gt("amount", 0)
    .order("booked_on", { ascending: true })
    .limit(3000);
  if (error) throw new Error(error.message);
  const open = (data ?? []).map((row) => ({
    id: row.id,
    source: row.source as TransactionSource,
    account: row.account,
    amount: row.amount,
    bookedOn: row.booked_on,
    counterpartyPhone: row.counterparty_phone,
    message: row.message,
    reference: row.reference,
    pspReference: row.psp_reference,
  }));
  if (open.length === 0) return 0;

  const references = [
    ...new Set(
      open.flatMap((row) => [row.reference, row.pspReference]).filter((value): value is string => Boolean(value)),
    ),
  ];
  const [candidates, taken] = await Promise.all([
    loadCandidates(client, open[0].bookedOn, references),
    takenPaymentIds(client),
  ]);
  const matches = matchAll(open, candidates, taken);
  let matched = 0;
  const now = new Date().toISOString();
  for (const [id, match] of matches) {
    const { data: updated, error: updateError } = await client
      .from("external_transactions")
      .update({
        status: "matchet",
        matched_payment_id: match.paymentId,
        mapped_by: actor ?? "auto",
        mapped_at: now,
        note: `Automatisk: ${match.reason}`,
      })
      .eq("id", id)
      .eq("status", "ny")
      .select("id");
    if (updateError) {
      console.error("Auto-match update failed", { id, updateError });
      continue;
    }
    matched += updated?.length ?? 0;
  }
  return matched;
}

export async function importTransactions(
  client: Client,
  input: {
    source: TransactionSource;
    kind: "api" | "fil";
    account: string | null;
    fileName: string | null;
    transactions: ParsedTransaction[];
    skipped: number;
    errors: string[];
    createdBy: string | null;
    periodFrom?: string | null;
    periodTo?: string | null;
  },
): Promise<ImportSummary> {
  const dates = input.transactions.map((row) => row.bookedOn).sort();
  const { data: batch, error: batchError } = await client
    .from("import_batches")
    .insert({
      source: input.source,
      kind: input.kind,
      account: input.account,
      file_name: input.fileName,
      period_from: input.periodFrom ?? dates[0] ?? null,
      period_to: input.periodTo ?? dates[dates.length - 1] ?? null,
      row_count: input.transactions.length,
      skipped_count: input.skipped,
      errors: input.errors.slice(0, 50) as Json,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (batchError || !batch) throw new Error(batchError?.message ?? "Kunne ikke lagre importen");

  const unique = new Map<string, ParsedTransaction>();
  for (const row of input.transactions) {
    unique.set(`${row.source}|${row.account}|${row.externalId}`, row);
  }

  let inserted = 0;
  for (const part of chunks([...unique.values()])) {
    const { data, error } = await client
      .from("external_transactions")
      .upsert(
        part.map((row) => {
          const suggestion = suggestStatus(row);
          return {
            source: row.source,
            account: row.account,
            external_id: row.externalId,
            booked_on: row.bookedOn,
            booked_at: row.bookedAt,
            amount: row.amount,
            currency: row.currency,
            counterparty_name: row.counterpartyName,
            counterparty_phone: row.counterpartyPhone,
            message: row.message,
            reference: row.reference,
            psp_reference: row.pspReference,
            entry_type: row.entryType,
            raw: row.raw as Json,
            import_batch_id: batch.id,
            suggested_status: suggestion?.status ?? null,
            suggestion_reason: suggestion?.reason ?? null,
          };
        }),
        { onConflict: "source,account,external_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    inserted += data?.length ?? 0;
  }

  const matched = inserted > 0 ? await autoMatchOpen(client, null) : 0;
  const duplicates = input.transactions.length - inserted;
  await client
    .from("import_batches")
    .update({ inserted_count: inserted, duplicate_count: duplicates, matched_count: matched })
    .eq("id", batch.id);

  return {
    batchId: batch.id,
    rows: input.transactions.length,
    inserted,
    duplicates,
    matched,
    skipped: input.skipped,
    errors: input.errors,
  };
}

export type VippsFetchSummary = {
  msn: string;
  summary: ImportSummary | null;
  error: string | null;
};

export async function latestBookedOn(
  client: Client,
  source: TransactionSource,
  account: string,
): Promise<string | null> {
  const { data } = await client
    .from("external_transactions")
    .select("booked_on")
    .eq("source", source)
    .eq("account", account)
    .order("booked_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.booked_on ?? null;
}

export async function importFromVipps(
  client: Client,
  options: { from?: string | null; to?: string | null; createdBy: string | null; lookbackDays?: number },
): Promise<VippsFetchSummary[]> {
  const today = osloToday();
  const to = options.to && options.to < today ? options.to : today;
  const results: VippsFetchSummary[] = [];
  for (const msn of vippsReportMsns()) {
    const latest = options.from ? null : await latestBookedOn(client, "vipps", msn);
    const from =
      options.from ??
      (latest ? shiftDate(latest, -2) : shiftDate(to, -(options.lookbackDays ?? 30)));
    const report = await fetchVippsReport(msn, from < shiftDate(to, -92) ? shiftDate(to, -92) : from, to);
    try {
      const summary = await importTransactions(client, {
        source: "vipps",
        kind: "api",
        account: msn,
        fileName: null,
        transactions: report.transactions,
        skipped: 0,
        errors: report.error ? [report.error] : [],
        createdBy: options.createdBy,
        periodFrom: from,
        periodTo: to,
      });
      results.push({ msn, summary, error: report.error });
    } catch (error) {
      results.push({
        msn,
        summary: null,
        error: error instanceof Error ? error.message : "Lagring feilet",
      });
    }
  }
  return results;
}
