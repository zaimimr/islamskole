"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth";
import {
  capturePayment,
  createPayment,
  getPayment,
  type VippsPaymentState,
} from "@/lib/vipps";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };
type PaymentResult =
  | { ok: true; redirectUrl: string; reference: string }
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
  term: z.string().min(1, "Termin er påkrevd"),
});

export async function placeStudentInClass(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const payload = {
    student_id: readString(formData, "student_id"),
    class_id: readString(formData, "class_id"),
    term: readString(formData, "term"),
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
  const term = readOptionalString(formData, "term");
  const amountNok = readNumber(formData, "amount_nok");
  const description =
    readOptionalString(formData, "description") ??
    `Skolepenger${term ? ` ${term}` : ""}`;

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
    .select("phone")
    .eq("id", studentId)
    .maybeSingle();
  const phone = (student as unknown as { phone: string | null } | null)?.phone;

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
    reference,
    amount,
    term,
    description,
    status: "opprettet",
    vipps_state: "CREATED",
    redirect_url: redirectUrl,
  } as never);

  if (insertError) return { ok: false, error: insertError.message };

  revalidate();
  return { ok: true, redirectUrl, reference };
}

function mapState(
  state: VippsPaymentState,
  capturedAmount: number,
): string {
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

export async function syncPaymentStatus(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("reference")
    .eq("id", paymentId)
    .maybeSingle();
  const reference = (payment as unknown as { reference: string } | null)
    ?.reference;
  if (!reference) return { ok: false, error: "Fant ikke betalingen" };

  let result;
  try {
    result = await getPayment(reference);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }

  const status = mapState(result.state, result.capturedAmount);
  const update: Record<string, unknown> = {
    status,
    vipps_state: result.state,
  };
  if (status === "fanget") update.captured_at = new Date().toISOString();

  const { error } = await supabase
    .from("payments")
    .update(update as never)
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: paymentId };
}

export async function captureVippsPayment(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("reference, amount")
    .eq("id", paymentId)
    .maybeSingle();
  const row = payment as unknown as {
    reference: string;
    amount: number;
  } | null;
  if (!row) return { ok: false, error: "Fant ikke betalingen" };

  try {
    await capturePayment(row.reference, row.amount);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Ukjent Vipps-feil",
    };
  }

  const { error } = await supabase
    .from("payments")
    .update({
      status: "fanget",
      captured_at: new Date().toISOString(),
    } as never)
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };
  revalidate();
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
