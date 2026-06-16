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
  | {
      ok: true;
      redirectUrl: string;
      reference: string;
      emailed?: boolean;
      emailedTo?: number;
    }
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

function uniqueEmails(...values: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      values
        .filter((v): v is string => Boolean(v && v.trim()))
        .map((v) => v.trim().toLowerCase()),
    ),
  ];
}

const studentSchema = z.object({
  full_name: z.string().min(1, "Navn er påkrevd"),
  guardian_name: z.string().min(1, "Foresattes navn er påkrevd"),
});

function readStudentPayload(formData: FormData) {
  return {
    full_name: readString(formData, "full_name"),
    birth_date: readOptionalString(formData, "birth_date"),
    guardian_name: readString(formData, "guardian_name"),
    email: readOptionalString(formData, "email"),
    phone: readOptionalString(formData, "phone"),
    guardian2_name: readOptionalString(formData, "guardian2_name"),
    guardian2_email: readOptionalString(formData, "guardian2_email"),
    guardian2_phone: readOptionalString(formData, "guardian2_phone"),
    student_email: readOptionalString(formData, "student_email"),
    student_phone: readOptionalString(formData, "student_phone"),
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
  placement?: { classId?: string | null; schoolYearId?: string | null },
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: application, error: appError } = await supabase
    .from("student_applications")
    .select(
      "id, child_name, child_age, birth_date, guardian_name, email, phone, level_quran, level_arabic, level_islam, message",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) return { ok: false, error: appError.message };
  if (!application) return { ok: false, error: "Fant ikke påmeldingen" };

  const app = application as unknown as {
    child_name: string;
    child_age: number | null;
    birth_date: string | null;
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
    birth_date: app.birth_date,
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

  const studentId = (data as unknown as { id: string }).id;

  if (placement?.classId && placement?.schoolYearId) {
    await supabase.from("enrollments").insert({
      student_id: studentId,
      class_id: placement.classId,
      school_year_id: placement.schoolYearId,
      status: "aktiv",
    } as never);
  }

  await supabase
    .from("student_applications")
    .update({ status: "akseptert" } as never)
    .eq("id", applicationId);

  revalidate();
  return { ok: true, id: studentId };
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

  if (!schoolYearId) {
    return { ok: false, error: "Velg et skoleår for betalingen" };
  }

  const supabase = await createClient();

  const { data: enrollmentRow } = await supabase
    .from("enrollments")
    .select("id, classes(name_no)")
    .eq("student_id", studentId)
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv")
    .limit(1)
    .maybeSingle();
  const enrollment = enrollmentRow as unknown as {
    id: string;
    classes: { name_no: string | null } | null;
  } | null;
  if (!enrollment) {
    return {
      ok: false,
      error:
        "Eleven må plasseres i en klasse for dette skoleåret før du kan opprette betaling.",
    };
  }
  const className = enrollment.classes?.name_no ?? null;
  const enrollmentId = enrollment.id;

  const { data: existing } = await supabase
    .from("payments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("school_year_id", schoolYearId)
    .not("status", "in", "(avbrutt,feilet,refundert)")
    .limit(1);
  if ((existing as unknown[] | null)?.length) {
    return {
      ok: false,
      error:
        "Det finnes allerede en aktiv betaling for denne eleven dette skoleåret. Bruk Send-knappen for å sende lenken på nytt, eller avbryt den gamle først.",
    };
  }

  const { data: student } = await supabase
    .from("students")
    .select("phone, email, full_name, guardian_name, guardian2_email")
    .eq("id", studentId)
    .maybeSingle();
  const studentRow = student as unknown as {
    phone: string | null;
    email: string | null;
    full_name: string | null;
    guardian_name: string | null;
    guardian2_email: string | null;
  } | null;
  const phone = studentRow?.phone;
  const recipients = uniqueEmails(
    studentRow?.email,
    studentRow?.guardian2_email,
  );

  const { data: year } = await supabase
    .from("school_years")
    .select("label")
    .eq("id", schoolYearId)
    .maybeSingle();
  const yearLabel = (year as unknown as { label: string } | null)?.label ?? null;

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

  const { data: inserted, error: insertError } = await supabase
    .from("payments")
    .insert({
      student_id: studentId,
      enrollment_id: enrollmentId,
      school_year_id: schoolYearId,
      reference,
      amount,
      description,
      status: "opprettet",
      vipps_state: "CREATED",
      redirect_url: redirectUrl,
    } as never)
    .select("id")
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  const paymentId = (inserted as unknown as { id: string }).id;
  const payLink = `${siteUrl}/api/vipps/pay/${paymentId}`;

  let emailed = false;
  if (recipients.length) {
    emailed = await sendPaymentLinkEmail({
      to: recipients,
      guardianName: studentRow?.guardian_name ?? "",
      childName: studentRow?.full_name ?? "",
      amount,
      schoolYear: yearLabel,
      className,
      url: payLink,
    });
  }

  revalidate();
  return {
    ok: true,
    redirectUrl: payLink,
    reference,
    emailed,
    emailedTo: emailed ? recipients.length : 0,
  };
}

type BatchEnrollment = {
  id: string;
  student_id: string;
  classes: { name_no: string | null; price: number | null } | null;
  students: {
    full_name: string | null;
    guardian_name: string | null;
    email: string | null;
    guardian2_email: string | null;
    phone: string | null;
  } | null;
};
type BatchPayment = {
  id: string;
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
    .select("label, fee")
    .eq("id", schoolYearId)
    .maybeSingle();
  const yearRow = yr as unknown as { label: string; fee: number | null } | null;
  const yearLabel = yearRow?.label ?? null;
  const yearFee = yearRow?.fee ?? null;
  const description = `Skolepenger${yearLabel ? ` ${yearLabel}` : ""}`;

  const { data: enr } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, classes(name_no, price), students(full_name, guardian_name, email, guardian2_email, phone)",
    )
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv");
  const enrollments = (enr as unknown as BatchEnrollment[] | null) ?? [];

  const { data: pays } = await supabase
    .from("payments")
    .select("id, student_id, status, redirect_url, amount")
    .eq("school_year_id", schoolYearId);
  const payments = (pays as unknown as BatchPayment[] | null) ?? [];

  const paidStudents = new Set(
    payments.filter((p) => p.status === "fanget").map((p) => p.student_id),
  );
  const pendingByStudent = new Map<string, BatchPayment>();
  for (const p of payments) {
    if (
      (p.status === "opprettet" || p.status === "autorisert") &&
      !pendingByStudent.has(p.student_id)
    ) {
      pendingByStudent.set(p.student_id, p);
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  let sent = 0;
  let alreadyPaid = 0;
  let noEmail = 0;
  let noPrice = 0;
  let failed = 0;
  const seen = new Set<string>();

  for (const e of enrollments) {
    if (seen.has(e.student_id)) continue;
    seen.add(e.student_id);

    const st = e.students;
    if (paidStudents.has(e.student_id)) {
      alreadyPaid++;
      continue;
    }
    const recipients = uniqueEmails(st?.email, st?.guardian2_email);
    if (recipients.length === 0) {
      noEmail++;
      continue;
    }
    const className = e.classes?.name_no ?? null;

    const pending = pendingByStudent.get(e.student_id);
    if (pending) {
      const ok = await sendPaymentLinkEmail({
        to: recipients,
        guardianName: st?.guardian_name ?? "",
        childName: st?.full_name ?? "",
        amount: pending.amount,
        schoolYear: yearLabel,
        className,
        url: `${siteUrl}/api/vipps/pay/${pending.id}`,
      });
      if (ok) sent++;
      else failed++;
      continue;
    }

    const price = e.classes?.price ?? yearFee;
    if (price == null) {
      noPrice++;
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
        phoneNumber: st?.phone,
      });
      const { data: ins, error: insertError } = await supabase
        .from("payments")
        .insert({
          student_id: e.student_id,
          enrollment_id: e.id,
          school_year_id: schoolYearId,
          reference,
          amount,
          description,
          status: "opprettet",
          vipps_state: "CREATED",
          redirect_url: result.redirectUrl,
        } as never)
        .select("id")
        .single();
      if (insertError || !ins) {
        failed++;
        continue;
      }
      const ok = await sendPaymentLinkEmail({
        to: recipients,
        guardianName: st?.guardian_name ?? "",
        childName: st?.full_name ?? "",
        amount,
        schoolYear: yearLabel,
        className,
        url: `${siteUrl}/api/vipps/pay/${(ins as unknown as { id: string }).id}`,
      });
      if (ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  revalidate();
  const parts: string[] = [];
  if (alreadyPaid) parts.push(`${alreadyPaid} allerede betalt`);
  if (noEmail) parts.push(`${noEmail} mangler e-post`);
  if (noPrice) parts.push(`${noPrice} klasse uten pris`);
  if (failed) parts.push(`${failed} feilet`);
  const skipped = alreadyPaid + noEmail + noPrice + failed;
  const note = parts.length ? parts.join(", ") : undefined;
  return { ok: true, sent, skipped, note };
}

export async function syncAllPaymentsForYear(
  schoolYearId: string,
): Promise<{ ok: true; synced: number } | { ok: false; error: string }> {
  await requireAdmin();
  if (!schoolYearId) return { ok: false, error: "Mangler skoleår" };
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("reference")
    .eq("school_year_id", schoolYearId)
    .in("status", ["opprettet", "autorisert"]);
  const refs = (data as unknown as { reference: string }[] | null) ?? [];
  let synced = 0;
  for (const r of refs) {
    try {
      await syncPaymentByReference(r.reference);
      synced++;
    } catch {
      void 0;
    }
  }
  revalidate();
  return { ok: true, synced };
}

export async function copyEnrollmentsToActiveYear(
  fromYearId: string,
): Promise<
  { ok: true; moved: number; skipped: number; note?: string } | { ok: false; error: string }
> {
  await requireAdmin();
  if (!fromYearId) return { ok: false, error: "Mangler skoleår" };
  const supabase = await createClient();

  const { data: active } = await supabase
    .from("school_years")
    .select("id, label")
    .eq("is_active", true)
    .maybeSingle();
  const activeYear = active as unknown as { id: string; label: string } | null;
  if (!activeYear) return { ok: false, error: "Ingen aktivt skoleår er satt" };
  if (activeYear.id === fromYearId) {
    return { ok: false, error: "Dette er allerede det aktive skoleåret" };
  }

  const { data: src } = await supabase
    .from("enrollments")
    .select("student_id, class_id")
    .eq("school_year_id", fromYearId)
    .eq("status", "aktiv");
  const source =
    (src as unknown as { student_id: string; class_id: string }[] | null) ?? [];

  const { data: existing } = await supabase
    .from("enrollments")
    .select("student_id, class_id")
    .eq("school_year_id", activeYear.id);
  const existingPairs = new Set(
    (
      (existing as unknown as { student_id: string; class_id: string }[] | null) ??
      []
    ).map((e) => `${e.student_id}:${e.class_id}`),
  );

  let moved = 0;
  let skipped = 0;
  for (const s of source) {
    const key = `${s.student_id}:${s.class_id}`;
    if (existingPairs.has(key)) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("enrollments").insert({
      student_id: s.student_id,
      class_id: s.class_id,
      school_year_id: activeYear.id,
      status: "aktiv",
    } as never);
    if (error) {
      skipped++;
      continue;
    }
    existingPairs.add(key);
    moved++;
  }

  revalidate();
  const note = skipped > 0 ? `${skipped} var allerede plassert` : undefined;
  return { ok: true, moved, skipped, note };
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
      "amount, school_years(label), enrollments(classes(name_no)), students(full_name, guardian_name, email, guardian2_email)",
    )
    .eq("id", paymentId)
    .maybeSingle();

  const payment = data as unknown as {
    amount: number;
    school_years: { label: string } | null;
    enrollments: { classes: { name_no: string | null } | null } | null;
    students: {
      full_name: string | null;
      guardian_name: string | null;
      email: string | null;
      guardian2_email: string | null;
    } | null;
  } | null;

  if (!payment) return { ok: false, error: "Fant ikke betalingen" };
  const recipients = uniqueEmails(
    payment.students?.email,
    payment.students?.guardian2_email,
  );
  if (recipients.length === 0) {
    return { ok: false, error: "Foresatt mangler e-postadresse" };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ok = await sendPaymentLinkEmail({
    to: recipients,
    guardianName: payment.students?.guardian_name ?? "",
    childName: payment.students?.full_name ?? "",
    amount: payment.amount,
    schoolYear: payment.school_years?.label ?? null,
    className: payment.enrollments?.classes?.name_no ?? null,
    url: `${siteUrl}/api/vipps/pay/${paymentId}`,
  });
  if (!ok) {
    return { ok: false, error: "E-posten kunne ikke sendes" };
  }

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
