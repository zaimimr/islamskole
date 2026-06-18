import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, capturePayment, type VippsPaymentState } from "@/lib/vipps";
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
  school_years: { label: string } | null;
  enrollments: { classes: { name_no: string | null } | null } | null;
  students: {
    full_name: string | null;
    guardian_name: string | null;
    email: string | null;
    guardian2_email: string | null;
    mother_email: string | null;
    father_email: string | null;
  } | null;
};

export async function syncPaymentByReference(
  reference: string,
): Promise<string | null> {
  const result = await getPayment(reference);

  let capturedAmount = result.capturedAmount;
  const autoCapture = process.env.VIPPS_AUTO_CAPTURE !== "false";
  if (
    autoCapture &&
    result.state === "AUTHORIZED" &&
    capturedAmount === 0 &&
    result.authorizedAmount > 0
  ) {
    try {
      await capturePayment(reference, result.authorizedAmount);
      capturedAmount = result.authorizedAmount;
    } catch (error) {
      console.error("Auto-capture failed", error);
    }
  }

  const status = mapVippsState(
    result.state,
    capturedAmount,
    result.refundedAmount,
  );

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("payments")
    .select(
      "status, amount, school_years(label), enrollments(classes(name_no)), students(full_name, guardian_name, email, guardian2_email, mother_email, father_email)",
    )
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

  const receiptRecipients = [
    ...new Set(
      [
        payment?.students?.email,
        payment?.students?.mother_email,
        payment?.students?.father_email,
        payment?.students?.guardian2_email,
      ]
        .filter((e): e is string => Boolean(e && e.trim()))
        .map((e) => e.trim().toLowerCase()),
    ),
  ];
  if (
    status === "fanget" &&
    previousStatus !== "fanget" &&
    receiptRecipients.length > 0 &&
    (await emailNotifications())
  ) {
    await sendPaymentReceiptEmail({
      to: receiptRecipients,
      guardianName: payment?.students?.guardian_name ?? "",
      childName: payment?.students?.full_name ?? "",
      amount: payment?.amount ?? 0,
      schoolYear: payment?.school_years?.label ?? null,
      className: payment?.enrollments?.classes?.name_no ?? null,
    });
  }

  return status;
}
