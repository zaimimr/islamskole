"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth";
import {
  capturePayment,
  cancelPayment,
  createPayment,
  refundPayment,
} from "@/lib/vipps";
import { syncPaymentByReference } from "@/lib/payments-sync";
import { sendPaymentLinkEmail } from "@/lib/email";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };
type PaymentResult =
  | { ok: true; redirectUrl: string; reference: string; emailed?: boolean }
  | { ok: false; error: string };
type BatchResult =
  | { ok: true; sent: number; skipped: number; note?: string }
  | { ok: false; error: string };

async function requireAdmin() {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) throw new Error("Ikke autorisert");
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value === "" ? null : value;
}

function readNumber(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function revalidate() {
  revalidatePath("/", "layout");
}

const studentSchema = z.object({
  full_name: z.string().min(1, "Navn er påkrevd"),
  guardian_name: z.string().min(1, "Foresattes navn er påkrevd"),
});

function readStudentPayload(formData: FormData) {
  return {
    full_name: readString(formData, "full_name"),
    child_age: readNumber(formData, "child_age"),
    guardian_name: readString(formData, "guardian_name"),
    email: readOptionalString(formData, "email"),
    phone: readOptionalString(formData, "phone"),
    level_quran: readOptionalString(formData, "level_quran"),
    level_arabic: readOptionalString(formData, "level_arabic"),
    level_islam: readOptionalString(formData, "level_islam"),
    notes: readOptionalString(formData, "notes"),
  };
}

export async function createStudent(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const payload = readStudentPayload(formData);

  const parsed = studentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: (data as unknown as { id: string }).id };
}

export async function createStudentFromApplication(
  applicationId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: application, error: appError } = await supabase
    .from("student_applications")
    .select(
      "id, child_name, child_age, guardian_name, email, phone, level_quran, level_arabic, level_islam, message",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) return { ok: false, error: appError.message };
  if (!application) return { ok: false, error: "Fant ikke påmeldingen" };

  const app = application as unknown as {
    child_name: string;
    child_age: number | null;
    guardian_name: string;
    email: string | null;
    phone: string | null;
    level_quran: string | null;
    level_arabic: string | null;
    level_islam: string | null;
    message: string | null;
  };

  const payload = {
    application_id: applicationId,
    full_name: app.child_name,
    child_age: app.child_age,
    guardian_name: app.guardian_name,
    email: app.email,
    phone: app.phone,
    level_quran: app.level_quran,
    level_arabic: app.level_arabic,
    level_islam: app.level_islam,
    notes: app.message,
  };

  const { data, error } = await supabase
    .from("students")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("student_applications")
    .update({ status: "akseptert" } as never)
    .eq("id", applicationId);

  revalidate();
  return { ok: true, id: (data as unknown as { id: string }).id };
}

export async function updateStudent(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const payload = readStudentPayload(formData);

  const parsed = studentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update(payload as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

const enrollmentSchema = z.object({
  student_id: z.string().min(1),
  class_id: z.string().min(1, "Velg en klasse"),
  school_year_id: z.string().min(1, "Velg et skoleår"),
});

export async function placeStudentInClass(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const payload = {
    student_id: readString(formData, "student_id"),
    class_id: readString(formData, "class_id"),
    school_year_id: readString(formData, "school_year_id"),
  };

  const parsed = enrollmentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Eleven er allerede plassert i denne klassen for terminen" };
    }
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, id: (data as unknown as { id: string }).id };
}

export async function removeEnrollment(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

const paymentSchema = z.object({
  student_id: z.string().min(1),
  amount_nok: z.number().positive("Beløp må være større enn 0"),
});

export async function createVippsPayment(
  formData: FormData,
): Promise<PaymentResult> {
  await requireAdmin();

  const studentId = readString(formData, "student_id");
  const enrollmentId = readOptionalString(formData, "enrollment_id");
  const schoolYearId = readOptionalString(formData, "school_year_id");
  const amountNok = readNumber(formData, "amount_nok");

  const parsed = paymentSchema.safeParse({
    student_id: studentId,
    amount_nok: amountNok ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const amount = Math.round((amountNok as number) * 100);

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("phone, email, full_name, guardian_name")
    .eq("id", studentId)
    .maybeSingle();
  const studentRow = student as unknown as {
    phone: string | null;
    email: string | null;
    full_name: string | null;
    guardian_name: string | null;
  } | null;
  const phone = studentRow?.phone;

  let yearLabel: string | null = null;
  if (schoolYearId) {
    const { data: year } = await supabase
      .from("school_years")
      .select("label")
      .eq("id", schoolYearId)
      .maybeSingle();
    yearLabel = (year as unknown as { label: string } | null)?.label ?? null;
  }

  const description =
    readOptionalString(formData, "description") ??
    `Skolepenger${yearLabel ? ` ${yearLabel}` : ""}`;

  const reference = `isk-${randomUUID()}`;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const returnUrl = `${siteUrl}/api/vipps/return?reference=${reference}`;

  let redirectUrl: string;
  try {
    const result = await createPayment({
      reference,
      amount,
      description,
      returnUrl,
      phoneNumber: phone,
    });
    redirectUrl = result.redirectUrl;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }

  const { error: insertError } = await supabase.from("payments").insert({
    student_id: studentId,
    enrollment_id: enrollmentId,
    school_year_id: schoolYearId,
    reference,
    amount,
    description,
    status: "opprettet",
    vipps_state: "CREATED",
    redirect_url: redirectUrl,
  } as never);

  if (insertError) return { ok: false, error: insertError.message };

  let emailed = false;
  if (studentRow?.email) {
    await sendPaymentLinkEmail({
      to: studentRow.email,
      guardianName: studentRow.guardian_name ?? "",
      childName: studentRow.full_name ?? "",
      amount,
      schoolYear: yearLabel,
      url: redirectUrl,
    });
    emailed = true;
  }

  revalidate();
  return { ok: true, redirectUrl, reference, emailed };
}

type BatchEnrollment = {
  id: string;
  student_id: string;
  classes: { name_no: string | null; price: number | null } | null;
  students: {
    full_name: string | null;
    guardian_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};
type BatchPayment = {
  student_id: string;
  status: string;
  redirect_url: string | null;
  amount: number;
};

export async function batchSendPaymentLinks(
  schoolYearId: string,
): Promise<BatchResult> {
  await requireAdmin();
  if (!schoolYearId) return { ok: false, error: "Mangler skoleår" };

  const supabase = await createClient();

  const { data: yr } = await supabase
    .from("school_years")
    .select("label")
    .eq("id", schoolYearId)
    .maybeSingle();
  const yearLabel = (yr as unknown as { label: string } | null)?.label ?? null;
  const description = `Skolepenger${yearLabel ? ` ${yearLabel}` : ""}`;

  const { data: enr } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, classes(name_no, price), students(full_name, guardian_name, email, phone)",
    )
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv");
  const enrollments = (enr as unknown as BatchEnrollment[] | null) ?? [];

  const { data: pays } = await supabase
    .from("payments")
    .select("student_id, status, redirect_url, amount")
    .eq("school_year_id", schoolYearId);
  const payments = (pays as unknown as BatchPayment[] | null) ?? [];

  const paidStudents = new Set(
    payments.filter((p) => p.status === "fanget").map((p) => p.student_id),
  );
  const pendingByStudent = new Map<string, BatchPayment>();
  for (const p of payments) {
    if (
      (p.status === "opprettet" || p.status === "autorisert") &&
      p.redirect_url &&
      !pendingByStudent.has(p.student_id)
    ) {
      pendingByStudent.set(p.student_id, p);
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  let sent = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const e of enrollments) {
    if (seen.has(e.student_id)) continue;
    seen.add(e.student_id);

    const st = e.students;
    if (paidStudents.has(e.student_id)) {
      skipped++;
      continue;
    }
    if (!st?.email) {
      skipped++;
      continue;
    }

    const pending = pendingByStudent.get(e.student_id);
    if (pending?.redirect_url) {
      await sendPaymentLinkEmail({
        to: st.email,
        guardianName: st.guardian_name ?? "",
        childName: st.full_name ?? "",
        amount: pending.amount,
        schoolYear: yearLabel,
        url: pending.redirect_url,
      });
      sent++;
      continue;
    }

    const price = e.classes?.price;
    if (price == null) {
      skipped++;
      continue;
    }
    const amount = Math.round(price * 100);
    const reference = `isk-${randomUUID()}`;
    const returnUrl = `${siteUrl}/api/vipps/return?reference=${reference}`;

    try {
      const result = await createPayment({
        reference,
        amount,
        description,
        returnUrl,
        phoneNumber: st.phone,
      });
      await supabase.from("payments").insert({
        student_id: e.student_id,
        enrollment_id: e.id,
        school_year_id: schoolYearId,
        reference,
        amount,
        description,
        status: "opprettet",
        vipps_state: "CREATED",
        redirect_url: result.redirectUrl,
      } as never);
      await sendPaymentLinkEmail({
        to: st.email,
        guardianName: st.guardian_name ?? "",
        childName: st.full_name ?? "",
        amount,
        schoolYear: yearLabel,
        url: result.redirectUrl,
      });
      sent++;
    } catch {
      skipped++;
    }
  }

  revalidate();
  const note =
    skipped > 0
      ? `${skipped} hoppet over (allerede betalt, mangler e-post, eller klasse uten pris)`
      : undefined;
  return { ok: true, sent, skipped, note };
}

async function getPaymentReference(
  paymentId: string,
): Promise<{ reference: string; amount: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("reference, amount")
    .eq("id", paymentId)
    .maybeSingle();
  return (data as unknown as { reference: string; amount: number } | null) ?? null;
}

export async function syncPaymentStatus(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };

  try {
    await syncPaymentByReference(row.reference);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }
  revalidate();
  return { ok: true, id: paymentId };
}

export async function captureVippsPayment(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };

  try {
    await capturePayment(row.reference, row.amount);
    await syncPaymentByReference(row.reference);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }
  revalidate();
  return { ok: true, id: paymentId };
}

export async function refundVippsPayment(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };

  try {
    await refundPayment(row.reference, row.amount);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "refundert" } as never)
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: paymentId };
}

export async function cancelVippsPayment(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };

  try {
    await cancelPayment(row.reference);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "avbrutt", vipps_state: "TERMINATED" } as never)
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: paymentId };
}

export async function sendPaymentLink(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "amount, redirect_url, school_years(label), students(full_name, guardian_name, email)",
    )
    .eq("id", paymentId)
    .maybeSingle();

  const payment = data as unknown as {
    amount: number;
    redirect_url: string | null;
    school_years: { label: string } | null;
    students: {
      full_name: string | null;
      guardian_name: string | null;
      email: string | null;
    } | null;
  } | null;

  if (!payment) return { ok: false, error: "Fant ikke betalingen" };
  if (!payment.redirect_url) {
    return { ok: false, error: "Betalingen mangler en lenke" };
  }
  if (!payment.students?.email) {
    return { ok: false, error: "Foresatt mangler e-postadresse" };
  }

  await sendPaymentLinkEmail({
    to: payment.students.email,
    guardianName: payment.students.guardian_name ?? "",
    childName: payment.students.full_name ?? "",
    amount: payment.amount,
    schoolYear: payment.school_years?.label ?? null,
    url: payment.redirect_url,
  });

  return { ok: true, id: paymentId };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}
