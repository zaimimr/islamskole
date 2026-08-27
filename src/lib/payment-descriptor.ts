import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { VippsOrderLine } from "@/lib/vipps";
import { guardianName, studentDisplayName } from "@/lib/student-name";

type Client = SupabaseClient<Database>;

export type PaymentDescriptor = {
  reference: string;
  description: string;
  metadata: Record<string, string>;
  orderLines: VippsOrderLine[];
  childNames: string[];
  guardian: string | null;
};

function slugify(value: string, max: number): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .replace(/å/gi, "a")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized.slice(0, max).replace(/-+$/g, "");
}

function yearToken(label: string | null): string {
  if (!label) return "skole";
  const digits = label.match(/\d{4}/g);
  if (digits && digits.length >= 2) {
    return `${digits[0].slice(2)}${digits[1].slice(2)}`;
  }
  return slugify(label, 8) || "skole";
}

export function buildReference(
  yearLabel: string | null,
  familyName: string | null,
  childCount: number,
): string {
  const parts = ["isk", yearToken(yearLabel)];
  const family = familyName ? slugify(familyName, 18) : "";
  if (family) parts.push(family);
  if (childCount > 1) parts.push(`${childCount}barn`);
  parts.push(randomUUID().replace(/-/g, "").slice(0, 8));

  const reference = parts.filter(Boolean).join("-").slice(0, 64);
  return reference.length >= 8 ? reference : `isk-${randomUUID()}`;
}

type NameRow = {
  child_first_name: string | null;
  child_last_name: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
};

function describe(rows: NameRow[], yearLabel: string | null, amount: number) {
  const childNames = rows.map((row) => studentDisplayName(row)).filter(Boolean);
  const guardian = rows.length > 0 ? guardianName(rows[0]) : null;
  const familyName =
    rows.find((row) => row.child_last_name)?.child_last_name ?? null;

  const yearPart = yearLabel ? ` ${yearLabel}` : "";
  const namePart = childNames.length > 0 ? ` - ${childNames.join(", ")}` : "";
  const description = `Skolepenger${yearPart}${namePart}`;

  const share =
    childNames.length > 0 ? Math.floor(amount / childNames.length) : amount;
  const orderLines: VippsOrderLine[] = childNames.map((name, index) => ({
    name: `${name}${yearPart}`,
    id: `barn-${index + 1}`,
    totalAmount:
      index === 0 ? amount - share * (childNames.length - 1) : share,
  }));

  const metadata: Record<string, string> = {};
  if (childNames.length > 0) metadata.barn = childNames.join(", ");
  if (guardian) metadata.foresatt = guardian;
  if (yearLabel) metadata.skolear = yearLabel;

  return { description, metadata, orderLines, childNames, guardian, familyName };
}

export async function buildPaymentDescriptor(
  client: Client,
  paymentId: string,
): Promise<PaymentDescriptor> {
  const { data } = await client
    .from("payments")
    .select(
      "amount, school_years(label), students(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name), student_applications(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name)",
    )
    .eq("id", paymentId)
    .maybeSingle();

  const amount = data?.amount ?? 0;
  const yearLabel = data?.school_years?.label ?? null;

  const rows: NameRow[] = data?.students
    ? [data.students]
    : (data?.student_applications ?? []);

  const built = describe(rows, yearLabel, amount);

  return {
    reference: buildReference(
      yearLabel,
      built.familyName,
      built.childNames.length,
    ),
    description: built.description,
    metadata: { ...built.metadata, betaling: paymentId },
    orderLines: built.orderLines,
    childNames: built.childNames,
    guardian: built.guardian,
  };
}

export function describeForStudent(
  row: NameRow,
  yearLabel: string | null,
  amount: number,
  paymentId?: string,
): Omit<PaymentDescriptor, "reference"> & { familyName: string | null } {
  const built = describe([row], yearLabel, amount);
  const metadata = { ...built.metadata };
  if (paymentId) metadata.betaling = paymentId;
  return {
    description: built.description,
    metadata,
    orderLines: built.orderLines,
    childNames: built.childNames,
    guardian: built.guardian,
    familyName: built.familyName,
  };
}
