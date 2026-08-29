import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { InstallmentBatch } from "@/lib/payment-plans";
import { buildReference } from "@/lib/payment-descriptor";
import { sendInstallmentEmail } from "@/lib/email";
import { studentDisplayName } from "@/lib/student-name";
import { emailNotifications } from "@/flags";

type Client = SupabaseClient<Database>;

export async function familyRecipients(
  client: Client,
  familyId: string,
): Promise<string[]> {
  const { data } = await client
    .from("family_guardians")
    .select("receives_communication, guardians(email)")
    .eq("family_id", familyId);

  const emails = (data ?? [])
    .filter((row) => row.receives_communication !== false)
    .map((row) => (row.guardians as unknown as { email: string | null })?.email)
    .filter((email): email is string => Boolean(email && email.includes("@")));

  return [...new Set(emails)];
}

export async function studentNames(
  client: Client,
  studentIds: string[],
): Promise<Map<string, string>> {
  if (studentIds.length === 0) return new Map();
  const { data } = await client
    .from("students")
    .select("id, child_first_name, child_last_name")
    .in("id", studentIds);

  const names = new Map<string, string>();
  for (const row of data ?? []) {
    names.set(
      row.id,
      studentDisplayName({
        child_first_name: row.child_first_name,
        child_last_name: row.child_last_name,
      }) || "Elev",
    );
  }
  return names;
}

export type BatchSendOutcome = "sent" | "skipped";

export async function sendInstallmentBatch(
  client: Client,
  batch: InstallmentBatch,
  siteUrl: string,
): Promise<BatchSendOutcome> {
  const studentIds = batch.installments.map((row) => row.studentId);
  const { data: balances } = await client
    .from("student_balances")
    .select("student_id, remaining")
    .eq("school_year_id", batch.schoolYearId)
    .in("student_id", studentIds);
  const remainingByStudent = new Map(
    (balances ?? []).map((row) => [row.student_id, row.remaining ?? 0]),
  );

  const collectible = batch.installments.filter(
    (row) => (remainingByStudent.get(row.studentId) ?? 0) > 0,
  );

  const settledIds = batch.installments
    .filter((row) => (remainingByStudent.get(row.studentId) ?? 0) <= 0)
    .map((row) => row.id);
  if (settledIds.length > 0) {
    await client
      .from("installments")
      .update({ status: "betalt" })
      .in("id", settledIds);
  }

  if (collectible.length === 0) return "skipped";

  const names = await studentNames(
    client,
    collectible.map((row) => row.studentId),
  );

  const { data: family } = await client
    .from("families")
    .select("display_name")
    .eq("id", batch.familyId)
    .maybeSingle();
  const { data: year } = await client
    .from("school_years")
    .select("label")
    .eq("id", batch.schoolYearId)
    .maybeSingle();

  const totalAmount = collectible.reduce((sum, row) => sum + row.amount, 0);
  const childNames = collectible.map(
    (row) => names.get(row.studentId) ?? "Elev",
  );
  const reference = buildReference(
    year?.label ?? null,
    family?.display_name ?? null,
    collectible.length,
  );

  const { data: payment, error: paymentError } = await client
    .from("payments")
    .insert({
      school_year_id: batch.schoolYearId,
      reference,
      amount: totalAmount,
      status: "opprettet",
      method: "vipps",
      due_date: batch.dueDate,
      description: `Avdrag ${batch.dueDate} - Skolepenger${year?.label ? ` ${year.label}` : ""} - ${childNames.join(", ")}`,
    })
    .select("id")
    .single();
  if (paymentError) throw new Error(paymentError.message);

  const { error: linkError } = await client
    .from("installments")
    .update({
      status: "sendt",
      payment_id: payment.id,
      sent_at: new Date().toISOString(),
    })
    .in(
      "id",
      collectible.map((row) => row.id),
    );
  if (linkError) throw new Error(linkError.message);

  if (await emailNotifications()) {
    const recipients = await familyRecipients(client, batch.familyId);
    if (recipients.length > 0) {
      await sendInstallmentEmail({
        to: recipients,
        children: collectible.map((row) => ({
          name: names.get(row.studentId) ?? "Elev",
          amount: row.amount,
        })),
        totalAmount,
        schoolYear: year?.label ?? null,
        dueDate: batch.dueDate,
        url: `${siteUrl}/api/vipps/pay/${payment.id}`,
      });
    }
  }

  return "sent";
}
