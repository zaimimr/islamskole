"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin, getUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  capturePayment,
  cancelPayment,
  createPayment,
  refundPayment,
} from "@/lib/vipps";
import { syncPaymentByReference } from "@/lib/payments-sync";
import {
  allocatePayment,
  allocatePaymentsForStudent,
  balanceKey,
  ensureStudentFee,
  fetchBalances,
  replacePaymentAllocations,
  setStudentFee,
} from "@/lib/payment-ledger";
import {
  buildReference,
  describeForStudent,
} from "@/lib/payment-descriptor";
import { sendPaymentLinkEmail } from "@/lib/email";
import {
  guardianEmails,
  guardianName,
  studentDisplayName,
} from "@/lib/student-name";

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

const required = (message: string) =>
  z.preprocess((v) => v ?? "", z.string().min(1, message));

const studentSchema = z
  .object({
    child_first_name: required("Barnets fornavn er påkrevd"),
    child_last_name: required("Barnets etternavn er påkrevd"),
    mother_first_name: z.string().nullable(),
    mother_last_name: z.string().nullable(),
    father_first_name: z.string().nullable(),
    father_last_name: z.string().nullable(),
  })
  .refine(
    (value) =>
      guardianName({
        mother_first_name: value.mother_first_name,
        mother_last_name: value.mother_last_name,
        father_first_name: value.father_first_name,
        father_last_name: value.father_last_name,
      }) != null,
    { message: "Minst én forelder må fylles ut" },
  );

function readStudentPayload(formData: FormData) {
  return {
    child_first_name: readOptionalString(formData, "child_first_name"),
    child_last_name: readOptionalString(formData, "child_last_name"),
    child_birth_date: readOptionalString(formData, "birth_date"),
    child_gender: readOptionalString(formData, "gender"),
    child_address: readOptionalString(formData, "address"),
    child_postal_code: readOptionalString(formData, "postal_code"),
    child_city: readOptionalString(formData, "city"),
    child_email: readOptionalString(formData, "email"),
    child_phone: readOptionalString(formData, "phone"),
    mother_first_name: readOptionalString(formData, "mother_first_name"),
    mother_last_name: readOptionalString(formData, "mother_last_name"),
    mother_phone: readOptionalString(formData, "mother_phone"),
    mother_email: readOptionalString(formData, "mother_email"),
    father_first_name: readOptionalString(formData, "father_first_name"),
    father_last_name: readOptionalString(formData, "father_last_name"),
    father_phone: readOptionalString(formData, "father_phone"),
    father_email: readOptionalString(formData, "father_email"),
    child_level_quran: readOptionalString(formData, "level_quran"),
    child_level_arabic: readOptionalString(formData, "level_arabic"),
    child_level_islam: readOptionalString(formData, "level_islam"),
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
  const { data, error } = await supabase.rpc("create_manual_family_student", {
    p_student: payload,
  });

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data };
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
      "id, family_id, child_first_name, child_last_name, child_birth_date, child_gender, child_address, child_postal_code, child_city, child_email, child_phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, child_level_quran, child_level_arabic, child_level_islam, message",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) return { ok: false, error: appError.message };
  if (!application) return { ok: false, error: "Fant ikke påmeldingen" };

  const app = application as unknown as {
    family_id: string | null;
    child_first_name: string | null;
    child_last_name: string | null;
    child_birth_date: string | null;
    child_gender: string | null;
    child_address: string | null;
    child_postal_code: string | null;
    child_city: string | null;
    child_email: string | null;
    child_phone: string | null;
    mother_first_name: string | null;
    mother_last_name: string | null;
    mother_phone: string | null;
    mother_email: string | null;
    father_first_name: string | null;
    father_last_name: string | null;
    father_phone: string | null;
    father_email: string | null;
    child_level_quran: string | null;
    child_level_arabic: string | null;
    child_level_islam: string | null;
    message: string | null;
  };

  const payload = {
    application_id: applicationId,
    family_id: app.family_id,
    child_first_name: app.child_first_name,
    child_last_name: app.child_last_name,
    child_birth_date: app.child_birth_date,
    child_gender: app.child_gender,
    child_address: app.child_address,
    child_postal_code: app.child_postal_code,
    child_city: app.child_city,
    child_email: app.child_email,
    child_phone: app.child_phone,
    mother_first_name: app.mother_first_name,
    mother_last_name: app.mother_last_name,
    mother_phone: app.mother_phone,
    mother_email: app.mother_email,
    father_first_name: app.father_first_name,
    father_last_name: app.father_last_name,
    father_phone: app.father_phone,
    father_email: app.father_email,
    child_level_quran: app.child_level_quran,
    child_level_arabic: app.child_level_arabic,
    child_level_islam: app.child_level_islam,
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
    const { capacity, priceSnapshot } = await resolveEnrollmentPricing(
      supabase,
      placement.classId,
      placement.schoolYearId,
    );
    let hasCapacity = true;
    if (capacity != null) {
      const enrolled = await countActiveEnrollments(
        supabase,
        placement.classId,
        placement.schoolYearId,
      );
      hasCapacity = enrolled < capacity;
    }
    if (hasCapacity) {
      await supabase.from("enrollments").insert({
        student_id: studentId,
        class_id: placement.classId,
        school_year_id: placement.schoolYearId,
        status: "aktiv",
        price_snapshot: priceSnapshot,
      } as never);
      await ensureStudentFee(supabase, studentId, placement.schoolYearId);
    }
  }

  await supabase
    .from("student_applications")
    .update({ status: "akseptert" } as never)
    .eq("id", applicationId);

  await allocatePaymentsForStudent(supabase, studentId, applicationId);

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

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countActiveEnrollments(
  supabase: SupabaseServerClient,
  classId: string,
  schoolYearId: string,
): Promise<number> {
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv");
  return count ?? 0;
}

async function resolveEnrollmentPricing(
  supabase: SupabaseServerClient,
  classId: string,
  schoolYearId: string,
): Promise<{ capacity: number | null; priceSnapshot: number | null }> {
  const [{ data: classRow }, { data: yearRow }] = await Promise.all([
    supabase
      .from("classes")
      .select("capacity, price")
      .eq("id", classId)
      .maybeSingle(),
    supabase
      .from("school_years")
      .select("fee")
      .eq("id", schoolYearId)
      .maybeSingle(),
  ]);
  const cls = classRow as unknown as {
    capacity: number | null;
    price: number | null;
  } | null;
  const year = yearRow as unknown as { fee: number | null } | null;
  return {
    capacity: cls?.capacity ?? null,
    priceSnapshot: cls?.price ?? year?.fee ?? null,
  };
}

function classFullError(enrolled: number, capacity: number): string {
  return `Klassen er full (${enrolled}/${capacity} plasser)`;
}

export type ClassCapacityInfo = {
  classId: string;
  capacity: number | null;
  enrolled: number;
};

export async function getClassCapacityInfo(
  schoolYearId: string,
): Promise<ClassCapacityInfo[]> {
  await requireAdmin();
  if (!schoolYearId) return [];
  const supabase = await createClient();

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, capacity");
  const classes =
    (classRows as unknown as { id: string; capacity: number | null }[] | null) ??
    [];

  const { data: enrollmentRows } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv");
  const enrollments =
    (enrollmentRows as unknown as { class_id: string }[] | null) ?? [];

  const counts = new Map<string, number>();
  for (const e of enrollments) {
    counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1);
  }

  return classes.map((c) => ({
    classId: c.id,
    capacity: c.capacity,
    enrolled: counts.get(c.id) ?? 0,
  }));
}

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

  const { capacity, priceSnapshot } = await resolveEnrollmentPricing(
    supabase,
    payload.class_id,
    payload.school_year_id,
  );
  if (capacity != null) {
    const enrolled = await countActiveEnrollments(
      supabase,
      payload.class_id,
      payload.school_year_id,
    );
    if (enrolled >= capacity) {
      return { ok: false, error: classFullError(enrolled, capacity) };
    }
  }

  const { data, error } = await supabase
    .from("enrollments")
    .insert({ ...payload, price_snapshot: priceSnapshot } as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Eleven er allerede plassert i denne klassen for terminen" };
    }
    return { ok: false, error: error.message };
  }

  await ensureStudentFee(supabase, payload.student_id, payload.school_year_id);
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

  if (!schoolYearId) {
    return { ok: false, error: "Velg et skoleår for betalingen" };
  }

  const supabase = await createClient();

  const { data: enrollmentRow } = await supabase
    .from("enrollments")
    .select("id, price_snapshot, classes(name_no)")
    .eq("student_id", studentId)
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv")
    .limit(1)
    .maybeSingle();
  const enrollment = enrollmentRow as unknown as {
    id: string;
    price_snapshot: number | null;
    classes: { name_no: string | null } | null;
  } | null;
  const className = enrollment?.classes?.name_no ?? null;
  const enrollmentId = enrollment?.id ?? null;

  await ensureStudentFee(supabase, studentId, schoolYearId);

  const amount = Math.round((amountNok as number) * 100);
  const dueDate = readOptionalString(formData, "due_date");

  const { data: student } = await supabase
    .from("students")
    .select(
      "child_phone, child_email, child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, mother_email, father_email",
    )
    .eq("id", studentId)
    .maybeSingle();
  const studentRow = student as unknown as {
    child_phone: string | null;
    child_email: string | null;
    child_first_name: string | null;
    child_last_name: string | null;
    mother_first_name: string | null;
    mother_last_name: string | null;
    father_first_name: string | null;
    father_last_name: string | null;
    mother_email: string | null;
    father_email: string | null;
  } | null;
  const phone = studentRow?.child_phone;
  const recipients = studentRow ? guardianEmails(studentRow) : [];

  const { data: year } = await supabase
    .from("school_years")
    .select("label")
    .eq("id", schoolYearId)
    .maybeSingle();
  const yearLabel = (year as unknown as { label: string } | null)?.label ?? null;

  const descriptor = studentRow
    ? describeForStudent(studentRow, yearLabel, amount)
    : null;

  const description =
    readOptionalString(formData, "description") ??
    descriptor?.description ??
    `Skolepenger${yearLabel ? ` ${yearLabel}` : ""}`;

  const reference = buildReference(yearLabel, descriptor?.familyName ?? null, 1);
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
      metadata: descriptor?.metadata ?? null,
      orderLines: descriptor?.orderLines ?? null,
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
      due_date: dueDate,
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
      guardianName: studentRow ? guardianName(studentRow) ?? "" : "",
      childName: studentRow ? studentDisplayName(studentRow) : "",
      amount,
      schoolYear: yearLabel,
      className,
      dueDate,
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

const manualPaymentSchema = z.object({
  student_id: z.string().min(1),
  school_year_id: z.string().min(1, "Velg et skoleår"),
  amount_nok: z.number().positive("Beløp må være større enn 0"),
  paid_at: z.string().min(1, "Velg dato for betalingen"),
  method: z.enum(["vipps", "kontant", "bank", "annet"], {
    message: "Velg betalingsmåte",
  }),
});

export async function registerManualPayment(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const payload = {
    student_id: readString(formData, "student_id"),
    school_year_id: readString(formData, "school_year_id"),
    amount_nok: readNumber(formData, "amount_nok") ?? 0,
    paid_at: readString(formData, "paid_at"),
    method: readString(formData, "method"),
  };

  const parsed = manualPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: enrollmentRow } = await supabase
    .from("enrollments")
    .select("id, classes(name_no)")
    .eq("student_id", payload.student_id)
    .eq("school_year_id", payload.school_year_id)
    .eq("status", "aktiv")
    .limit(1)
    .maybeSingle();
  const enrollment = enrollmentRow as unknown as {
    id: string;
    classes: { name_no: string | null } | null;
  } | null;

  const { data: year } = await supabase
    .from("school_years")
    .select("label")
    .eq("id", payload.school_year_id)
    .maybeSingle();
  const yearLabel = (year as unknown as { label: string } | null)?.label ?? null;
  const className = enrollment?.classes?.name_no ?? null;

  const methodLabels: Record<string, string> = {
    vipps: "Vipps",
    kontant: "Kontant",
    bank: "Bankoverføring",
    annet: "Annet",
  };
  const note = readOptionalString(formData, "note");
  const orderId = readOptionalString(formData, "order_id");
  const descriptionParts = [
    `Skolepenger${yearLabel ? ` ${yearLabel}` : ""}`,
    className,
    methodLabels[payload.method],
    orderId ? `Ordre-ID ${orderId}` : null,
    note,
  ].filter(Boolean);

  await ensureStudentFee(supabase, payload.student_id, payload.school_year_id);

  const amount = Math.round(payload.amount_nok * 100);
  const { data: inserted, error } = await supabase
    .from("payments")
    .insert({
      student_id: payload.student_id,
      enrollment_id: enrollment?.id ?? null,
      school_year_id: payload.school_year_id,
      reference: `manual-${randomUUID()}`,
      psp_reference: orderId,
      amount,
      authorized_amount: amount,
      captured_amount: amount,
      refunded_amount: 0,
      description: descriptionParts.join(" · "),
      status: "fanget",
      method: payload.method,
      paid_at: payload.paid_at,
      captured_at: payload.paid_at,
    } as never)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const paymentId = (inserted as unknown as { id: string }).id;
  await allocatePayment(supabase, paymentId);

  revalidate();
  return { ok: true, id: paymentId };
}

type BatchEnrollment = {
  id: string;
  student_id: string;
  price_snapshot: number | null;
  classes: { name_no: string | null; price: number | null } | null;
  students: {
    child_first_name: string | null;
    child_last_name: string | null;
    mother_first_name: string | null;
    mother_last_name: string | null;
    father_first_name: string | null;
    father_last_name: string | null;
    child_email: string | null;
    mother_email: string | null;
    father_email: string | null;
    child_phone: string | null;
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
      "id, student_id, price_snapshot, classes(name_no, price), students(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_email, mother_email, father_email, child_phone)",
    )
    .eq("school_year_id", schoolYearId)
    .eq("status", "aktiv");
  const enrollments = (enr as unknown as BatchEnrollment[] | null) ?? [];

  const { data: pays } = await supabase
    .from("payments")
    .select("id, student_id, status, redirect_url, amount")
    .eq("school_year_id", schoolYearId);
  const payments = (pays as unknown as BatchPayment[] | null) ?? [];

  const balances = await fetchBalances(supabase, schoolYearId);
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
    const balance = balances.get(balanceKey(e.student_id, schoolYearId));
    if (balance && balance.owed > 0 && balance.remaining <= 0) {
      alreadyPaid++;
      continue;
    }
    const recipients = st ? guardianEmails(st) : [];
    if (recipients.length === 0) {
      noEmail++;
      continue;
    }
    const className = e.classes?.name_no ?? null;

    const pending = pendingByStudent.get(e.student_id);
    if (pending) {
      const ok = await sendPaymentLinkEmail({
        to: recipients,
        guardianName: st ? guardianName(st) ?? "" : "",
        childName: st ? studentDisplayName(st) : "",
        amount: pending.amount,
        schoolYear: yearLabel,
        className,
        url: `${siteUrl}/api/vipps/pay/${pending.id}`,
      });
      if (ok) sent++;
      else failed++;
      continue;
    }

    const price = e.price_snapshot ?? e.classes?.price ?? yearFee;
    const remaining = balance?.remaining ?? 0;
    if (remaining <= 0 && price == null) {
      noPrice++;
      continue;
    }
    const amount = remaining > 0 ? remaining : Math.round((price as number) * 100);
    const reference = `isk-${randomUUID()}`;
    const returnUrl = `${siteUrl}/api/vipps/return?reference=${reference}`;

    try {
      const result = await createPayment({
        reference,
        amount,
        description,
        returnUrl,
        phoneNumber: st?.child_phone,
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
        guardianName: st ? guardianName(st) ?? "" : "",
        childName: st ? studentDisplayName(st) : "",
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
    .select("id, label, fee")
    .eq("is_active", true)
    .maybeSingle();
  const activeYear = active as unknown as {
    id: string;
    label: string;
    fee: number | null;
  } | null;
  if (!activeYear) return { ok: false, error: "Ingen aktivt skoleår er satt" };
  if (activeYear.id === fromYearId) {
    return { ok: false, error: "Dette er allerede det aktive skoleåret" };
  }

  const { data: src } = await supabase
    .from("enrollments")
    .select("student_id, class_id, price_snapshot")
    .eq("school_year_id", fromYearId)
    .eq("status", "aktiv");
  const source =
    (src as unknown as {
      student_id: string;
      class_id: string;
      price_snapshot: number | null;
    }[] | null) ?? [];

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

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, capacity, price");
  const classInfo = new Map(
    (
      (classRows as unknown as {
        id: string;
        capacity: number | null;
        price: number | null;
      }[] | null) ?? []
    ).map((c) => [c.id, c]),
  );

  const targetCounts = new Map<string, number>();
  for (const e of (existing as unknown as { class_id: string }[] | null) ?? []) {
    targetCounts.set(e.class_id, (targetCounts.get(e.class_id) ?? 0) + 1);
  }

  let moved = 0;
  let skipped = 0;
  let full = 0;
  for (const s of source) {
    const key = `${s.student_id}:${s.class_id}`;
    if (existingPairs.has(key)) {
      skipped++;
      continue;
    }
    const cls = classInfo.get(s.class_id);
    const capacity = cls?.capacity ?? null;
    if (capacity != null && (targetCounts.get(s.class_id) ?? 0) >= capacity) {
      full++;
      continue;
    }
    const priceSnapshot =
      s.price_snapshot ?? cls?.price ?? activeYear.fee ?? null;
    const { error } = await supabase.from("enrollments").insert({
      student_id: s.student_id,
      class_id: s.class_id,
      school_year_id: activeYear.id,
      status: "aktiv",
      price_snapshot: priceSnapshot,
    } as never);
    if (error) {
      skipped++;
      continue;
    }
    existingPairs.add(key);
    targetCounts.set(s.class_id, (targetCounts.get(s.class_id) ?? 0) + 1);
    moved++;
  }

  revalidate();
  const parts: string[] = [];
  if (skipped > 0) parts.push(`${skipped} var allerede plassert`);
  if (full > 0) parts.push(`${full} hoppet over (klassen er full)`);
  const note = parts.length ? parts.join(", ") : undefined;
  return { ok: true, moved, skipped: skipped + full, note };
}

async function getPaymentReference(
  paymentId: string,
): Promise<{
  reference: string;
  amount: number;
  authorizedAmount: number;
  capturedAmount: number;
  refundedAmount: number;
  method: string;
  status: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "reference, amount, authorized_amount, captured_amount, refunded_amount, method, status",
    )
    .eq("id", paymentId)
    .maybeSingle();
  const row = data as unknown as {
    reference: string;
    amount: number;
    authorized_amount: number;
    captured_amount: number;
    refunded_amount: number;
    method: string;
    status: string;
  } | null;
  if (!row) return null;
  return {
    reference: row.reference,
    amount: row.amount,
    authorizedAmount: row.authorized_amount,
    capturedAmount: row.captured_amount,
    refundedAmount: row.refunded_amount,
    method: row.method,
    status: row.status,
  };
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

  const capturableAmount = row.authorizedAmount - row.capturedAmount;
  if (capturableAmount <= 0) {
    return { ok: false, error: "Betalingen har ikke noe beløp som kan fanges" };
  }

  try {
    await capturePayment(row.reference, capturableAmount);
    await writeAudit({
      action: "payment.capture_requested",
      entityType: "payment",
      entityId: paymentId,
      metadata: { amount: capturableAmount },
    });
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

  const refundableAmount = row.capturedAmount - row.refundedAmount;
  if (refundableAmount <= 0) {
    return { ok: false, error: "Betalingen har ikke noe refunderbart beløp" };
  }

  try {
    await refundPayment(row.reference, refundableAmount);
    await writeAudit({
      action: "payment.refund_requested",
      entityType: "payment",
      entityId: paymentId,
      metadata: { amount: refundableAmount },
    });
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

export async function cancelVippsPayment(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };

  try {
    await cancelPayment(row.reference);
    await writeAudit({
      action: "payment.cancel_requested",
      entityType: "payment",
      entityId: paymentId,
    });
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

export async function sendPaymentLink(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "amount, due_date, school_years(label), enrollments(classes(name_no)), students(child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_email, mother_email, father_email)",
    )
    .eq("id", paymentId)
    .maybeSingle();

  const payment = data as unknown as {
    amount: number;
    due_date: string | null;
    school_years: { label: string } | null;
    enrollments: { classes: { name_no: string | null } | null } | null;
    students: {
      child_first_name: string | null;
      child_last_name: string | null;
      mother_first_name: string | null;
      mother_last_name: string | null;
      father_first_name: string | null;
      father_last_name: string | null;
      child_email: string | null;
      mother_email: string | null;
      father_email: string | null;
    } | null;
  } | null;

  if (!payment) return { ok: false, error: "Fant ikke betalingen" };
  const recipients = payment.students
    ? guardianEmails(payment.students)
    : [];
  if (recipients.length === 0) {
    return { ok: false, error: "Foresatt mangler e-postadresse" };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ok = await sendPaymentLinkEmail({
    to: recipients,
    guardianName: payment.students ? guardianName(payment.students) ?? "" : "",
    childName: payment.students
      ? studentDisplayName(payment.students)
      : "",
    amount: payment.amount,
    schoolYear: payment.school_years?.label ?? null,
    className: payment.enrollments?.classes?.name_no ?? null,
    dueDate: payment.due_date,
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
  const row = await getPaymentReference(id);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };
  if (
    row.capturedAmount > 0 ||
    row.status === "fanget" ||
    row.status === "refundert"
  ) {
    return {
      ok: false,
      error: "Registrerte betalinger kan ikke slettes. Bruk korrigering eller refusjon.",
    };
  }
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "payment.delete",
    entityType: "payment",
    entityId: id,
  });
  revalidate();
  return { ok: true, id };
}

export async function updateStudentFee(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const studentId = readString(formData, "student_id");
  const schoolYearId = readString(formData, "school_year_id");
  const amountNok = readNumber(formData, "amount_nok");
  const discountNok = readNumber(formData, "discount_nok") ?? 0;
  const note = readOptionalString(formData, "note");

  if (!studentId || !schoolYearId) {
    return { ok: false, error: "Mangler elev eller skoleår" };
  }
  if (amountNok == null || amountNok < 0) {
    return { ok: false, error: "Ugyldig beløp" };
  }
  if (discountNok < 0) {
    return { ok: false, error: "Ugyldig moderasjon" };
  }
  if (discountNok > amountNok) {
    return { ok: false, error: "Moderasjon kan ikke være større enn beløpet" };
  }

  const supabase = await createClient();
  await setStudentFee(supabase, studentId, schoolYearId, {
    amount: Math.round(amountNok * 100),
    discount: Math.round(discountNok * 100),
    note,
  });

  await writeAudit({
    action: "student_fee.update",
    entityType: "student_fee",
    entityId: studentId,
    metadata: { schoolYearId, amountNok, discountNok },
  });

  revalidate();
  return { ok: true, id: studentId };
}

export async function voidPayment(
  paymentId: string,
  reason: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const user = await getUser();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };
  if (
    row.method === "vipps" &&
    !row.reference.startsWith("manual-") &&
    (row.capturedAmount > 0 ||
      row.status === "fanget" ||
      row.status === "refundert")
  ) {
    return {
      ok: false,
      error: "En fanget Vipps-betaling må refunderes i Vipps og kan ikke annulleres lokalt.",
    };
  }

  const { error } = await supabase
    .from("payments")
    .update({
      voided_at: new Date().toISOString(),
      void_reason: reason,
      duplicate_reviewed_at: new Date().toISOString(),
      duplicate_reviewed_by: user?.email ?? null,
    } as never)
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "payment.void",
    entityType: "payment",
    entityId: paymentId,
    metadata: { reason },
  });

  revalidate();
  return { ok: true, id: paymentId };
}

export async function restorePayment(paymentId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("payments")
    .update({
      voided_at: null,
      void_reason: null,
      duplicate_of_payment_id: null,
    } as never)
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "payment.restore",
    entityType: "payment",
    entityId: paymentId,
  });

  revalidate();
  return { ok: true, id: paymentId };
}

export async function markPaymentAsDuplicate(
  paymentId: string,
  originalPaymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const user = await getUser();
  const now = new Date().toISOString();
  const row = await getPaymentReference(paymentId);
  if (!row) return { ok: false, error: "Fant ikke betalingen" };
  if (!row.reference.startsWith("manual-")) {
    return {
      ok: false,
      error: "Bare manuelt registrerte betalinger kan merkes som dobbeltføring.",
    };
  }

  const { error } = await supabase
    .from("payments")
    .update({
      voided_at: now,
      void_reason: "Dobbeltføring av Vipps-betaling",
      duplicate_of_payment_id: originalPaymentId,
      duplicate_reviewed_at: now,
      duplicate_reviewed_by: user?.email ?? null,
    } as never)
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "payment.mark_duplicate",
    entityType: "payment",
    entityId: paymentId,
    metadata: { originalPaymentId },
  });

  revalidate();
  return { ok: true, id: paymentId };
}

export async function keepPaymentAsSeparate(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const user = await getUser();

  const { error } = await supabase
    .from("payments")
    .update({
      duplicate_reviewed_at: new Date().toISOString(),
      duplicate_reviewed_by: user?.email ?? null,
    } as never)
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "payment.keep_separate",
    entityType: "payment",
    entityId: paymentId,
  });

  revalidate();
  return { ok: true, id: paymentId };
}

export async function reallocatePayment(
  paymentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  await allocatePayment(supabase, paymentId);
  revalidate();
  return { ok: true, id: paymentId };
}

export async function reallocateYearPayments(
  schoolYearId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();
  if (!schoolYearId) return { ok: false, error: "Mangler skoleår" };
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id")
    .eq("school_year_id", schoolYearId)
    .eq("status", "fanget")
    .is("voided_at", null)
    .order("created_at", { ascending: true });

  const ids = ((data as unknown as { id: string }[] | null) ?? []).map(
    (row) => row.id,
  );
  if (ids.length === 0) return { ok: true, count: 0 };

  for (const id of ids) {
    try {
      await allocatePayment(supabase, id);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Fordelingen feilet",
      };
    }
  }

  await writeAudit({
    action: "payment.reallocate_year",
    entityType: "school_year",
    entityId: schoolYearId,
    metadata: { payments: ids.length },
  });

  revalidate();
  return { ok: true, count: ids.length };
}

export async function updatePaymentAllocations(
  paymentId: string,
  rows: { studentId: string; amount: number }[],
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id, net_paid_amount, school_year_id")
    .eq("id", paymentId)
    .maybeSingle();

  const payment = paymentRow as unknown as {
    id: string;
    net_paid_amount: number;
    school_year_id: string | null;
  } | null;

  if (!payment) return { ok: false, error: "Fant ikke betalingen" };
  if (!payment.school_year_id) {
    return { ok: false, error: "Betalingen mangler skoleår" };
  }

  const cleaned = rows
    .map((row) => ({
      studentId: row.studentId,
      amount: Math.round(row.amount),
    }))
    .filter((row) => row.studentId && row.amount > 0);

  const unique = new Set(cleaned.map((row) => row.studentId));
  if (unique.size !== cleaned.length) {
    return { ok: false, error: "Samme elev er lagt til flere ganger" };
  }

  const total = cleaned.reduce((sum, row) => sum + row.amount, 0);
  if (total > payment.net_paid_amount) {
    return {
      ok: false,
      error: `Fordelt beløp (${(total / 100).toLocaleString("nb-NO")} kr) er større enn netto innbetalt beløp (${(payment.net_paid_amount / 100).toLocaleString("nb-NO")} kr)`,
    };
  }

  try {
    await replacePaymentAllocations(supabase, paymentId, cleaned);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fordelingen feilet",
    };
  }

  await writeAudit({
    action: "payment.allocate",
    entityType: "payment",
    entityId: paymentId,
    metadata: { rows: cleaned, total },
  });

  revalidate();
  return { ok: true, id: paymentId };
}
