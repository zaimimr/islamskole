import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  allocatePayment,
  ensureStudentFee,
  fetchBalance,
} from "@/lib/payment-ledger";
import { rebuildPendingInstallmentsForStudent } from "@/lib/payment-plans";
import { toUserError } from "@/lib/action-errors";
import { capAtLimit, formatNok } from "@/lib/money";

type Client = SupabaseClient<Database>;

export const SADAQA_SUPPORT_PREFIX = "Sadaqa-støtte";

export function sadaqaSupportNote(description: string | null) {
  return (description ?? "")
    .replace(/^Sadaqa(?:-støtte)?(?:\s+-\s+)?/, "")
    .trim();
}

export async function createSadaqaCoverage(
  client: Client,
  input: {
    studentId: string;
    schoolYearId: string;
    amount: number;
    note: string | null;
  },
): Promise<
  | { ok: true; paymentId: string; amount: number; remaining: number }
  | { ok: false; error: string }
> {
  await ensureStudentFee(client, input.studentId, input.schoolYearId);
  const balance = await fetchBalance(
    client,
    input.studentId,
    input.schoolYearId,
  );
  const capped = capAtLimit(input.amount, balance.remaining);
  if (!capped.ok) {
    return {
      ok: false,
      error:
        balance.remaining <= 0
          ? "Barnet har ingenting igjen å betale."
          : `Sadaqa-støtte kan ikke være mer enn det som gjenstår (${formatNok(balance.remaining)}).`,
    };
  }

  const now = new Date().toISOString();
  const { data: payment, error } = await client
    .from("payments")
    .insert({
      student_id: input.studentId,
      school_year_id: input.schoolYearId,
      reference: `sadaqa-${randomUUID()}`,
      amount: capped.amount,
      status: "fanget",
      method: "sadaqa",
      description: input.note
        ? `${SADAQA_SUPPORT_PREFIX} - ${input.note}`
        : SADAQA_SUPPORT_PREFIX,
      authorized_amount: capped.amount,
      captured_amount: capped.amount,
      paid_at: now,
      captured_at: now,
    })
    .select("id")
    .single();
  if (error || !payment) return { ok: false, error: toUserError(error) };

  await allocatePayment(client, payment.id);
  await rebuildPendingInstallmentsForStudent(
    client,
    input.studentId,
    input.schoolYearId,
  );

  return {
    ok: true,
    paymentId: payment.id,
    amount: capped.amount,
    remaining: Math.max(balance.remaining - capped.amount, 0),
  };
}

export async function getSadaqaTotals(
  client: Client,
  schoolYearId: string,
): Promise<{ supportOre: number; giftsOre: number } | null> {
  const [support, gifts] = await Promise.all([
    client
      .from("payments")
      .select("net_paid_amount")
      .eq("method", "sadaqa")
      .eq("status", "fanget")
      .is("voided_at", null)
      .eq("school_year_id", schoolYearId),
    client
      .from("sadaqa_gifts")
      .select("amount")
      .is("voided_at", null)
      .eq("school_year_id", schoolYearId),
  ]);
  if (support.error || gifts.error) return null;
  return {
    supportOre: (support.data ?? []).reduce(
      (sum, row) => sum + (row.net_paid_amount ?? 0),
      0,
    ),
    giftsOre: (gifts.data ?? []).reduce((sum, row) => sum + row.amount, 0),
  };
}
