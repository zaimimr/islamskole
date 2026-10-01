import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth";
import { osloToday } from "@/lib/dates";

const PAGE_SIZE = 1000;

const statusLabels: Record<string, string> = {
  ny: "Til behandling",
  matchet: "Koblet til betaling",
  sadaqa: "Sadaqa",
  familie: "Skolepenger",
  ignorert: "Ignorert",
};

const columns = [
  { key: "date", header: "Dato" },
  { key: "source", header: "Kilde" },
  { key: "account", header: "Konto" },
  { key: "amount", header: "Beløp (kr)" },
  { key: "currency", header: "Valuta" },
  { key: "counterparty", header: "Motpart" },
  { key: "phone", header: "Telefon" },
  { key: "message", header: "Melding" },
  { key: "status", header: "Status" },
  { key: "family", header: "Familie" },
  { key: "giftId", header: "Sadaqa-gave-ID" },
  { key: "paymentId", header: "Betaling-ID" },
  { key: "paymentReference", header: "Betalingsreferanse" },
  { key: "reference", header: "Ordre-ID" },
  { key: "psp", header: "Transaksjons-ID" },
  { key: "externalId", header: "Ekstern ID" },
  { key: "note", header: "Notat" },
  { key: "mappedBy", header: "Behandlet av" },
  { key: "mappedAt", header: "Behandlet" },
] as const;

type Row = {
  id: string;
  source: string;
  account: string;
  external_id: string;
  booked_on: string;
  amount: number;
  currency: string;
  counterparty_name: string | null;
  counterparty_phone: string | null;
  message: string | null;
  reference: string | null;
  psp_reference: string | null;
  status: string;
  matched_payment_id: string | null;
  sadaqa_gift_id: string | null;
  family_id: string | null;
  mapped_by: string | null;
  mapped_at: string | null;
  note: string | null;
};

function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d\s,.]+$/.test(text)) text = `'${text}`;
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  if (!(await getIsAdmin())) {
    return new Response("Ikke autorisert", { status: 403 });
  }
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const source = params.get("kilde");
  const account = (params.get("konto") ?? "").replace(/\D/g, "");
  const from = params.get("fra");
  const to = params.get("til");

  const supabase = await createClient();
  const rows: Row[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    let query = supabase
      .from("external_transactions")
      .select(
        "id, source, account, external_id, booked_on, amount, currency, counterparty_name, counterparty_phone, message, reference, psp_reference, status, matched_payment_id, sadaqa_gift_id, family_id, mapped_by, mapped_at, note",
      )
      .order("booked_on", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (status && status in statusLabels) query = query.eq("status", status);
    if (source === "vipps" || source === "dnb") query = query.eq("source", source);
    if (account) query = query.eq("account", account);
    if (isDate(from)) query = query.gte("booked_on", from);
    if (isDate(to)) query = query.lte("booked_on", to);
    const { data, error } = await query;
    if (error) return new Response("Eksporten feilet", { status: 500 });
    rows.push(...((data as Row[] | null) ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const familyIds = [...new Set(rows.flatMap((row) => (row.family_id ? [row.family_id] : [])))];
  const paymentIds = [
    ...new Set(rows.flatMap((row) => (row.matched_payment_id ? [row.matched_payment_id] : []))),
  ];
  const familyNames = new Map<string, string>();
  const paymentReferences = new Map<string, string>();
  for (let index = 0; index < Math.max(familyIds.length, paymentIds.length); index += 200) {
    const [families, payments] = await Promise.all([
      familyIds.length > index
        ? supabase.from("families").select("id, display_name").in("id", familyIds.slice(index, index + 200))
        : Promise.resolve({ data: [], error: null }),
      paymentIds.length > index
        ? supabase.from("payments").select("id, reference").in("id", paymentIds.slice(index, index + 200))
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (families.error || payments.error) return new Response("Eksporten feilet", { status: 500 });
    for (const family of (families.data ?? []) as { id: string; display_name: string | null }[]) {
      familyNames.set(family.id, family.display_name ?? "");
    }
    for (const payment of (payments.data ?? []) as { id: string; reference: string }[]) {
      paymentReferences.set(payment.id, payment.reference);
    }
  }

  const lines = [columns.map((column) => escapeCsvField(column.header)).join(";")];
  for (const row of rows) {
    const record: Record<(typeof columns)[number]["key"], string> = {
      date: row.booked_on,
      source: row.source === "vipps" ? "Vipps" : "DNB",
      account: row.account,
      amount: (row.amount / 100).toFixed(2).replace(".", ","),
      currency: row.currency,
      counterparty: row.counterparty_name ?? "",
      phone: row.counterparty_phone ?? "",
      message: row.message ?? "",
      status: statusLabels[row.status] ?? row.status,
      family: row.family_id ? (familyNames.get(row.family_id) ?? "") : "",
      giftId: row.sadaqa_gift_id ?? "",
      paymentId: row.matched_payment_id ?? "",
      paymentReference: row.matched_payment_id
        ? (paymentReferences.get(row.matched_payment_id) ?? "")
        : "",
      reference: row.reference ?? "",
      psp: row.psp_reference ?? "",
      externalId: row.external_id,
      note: row.note ?? "",
      mappedBy: row.mapped_by ?? "",
      mappedAt: row.mapped_at ? osloToday(new Date(row.mapped_at)) : "",
    };
    lines.push(columns.map((column) => escapeCsvField(record[column.key])).join(";"));
  }

  const period = [from, to].filter(isDate).join("_til_");
  return new Response(`﻿${lines.join("\r\n")}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avstemming${period ? `_${period}` : ""}.csv"`,
    },
  });
}
