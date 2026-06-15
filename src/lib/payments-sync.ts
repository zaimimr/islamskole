import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, type VippsPaymentState } from "@/lib/vipps";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { emailNotifications } from "@/flags";

export function mapVippsState(
  state: VippsPaymentState,
  capturedAmount: number,
  refundedAmount: number,
): string {
  if (refundedAmount > 0) return "refundert";
  if (capturedAmount > 0) return "fanget";
  switch (state) {
    case "AUTHORIZED":
      return "autorisert";
    case "ABORTED":
    case "EXPIRED":
    case "TERMINATED":
      return "avbrutt";
    default:
      return "opprettet";
  }
}

type PaymentWithStudent = {
  status: string;
  amount: number;
  term: string | null;
  students: {
    full_name: string | null;
    guardian_name: string | null;
    email: string | null;
  } | null;
};

export async function syncPaymentByReference(
  reference: string,
): Promise<string | null> {
  const result = await getPayment(reference);
  const status = mapVippsState(
    result.state,
    result.capturedAmount,
    result.refundedAmount,
  );

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("payments")
    .select("status, amount, term, students(full_name, guardian_name, email)")
    .eq("reference", reference)
    .maybeSingle();
  const payment = existing as PaymentWithStudent | null;
  const previousStatus = payment?.status;

  const update: Record<string, unknown> = {
    status,
    vipps_state: result.state,
  };
  if (status === "fanget") update.captured_at = new Date().toISOString();

  await admin
    .from("payments")
    .update(update as never)
    .eq("reference", reference);

  if (
    status === "fanget" &&
    previousStatus !== "fanget" &&
    payment?.students?.email &&
    (await emailNotifications())
  ) {
    await sendPaymentReceiptEmail({
      to: payment.students.email,
      guardianName: payment.students.guardian_name ?? "",
      childName: payment.students.full_name ?? "",
      amount: payment.amount,
      term: payment.term,
    });
  }

  return status;
}
