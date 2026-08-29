import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPayment,
  getPaymentEvents,
  capturePayment,
  type VippsPaymentState,
} from "@/lib/vipps";
import { mapVippsPaymentState } from "@/lib/payment-integrity";
import {
  sendPaymentReceiptEmail,
  sendStudentApplicationEmail,
} from "@/lib/email";
import { getSiteSettings } from "@/lib/data";
import { allocatePayment } from "@/lib/payment-ledger";
import {
  guardianEmails,
  guardianName,
  studentDisplayName,
} from "@/lib/student-name";
import { emailNotifications } from "@/flags";

export function mapVippsState(
  state: VippsPaymentState,
  capturedAmount: number,
  refundedAmount: number,
): string {
  return mapVippsPaymentState(state, capturedAmount, refundedAmount);
}

type NamedPersonRow = {
  child_first_name: string | null;
  child_last_name: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
  child_email: string | null;
  mother_email: string | null;
  father_email: string | null;
};

type PaymentWithStudent = {
  id: string;
  status: string;
  amount: number;
  school_years: { label: string } | null;
  enrollments: { classes: { name_no: string | null } | null } | null;
  students: NamedPersonRow | null;
  student_applications: NamedPersonRow[] | null;
};

async function recordEvents(
  admin: ReturnType<typeof createAdminClient>,
  reference: string,
  paymentId: string | null,
) {
  try {
    const events = await getPaymentEvents(reference);
    if (events.length === 0) return;

    await admin.from("payment_events").upsert(
      events.map((event) => ({
        payment_id: paymentId,
        reference,
        name: event.name,
        amount: event.amount,
        success: event.success,
        psp_reference: event.pspReference,
        idempotency_key: event.idempotencyKey,
        occurred_at: event.timestamp,
      })),
      { onConflict: "reference,name,occurred_at", ignoreDuplicates: true },
    );
  } catch (error) {
    console.error("Vipps event log sync failed", { reference, error });
  }
}

async function reconcileRefunds(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
  reference: string,
  vippsRefundedAmount: number,
): Promise<void> {
  try {
    const { data } = await admin
      .from("refunds")
      .select("amount")
      .eq("payment_id", paymentId);
    const localTotal = (data ?? []).reduce(
      (sum, row) => sum + (row.amount ?? 0),
      0,
    );
    const missing = vippsRefundedAmount - localTotal;
    if (missing <= 0) return;

    const { data: allocations } = await admin
      .from("payment_allocations")
      .select("student_id, school_year_id")
      .eq("payment_id", paymentId);
    const single = (allocations ?? []).length === 1 ? allocations![0] : null;

    await admin.from("refunds").insert({
      payment_id: paymentId,
      student_id: single?.student_id ?? null,
      school_year_id: single?.school_year_id ?? null,
      amount: missing,
      method: "vipps",
      reason: "Synkronisert fra Vipps",
      refunded_by: "vipps-sync",
      idempotency_key: `sync-${reference}-${vippsRefundedAmount}`,
    });
  } catch (error) {
    console.error("Refund reconciliation failed", { reference, error });
  }
}

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
      console.error("Auto-capture failed", { reference, error });
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
      "id, status, amount, school_years(label), enrollments(classes(name_no)), students(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_email, mother_email, father_email), student_applications(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_email, mother_email, father_email)",
    )
    .eq("reference", reference)
    .maybeSingle();
  const payment = existing as unknown as PaymentWithStudent | null;
  const previousStatus = payment?.status;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    vipps_state: result.state,
    authorized_amount: result.authorizedAmount,
    captured_amount: capturedAmount,
    last_synced_at: now,
  };
  if (result.payerName) update.payer_name = result.payerName;
  if (result.payerEmail) update.payer_email = result.payerEmail;
  if (result.payerPhone) update.payer_phone = result.payerPhone;
  if (result.paymentMethodType) {
    update.vipps_payment_method = result.paymentMethodType;
  }
  if (result.pspReference) update.psp_reference = result.pspReference;
  if (
    capturedAmount > 0 &&
    previousStatus !== "fanget" &&
    previousStatus !== "refundert"
  ) {
    update.captured_at = now;
    update.paid_at = now;
  }

  const { error: updateError } = await admin
    .from("payments")
    .update(update as never)
    .eq("reference", reference);
  if (updateError) throw new Error(updateError.message);

  await recordEvents(admin, reference, payment?.id ?? null);

  if (payment?.id && result.refundedAmount > 0) {
    await reconcileRefunds(admin, payment.id, reference, result.refundedAmount);
  }

  const justCaptured = status === "fanget" && previousStatus !== "fanget";

  if (payment?.id) {
    try {
      await allocatePayment(admin, payment.id);
    } catch (error) {
      console.error("Payment allocation failed", { reference, error });
    }
  }

  if (justCaptured && (await emailNotifications())) {
    const schoolYear = payment?.school_years?.label ?? null;
    const amount = capturedAmount || payment?.amount || 0;

    if (payment?.students) {
      const recipients = guardianEmails(payment.students);
      if (recipients.length > 0) {
        await sendPaymentReceiptEmail({
          to: recipients,
          guardianName: guardianName(payment.students) ?? "",
          childName: studentDisplayName(payment.students),
          amount,
          schoolYear,
          className: payment?.enrollments?.classes?.name_no ?? null,
        });
      }
    } else if (payment?.student_applications?.length) {
      const apps = payment.student_applications;
      const recipients = [...new Set(apps.flatMap((app) => guardianEmails(app)))];
      const childName = apps
        .map((app) => studentDisplayName(app))
        .filter(Boolean)
        .join(", ");

      if (recipients.length > 0) {
        await sendPaymentReceiptEmail({
          to: recipients,
          guardianName: guardianName(apps[0]) ?? "",
          childName,
          amount,
          schoolYear,
          className: null,
        });
      }

      const settings = await getSiteSettings();
      await sendStudentApplicationEmail({
        to: settings?.enroll_email ?? "opptak@islamskole.no",
        childName,
        rows: [
          ["Barn", childName],
          ["Foresatt", guardianName(apps[0]) ?? "-"],
          ["Antall barn", String(apps.length)],
          ["Skoleår", schoolYear ?? "-"],
          ["Beløp betalt", `${(amount / 100).toLocaleString("nb-NO")} kr`],
        ],
      });
    }
  }

  return status;
}
