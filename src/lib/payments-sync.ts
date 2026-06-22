import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, capturePayment, type VippsPaymentState } from "@/lib/vipps";
import {
  sendPaymentReceiptEmail,
  sendStudentApplicationEmail,
} from "@/lib/email";
import { getSiteSettings } from "@/lib/data";
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
  status: string;
  amount: number;
  school_years: { label: string } | null;
  enrollments: { classes: { name_no: string | null } | null } | null;
  students: NamedPersonRow | null;
  student_applications: NamedPersonRow[] | null;
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
      "status, amount, school_years(label), enrollments(classes(name_no)), students(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_email, mother_email, father_email), student_applications(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_email, mother_email, father_email)",
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

  const justCaptured = status === "fanget" && previousStatus !== "fanget";

  if (justCaptured && (await emailNotifications())) {
    const schoolYear = payment?.school_years?.label ?? null;
    const amount = payment?.amount ?? 0;

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
