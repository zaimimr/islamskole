"use server";

import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { buildReference } from "@/lib/payment-descriptor";
import { sendPaymentReceipt } from "@/lib/payments-sync";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/portal/data";
import { getMyEconomy, type EconomyFamily } from "@/lib/portal/economy";
import type { PortalActionResult, PortalErrorCode } from "@/lib/portal/types";

export type EconomyErrorCode = PortalErrorCode | "settled";

export type EconomyPayResult =
  | { ok: true; url: string }
  | { ok: false; error: EconomyErrorCode };

const REUSE_WINDOW_MS = 30 * 60 * 1000;
const uuid = z.string().uuid();
const locale = z.enum(["no", "en"]);

type Target = { studentId: string; amount: number };

function payUrl(paymentId: string, lang: "no" | "en") {
  return `/api/vipps/pay/${paymentId}?locale=${lang}`;
}

function signature(targets: Target[]) {
  return targets
    .map((target) => `${target.studentId}:${target.amount}`)
    .sort()
    .join(",");
}

function familySurname(family: EconomyFamily) {
  return family.display_name?.replace(/^Famil(ien|ie) /, "") ?? null;
}

async function loadFamily(
  familyId: string,
  userId: string,
): Promise<{ family: EconomyFamily; schoolYearId: string } | { error: EconomyErrorCode }> {
  if (!rateLimit(`portal-pay:${userId}`, { limit: 10, windowMs: 60_000 }).ok) {
    return { error: "rate_limited" };
  }
  const family = (await getMyEconomy()).find((row) => row.family_id === familyId);
  if (!family) return { error: "forbidden" };
  if (!family.school_year_id) return { error: "not_found" };
  return { family, schoolYearId: family.school_year_id };
}

async function payer() {
  const context = await getPortalContext();
  if (!context.guardianIds.length) return { payer_email: context.email, payer_name: null };
  const { data } = await createAdminClient()
    .from("guardians")
    .select("first_name, last_name")
    .in("id", context.guardianIds)
    .limit(1)
    .maybeSingle();
  const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
  return { payer_email: context.email, payer_name: name || null };
}

async function openPayment(schoolYearId: string, targets: Target[]) {
  const { data } = await createAdminClient()
    .from("payments")
    .select("id, student_id, amount, payment_targets(student_id, amount), installments(id), student_applications(id)")
    .eq("school_year_id", schoolYearId)
    .eq("method", "vipps")
    .eq("status", "opprettet")
    .is("voided_at", null)
    .gte("created_at", new Date(Date.now() - REUSE_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  const wanted = signature(targets);
  const match = (data ?? []).find((row) => {
    if (row.installments.length || row.student_applications.length) return false;
    const existing = row.payment_targets.length
      ? row.payment_targets.map((target) => ({ studentId: target.student_id, amount: target.amount }))
      : row.student_id
        ? [{ studentId: row.student_id, amount: row.amount }]
        : [];
    return signature(existing) === wanted;
  });
  return match?.id ?? null;
}

export async function payRemaining(familyId: string, lang: "no" | "en"): Promise<EconomyPayResult> {
  const parsed = z.object({ familyId: uuid, lang: locale }).safeParse({ familyId, lang });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const loaded = await loadFamily(parsed.data.familyId, user.id);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { family, schoolYearId } = loaded;

  const children = family.children.filter((child) => child.remaining > 0);
  if (!children.length) return { ok: false, error: "settled" };
  const targets = children.map((child) => ({ studentId: child.student_id, amount: child.remaining }));
  const amount = targets.reduce((sum, target) => sum + target.amount, 0);

  const existing = await openPayment(schoolYearId, targets);
  if (existing) return { ok: true, url: payUrl(existing, parsed.data.lang) };

  const admin = createAdminClient();
  const single = children.length === 1 ? children[0] : null;
  const { data: enrollment } = single
    ? await admin
        .from("enrollments")
        .select("id")
        .eq("student_id", single.student_id)
        .eq("school_year_id", schoolYearId)
        .eq("status", "aktiv")
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: inserted, error: insertError } = await admin
    .from("payments")
    .insert({
      student_id: single?.student_id ?? null,
      enrollment_id: enrollment?.id ?? null,
      school_year_id: schoolYearId,
      reference: buildReference(family.school_year_label, familySurname(family), children.length),
      amount,
      description: `Skolepenger${family.school_year_label ? ` ${family.school_year_label}` : ""} - ${children.map((child) => child.name).join(", ")}`,
      status: "opprettet",
      method: "vipps",
      ...(await payer()),
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("Portal payment insert failed", insertError);
    return { ok: false, error: "unknown" };
  }

  if (!single) {
    const { error: targetError } = await admin.from("payment_targets").insert(
      targets.map((target) => ({
        payment_id: inserted.id,
        student_id: target.studentId,
        amount: target.amount,
      })),
    );
    if (targetError) {
      console.error("Portal payment targets failed", targetError);
      await admin.from("payments").delete().eq("id", inserted.id);
      return { ok: false, error: "unknown" };
    }
  }

  await writeAudit({
    action: "portal.pay_remaining",
    entityType: "payments",
    entityId: inserted.id,
    metadata: { family_id: family.family_id, amount, children: targets.length },
  });
  return { ok: true, url: payUrl(inserted.id, parsed.data.lang) };
}

export async function payInstallment(
  familyId: string,
  installmentId: string,
  lang: "no" | "en",
): Promise<EconomyPayResult> {
  const parsed = z
    .object({ familyId: uuid, installmentId: uuid, lang: locale })
    .safeParse({ familyId, installmentId, lang });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const loaded = await loadFamily(parsed.data.familyId, user.id);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const { family, schoolYearId } = loaded;

  const installment = family.installments.find((row) => row.id === parsed.data.installmentId);
  if (!installment) return { ok: false, error: "not_found" };
  if (installment.status === "betalt") return { ok: false, error: "settled" };
  if (installment.payment_id) return { ok: true, url: payUrl(installment.payment_id, parsed.data.lang) };

  const admin = createAdminClient();
  const { data: rows, error: rowsError } = await admin
    .from("installments")
    .select("id, amount, payment_plans!inner(family_id)")
    .eq("payment_plans.family_id", family.family_id)
    .eq("school_year_id", schoolYearId)
    .eq("due_date", installment.due_date)
    .eq("status", "planlagt")
    .is("payment_id", null);
  if (rowsError || !rows?.length) return { ok: false, error: rowsError ? "unknown" : "not_found" };

  const amount = rows.reduce((sum, row) => sum + row.amount, 0);
  const { data: inserted, error: insertError } = await admin
    .from("payments")
    .insert({
      school_year_id: schoolYearId,
      reference: buildReference(family.school_year_label, familySurname(family), installment.children.length),
      amount,
      status: "opprettet",
      method: "vipps",
      due_date: installment.due_date,
      description: `Avdrag ${installment.due_date} - Skolepenger${family.school_year_label ? ` ${family.school_year_label}` : ""} - ${installment.children.join(", ")}`,
      ...(await payer()),
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("Portal installment payment insert failed", insertError);
    return { ok: false, error: "unknown" };
  }

  const { data: linked, error: linkError } = await admin
    .from("installments")
    .update({ status: "sendt", payment_id: inserted.id, sent_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((row) => row.id),
    )
    .eq("status", "planlagt")
    .is("payment_id", null)
    .select("id");
  if (linkError || !linked?.length) {
    console.error("Portal installment link failed", linkError);
    await admin.from("payments").delete().eq("id", inserted.id);
    return { ok: false, error: "unknown" };
  }

  await writeAudit({
    action: "portal.pay_installment",
    entityType: "payments",
    entityId: inserted.id,
    metadata: { family_id: family.family_id, amount, installments: linked.length },
  });
  return { ok: true, url: payUrl(inserted.id, parsed.data.lang) };
}

export async function sendEconomyReceipt(paymentId: string): Promise<PortalActionResult> {
  const parsed = uuid.safeParse(paymentId);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  if (!rateLimit(`portal-receipt:${user.id}`, { limit: 3, windowMs: 10 * 60_000 }).ok) {
    return { ok: false, error: "rate_limited" };
  }

  const payment = (await getMyEconomy())
    .flatMap((family) => family.payments)
    .find((row) => row.id === parsed.data);
  if (!payment) return { ok: false, error: "forbidden" };
  if (payment.status !== "fanget") return { ok: false, error: "invalid" };

  const result = await sendPaymentReceipt(createAdminClient(), payment.id);
  if (!result.sent) {
    console.error("Portal receipt failed", result.reason);
    return { ok: false, error: "unknown" };
  }
  await writeAudit({
    action: "portal.send_receipt",
    entityType: "payments",
    entityId: payment.id,
  });
  return { ok: true };
}
