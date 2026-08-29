import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDueInstallmentBatches } from "@/lib/payment-plans";
import {
  familyRecipients,
  sendInstallmentBatch,
  studentNames,
} from "@/lib/installment-billing";
import { sendInstallmentEmail } from "@/lib/email";
import { emailNotifications } from "@/flags";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEAD_DAYS = 14;
const MAX_BATCHES_PER_RUN = 20;
const REMINDER_AFTER_DAYS = 7;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

type Admin = ReturnType<typeof createAdminClient>;

async function sendBatches(admin: Admin, siteUrl: string) {
  const batches = await findDueInstallmentBatches(admin, {
    leadDays: LEAD_DAYS,
    limit: MAX_BATCHES_PER_RUN,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const batch of batches) {
    try {
      const outcome = await sendInstallmentBatch(admin, batch, siteUrl);
      if (outcome === "sent") sent += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      console.error("Installment batch send failed", {
        planId: batch.planId,
        dueDate: batch.dueDate,
        error,
      });
    }
  }

  return { sent, skipped, failed };
}

async function sendReminders(admin: Admin, siteUrl: string) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - REMINDER_AFTER_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data } = await admin
    .from("installments")
    .select(
      "id, student_id, school_year_id, due_date, amount, payment_id, payment_plans!inner(family_id, status, paused_at)",
    )
    .eq("status", "sendt")
    .is("reminder_sent_at", null)
    .not("payment_id", "is", null)
    .lte("due_date", cutoffDate)
    .eq("payment_plans.status", "aktiv")
    .is("payment_plans.paused_at", null)
    .limit(50);

  const byPayment = new Map<
    string,
    {
      familyId: string;
      schoolYearId: string;
      dueDate: string;
      rows: { id: string; studentId: string; amount: number }[];
    }
  >();
  for (const row of data ?? []) {
    const plan = row.payment_plans as unknown as { family_id: string };
    const paymentId = row.payment_id as string;
    let group = byPayment.get(paymentId);
    if (!group) {
      group = {
        familyId: plan.family_id,
        schoolYearId: row.school_year_id,
        dueDate: row.due_date,
        rows: [],
      };
      byPayment.set(paymentId, group);
    }
    group.rows.push({
      id: row.id,
      studentId: row.student_id,
      amount: row.amount,
    });
  }

  let reminded = 0;

  for (const [paymentId, group] of byPayment) {
    try {
      const { data: payment } = await admin
        .from("payments")
        .select("status")
        .eq("id", paymentId)
        .maybeSingle();
      if (!payment || payment.status !== "opprettet") continue;

      if (await emailNotifications()) {
        const recipients = await familyRecipients(admin, group.familyId);
        if (recipients.length > 0) {
          const names = await studentNames(
            admin,
            group.rows.map((row) => row.studentId),
          );
          const { data: year } = await admin
            .from("school_years")
            .select("label")
            .eq("id", group.schoolYearId)
            .maybeSingle();

          await sendInstallmentEmail({
            to: recipients,
            children: group.rows.map((row) => ({
              name: names.get(row.studentId) ?? "Elev",
              amount: row.amount,
            })),
            totalAmount: group.rows.reduce((sum, row) => sum + row.amount, 0),
            schoolYear: year?.label ?? null,
            dueDate: group.dueDate,
            url: `${siteUrl}/api/vipps/pay/${paymentId}`,
          });
        }
      }

      await admin
        .from("installments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in(
          "id",
          group.rows.map((row) => row.id),
        );
      reminded += 1;
    } catch (error) {
      console.error("Installment reminder failed", { paymentId, error });
    }
  }

  return { reminded };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!siteUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL missing" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const batchResult = await sendBatches(admin, siteUrl);
  const reminderResult = await sendReminders(admin, siteUrl);

  return NextResponse.json({
    ok: true,
    ...batchResult,
    ...reminderResult,
  });
}
