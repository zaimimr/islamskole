"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsAdmin } from "@/lib/auth";
import { getSiteSettings } from "@/lib/data";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  sendTeacherApplicationEmail,
  sendTeacherApplicationConfirmationEmail,
} from "@/lib/email";
import type { Json } from "@/lib/supabase/types";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };
type PasswordResult =
  { ok: true; password: string; email?: string } | { ok: false; error: string };

function generatePassword() {
  const raw = randomBytes(12)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12)
    .padEnd(12, "x");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function requireAdmin() {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) throw new Error("Ikke autorisert");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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

function readBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function readDateTime(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const eventSchema = z.object({
  title_no: z.string().min(1, "Tittel (norsk) er påkrevd"),
  starts_at: z.string().min(1, "Startdato er påkrevd"),
});

const classSchema = z.object({
  name_no: z.string().min(1, "Navn (norsk) er påkrevd"),
});

function revalidateAdminAndSite() {
  revalidatePath("/", "layout");
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const titleNo = readString(formData, "title_no");
  const startsAt = readDateTime(formData, "starts_at");

  const parsed = eventSchema.safeParse({
    title_no: titleNo,
    starts_at: startsAt ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const slugInput = readString(formData, "slug");
  const slug = slugInput === "" ? slugify(titleNo) : slugify(slugInput);

  const payload = {
    slug,
    title_no: titleNo,
    title_en: readOptionalString(formData, "title_en"),
    excerpt_no: readOptionalString(formData, "excerpt_no"),
    excerpt_en: readOptionalString(formData, "excerpt_en"),
    body_no: readOptionalString(formData, "body_no"),
    body_en: readOptionalString(formData, "body_en"),
    location: readOptionalString(formData, "location"),
    starts_at: startsAt,
    ends_at: readDateTime(formData, "ends_at"),
    image_url: readOptionalString(formData, "image_url"),
    published: readBoolean(formData, "published"),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const eventId = (data as unknown as { id: string }).id;
  await writeAudit({
    action: "event.create",
    entityType: "events",
    entityId: eventId,
    metadata: { title_no: titleNo, slug, published: payload.published },
  });

  revalidateAdminAndSite();
  return { ok: true, id: eventId };
}

export async function updateEvent(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const titleNo = readString(formData, "title_no");
  const startsAt = readDateTime(formData, "starts_at");

  const parsed = eventSchema.safeParse({
    title_no: titleNo,
    starts_at: startsAt ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const slugInput = readString(formData, "slug");
  const slug = slugInput === "" ? slugify(titleNo) : slugify(slugInput);

  const payload = {
    slug,
    title_no: titleNo,
    title_en: readOptionalString(formData, "title_en"),
    excerpt_no: readOptionalString(formData, "excerpt_no"),
    excerpt_en: readOptionalString(formData, "excerpt_en"),
    body_no: readOptionalString(formData, "body_no"),
    body_en: readOptionalString(formData, "body_en"),
    location: readOptionalString(formData, "location"),
    starts_at: startsAt,
    ends_at: readDateTime(formData, "ends_at"),
    image_url: readOptionalString(formData, "image_url"),
    published: readBoolean(formData, "published"),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update(payload as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "event.update",
    entityType: "events",
    entityId: id,
    metadata: { title_no: titleNo, slug, published: payload.published },
  });

  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "event.delete",
    entityType: "events",
    entityId: id,
  });
  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function createClass(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const nameNo = readString(formData, "name_no");

  const parsed = classSchema.safeParse({ name_no: nameNo });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const slugInput = readString(formData, "slug");
  const slug = slugInput === "" ? slugify(nameNo) : slugify(slugInput);

  const payload = {
    slug,
    name_no: nameNo,
    name_en: readOptionalString(formData, "name_en"),
    age_min: readNumber(formData, "age_min"),
    age_max: readNumber(formData, "age_max"),
    capacity: readNumber(formData, "capacity"),
    price: readNumber(formData, "price"),
    description_no: readOptionalString(formData, "description_no"),
    description_en: readOptionalString(formData, "description_en"),
    curriculum_no: readOptionalString(formData, "curriculum_no"),
    curriculum_en: readOptionalString(formData, "curriculum_en"),
    image_url: readOptionalString(formData, "image_url"),
    published: readBoolean(formData, "published"),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const classId = (data as unknown as { id: string }).id;
  await writeAudit({
    action: "class.create",
    entityType: "classes",
    entityId: classId,
    metadata: { name_no: nameNo, slug, published: payload.published },
  });

  revalidateAdminAndSite();
  return { ok: true, id: classId };
}

export async function updateClass(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const nameNo = readString(formData, "name_no");

  const parsed = classSchema.safeParse({ name_no: nameNo });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const slugInput = readString(formData, "slug");
  const slug = slugInput === "" ? slugify(nameNo) : slugify(slugInput);

  const payload = {
    slug,
    name_no: nameNo,
    name_en: readOptionalString(formData, "name_en"),
    age_min: readNumber(formData, "age_min"),
    age_max: readNumber(formData, "age_max"),
    capacity: readNumber(formData, "capacity"),
    price: readNumber(formData, "price"),
    description_no: readOptionalString(formData, "description_no"),
    description_en: readOptionalString(formData, "description_en"),
    curriculum_no: readOptionalString(formData, "curriculum_no"),
    curriculum_en: readOptionalString(formData, "curriculum_en"),
    image_url: readOptionalString(formData, "image_url"),
    published: readBoolean(formData, "published"),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update(payload as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "class.update",
    entityType: "classes",
    entityId: id,
    metadata: { name_no: nameNo, slug, published: payload.published },
  });

  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function deleteClass(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "class.delete",
    entityType: "classes",
    entityId: id,
  });
  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function updateSettings(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const payload = {
    id: true,
    contact_email: readOptionalString(formData, "contact_email"),
    enroll_email: readOptionalString(formData, "enroll_email"),
    address: readOptionalString(formData, "address"),
    hours: readOptionalString(formData, "hours"),
    facebook_url: readOptionalString(formData, "facebook_url"),
    instagram_url: readOptionalString(formData, "instagram_url"),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(payload as never);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "settings.update",
    entityType: "site_settings",
    metadata: {
      contact_email: payload.contact_email,
      enroll_email: payload.enroll_email,
    },
  });

  revalidateAdminAndSite();
  return { ok: true };
}

const MIN_FILL_MS = 3_000;

function isLikelyBot(formData: FormData): boolean {
  const honeypot = readOptionalString(formData, "company");
  if (honeypot) return true;

  const loadedAt = Number(formData.get("loaded_at"));
  if (!Number.isFinite(loadedAt) || Date.now() - loadedAt < MIN_FILL_MS) {
    return true;
  }

  return false;
}

const teacherApplicationSchema = z.object({
  full_name: z.string().min(1, "Navn er påkrevd"),
  email: z.string().min(1, "E-post er påkrevd").email("Ugyldig e-postadresse"),
});

const teacherStatusSchema = z.enum(["ny", "kontaktet", "arkivert"]);

export async function createTeacherApplication(
  formData: FormData,
): Promise<ActionResult> {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const limit = rateLimit(`apply:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return { ok: false, error: "For mange forsøk, prøv igjen senere." };
  }

  if (isLikelyBot(formData)) {
    return { ok: true };
  }

  const fullName = readString(formData, "full_name");
  const email = readString(formData, "email");

  const parsed = teacherApplicationSchema.safeParse({
    full_name: fullName,
    email,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const payload = {
    full_name: fullName,
    email,
    phone: readOptionalString(formData, "phone"),
    subjects: readOptionalString(formData, "subjects"),
    message: readOptionalString(formData, "message"),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_applications")
    .insert(payload as never);

  if (error) return { ok: false, error: error.message };

  {
    const settings = await getSiteSettings();
    await sendTeacherApplicationEmail({
      to: settings?.contact_email ?? "baerum@islamskole.no",
      fullName,
      replyTo: email,
      rows: [
        ["Navn", fullName],
        ["E-post", email],
        ["Telefon", payload.phone],
        ["Fag / interesse", payload.subjects],
        ["Melding", payload.message],
      ],
    });
    await sendTeacherApplicationConfirmationEmail({
      to: email,
      fullName,
      lang: "no",
    });
  }

  return { ok: true };
}

export async function updateTeacherApplicationStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = teacherStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: "Ugyldig status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_applications")
    .update({ status: parsed.data } as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "teacher.status",
    entityType: "teacher_applications",
    entityId: id,
    metadata: { status: parsed.data },
  });

  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteTeacherApplication(
  id: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_applications")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "teacher.delete",
    entityType: "teacher_applications",
    entityId: id,
  });
  revalidatePath("/", "layout");
  return { ok: true, id };
}

type SignupResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const enrollChildSchema = z.object({
  child_first_name: z.string().min(1, "Barnets fornavn er påkrevd"),
  child_last_name: z.string().min(1, "Barnets etternavn er påkrevd"),
  birth_date: z.string().min(1, "Fødselsdato er påkrevd"),
  gender: z.string().min(1, "Kjønn er påkrevd"),
  email: z.union([z.literal(""), z.string().email("Ugyldig e-postadresse")]),
});
const enrollGuardianSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z
    .string()
    .refine((value) => /^\+?\d{8,15}$/.test(value.replace(/[\s-]/g, ""))),
  role: z.enum(["foresatt", "mor", "far", "steforelder", "verge", "annet"]),
});
const studentStatusSchema = z.enum([
  "ny",
  "kontaktet",
  "akseptert",
  "avslatt",
  "arkivert",
]);

export async function createStudentEnrollment(
  formData: FormData,
): Promise<SignupResult> {
  const english = readString(formData, "locale") === "en";
  const copy = english
    ? {
        rateLimit: "Too many attempts. Please try again later.",
        terms: "You must accept the terms of sale",
        required: "This field is required",
        email: "Enter a valid email address",
        phone: "Enter a valid phone number",
        guardians: "Add at least one guardian.",
        children: "Add at least one child.",
        unavailable: "Enrollment is not open yet. Please contact the school.",
        failed:
          "Something went wrong during enrollment. Please try again later.",
      }
    : {
        rateLimit: "For mange forsøk, prøv igjen senere.",
        terms: "Du må godta salgsbetingelsene",
        required: "Dette feltet er påkrevd",
        email: "Skriv inn en gyldig e-postadresse",
        phone: "Skriv inn et gyldig telefonnummer",
        guardians: "Legg til minst én foresatt.",
        children: "Legg til minst ett barn.",
        unavailable: "Innmelding er ikke åpen ennå. Ta kontakt med skolen.",
        failed: "Noe gikk galt under registreringen. Prøv igjen senere.",
      };
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const limit = rateLimit(`apply:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return { ok: false, error: copy.rateLimit };
  }

  const termsAccepted = formData.get("terms_accepted") != null;
  if (!termsAccepted) {
    return {
      ok: false,
      fieldErrors: { terms_accepted: copy.terms },
    };
  }

  const parentErrors: Record<string, string> = {};
  const guardianIndices = Array.from(
    new Set(
      readString(formData, "guardian_indices")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^\d+$/.test(value)),
    ),
  ).slice(0, 6);
  if (guardianIndices.length === 0) {
    return { ok: false, error: copy.guardians };
  }

  const guardians: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: z.infer<typeof enrollGuardianSchema>["role"];
    isPrimary: boolean;
  }[] = [];

  for (const [index, id] of guardianIndices.entries()) {
    const payload = {
      first_name: readString(formData, `guardian_${id}_first_name`),
      last_name: readString(formData, `guardian_${id}_last_name`),
      email: readString(formData, `guardian_${id}_email`),
      phone: readString(formData, `guardian_${id}_phone`),
      role: readString(formData, `guardian_${id}_role`),
    };
    const parsed = enrollGuardianSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "");
        const key = `guardian_${id}_${field}`;
        if (field === "email") parentErrors[key] = copy.email;
        else if (field === "phone") parentErrors[key] = copy.phone;
        else parentErrors[key] = copy.required;
      }
      continue;
    }
    guardians.push({
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      role: parsed.data.role,
      isPrimary: index === 0,
    });
  }

  const address = readString(formData, "address");
  const postalCode = readString(formData, "postal_code");
  const city = readString(formData, "city");
  if (!address) parentErrors.address = copy.required;
  if (!postalCode) parentErrors.postal_code = copy.required;
  if (!city) parentErrors.city = copy.required;

  if (Object.keys(parentErrors).length > 0) {
    return { ok: false, fieldErrors: parentErrors };
  }

  const indices = Array.from(
    new Set(
      readString(formData, "child_indices")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^\d+$/.test(value)),
    ),
  ).slice(0, 10);
  if (indices.length === 0) {
    return { ok: false, error: copy.children };
  }

  const fieldErrors: Record<string, string> = {};
  const childPayloads: Json[] = [];
  const primaryGuardian = guardians[0]!;
  const motherGuardian =
    guardians.find((guardian) => guardian.role === "mor") ?? primaryGuardian;
  const fatherGuardian =
    guardians.find((guardian) => guardian.role === "far") ??
    guardians.find((guardian) => guardian !== motherGuardian) ??
    null;

  for (const i of indices) {
    const childFirstName = readString(formData, `child_${i}_child_first_name`);
    const childLastName = readString(formData, `child_${i}_child_last_name`);
    const birthDate = readString(formData, `child_${i}_birth_date`);
    const gender = readString(formData, `child_${i}_gender`);
    const childEmail = readString(formData, `child_${i}_email`);

    const parsed = enrollChildSchema.safeParse({
      child_first_name: childFirstName,
      child_last_name: childLastName,
      birth_date: birthDate,
      gender,
      email: childEmail,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        const scoped = `child_${i}_${key === "email" ? "email" : key}`;
        if (key && !(scoped in fieldErrors)) {
          fieldErrors[scoped] = issue.message;
        }
      }
      continue;
    }

    childPayloads.push({
      child_first_name: childFirstName,
      child_last_name: childLastName,
      child_birth_date: birthDate || null,
      child_gender: gender || null,
      child_address: address,
      child_postal_code: postalCode,
      child_city: city,
      child_email: childEmail || null,
      child_phone: readOptionalString(formData, `child_${i}_phone`),
      mother_first_name: motherGuardian.firstName,
      mother_last_name: motherGuardian.lastName,
      mother_phone: motherGuardian.phone,
      mother_email: motherGuardian.email,
      father_first_name: fatherGuardian?.firstName ?? null,
      father_last_name: fatherGuardian?.lastName ?? null,
      father_phone: fatherGuardian?.phone ?? null,
      father_email: fatherGuardian?.email ?? null,
      desired_class: readOptionalString(formData, `child_${i}_desired_class`),
      child_level_quran: readOptionalString(formData, `child_${i}_level_quran`),
      child_level_arabic: readOptionalString(
        formData,
        `child_${i}_level_arabic`,
      ),
      child_level_islam: readOptionalString(formData, `child_${i}_level_islam`),
      message: readOptionalString(formData, `child_${i}_message`),
      terms_accepted: termsAccepted,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const admin = createAdminClient();

  const { data: yearRow } = await admin
    .from("school_years")
    .select("id, label, fee, enrollment_fee")
    .eq("is_active", true)
    .maybeSingle();
  const year = yearRow as unknown as {
    id: string;
    label: string;
    fee: number | null;
    enrollment_fee: number | null;
  } | null;
  if (!year?.fee) {
    return {
      ok: false,
      error: copy.unavailable,
    };
  }

  const reference = `isk-${randomUUID()}`;
  const depositNok = Math.min(year.enrollment_fee ?? year.fee, year.fee);
  const amount = depositNok * 100 * childPayloads.length;
  const description = `Innmelding ${year.label} - ${childPayloads.length} barn`;

  const { data: enrollment, error: enrollmentError } = await admin.rpc(
    "create_public_family_enrollment",
    {
      p_school_year_id: year.id,
      p_reference: reference,
      p_amount: amount,
      p_description: description,
      p_address: address,
      p_postal_code: postalCode,
      p_city: city,
      p_guardians: guardians.map((guardian) => ({
        first_name: guardian.firstName,
        last_name: guardian.lastName,
        email: guardian.email,
        phone: guardian.phone,
        role: guardian.role,
      })),
      p_children: childPayloads,
    },
  );

  const paymentId =
    enrollment &&
    typeof enrollment === "object" &&
    !Array.isArray(enrollment) &&
    typeof enrollment.payment_id === "string"
      ? enrollment.payment_id
      : null;

  if (enrollmentError || !paymentId) {
    console.error("createStudentEnrollment transaction error", enrollmentError);
    return {
      ok: false,
      error: copy.failed,
    };
  }

  return { ok: true, redirectUrl: `/api/vipps/pay/${paymentId}` };
}

export async function updateStudentApplicationStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = studentStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: "Ugyldig status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_applications")
    .update({ status: parsed.data } as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "application.status",
    entityType: "student_applications",
    entityId: id,
    metadata: { status: parsed.data },
  });

  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteStudentApplication(
  id: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_applications")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "application.delete",
    entityType: "student_applications",
    entityId: id,
  });
  revalidatePath("/", "layout");
  return { ok: true, id };
}

const createUserSchema = z.object({
  email: z.string().min(1, "E-post er påkrevd").email("Ugyldig e-postadresse"),
});

export async function createUser(formData: FormData): Promise<PasswordResult> {
  await requireAdmin();
  const email = readString(formData, "email");
  const fullName = readOptionalString(formData, "full_name");

  const parsed = createUserSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const password = generatePassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? "", role: "admin" },
  });

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "user.create",
    entityType: "users",
    metadata: { email },
  });

  revalidatePath("/", "layout");
  return { ok: true, password, email };
}

export async function resetUserPassword(
  userId: string,
): Promise<PasswordResult> {
  await requireAdmin();
  const password = generatePassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "user.reset_password",
    entityType: "users",
    entityId: userId,
  });
  return { ok: true, password };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === userId) {
    return { ok: false, error: "Du kan ikke slette din egen konto" };
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "user.delete",
    entityType: "users",
    entityId: userId,
  });
  revalidatePath("/", "layout");
  return { ok: true, id: userId };
}

export async function changeOwnPassword(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Du er ikke innlogget" };

  const password = readString(formData, "password");
  const confirm = readString(formData, "confirm");
  if (password.length < 8) {
    return { ok: false, error: "Passordet må ha minst 8 tegn" };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passordene er ikke like" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderClasses(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Ingen rekkefølge å lagre" };
  }
  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("classes")
        .update({ sort_order: (index + 1) * 10 } as never)
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkUpdateApplicationStatus(
  ids: string[],
  status: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Ingen påmeldinger valgt" };
  }
  const parsed = studentStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: "Ugyldig status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_applications")
    .update({ status: parsed.data } as never)
    .in("id", ids);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "application.bulk_status",
    entityType: "student_applications",
    metadata: { count: ids.length, status: parsed.data },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bulkUpdateTeacherStatus(
  ids: string[],
  status: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Ingen søknader valgt" };
  }
  const parsed = teacherStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, error: "Ugyldig status" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_applications")
    .update({ status: parsed.data } as never)
    .in("id", ids);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    action: "teacher.bulk_status",
    entityType: "teacher_applications",
    metadata: { count: ids.length, status: parsed.data },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
