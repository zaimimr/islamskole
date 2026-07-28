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

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };
type PasswordResult =
  | { ok: true; password: string; email?: string }
  | { ok: false; error: string };

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
  await writeAudit({ action: "event.delete", entityType: "events", entityId: id });
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
  await writeAudit({ action: "class.delete", entityType: "classes", entityId: id });
  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function updateSettings(formData: FormData): Promise<ActionResult> {
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
const studentStatusSchema = z.enum([
  "ny",
  "kontaktet",
  "akseptert",
  "avslatt",
  "arkivert",
]);

// Vipps ePayment paymentDescription is limited to 100 characters.
const VIPPS_DESCRIPTION_MAX = 100;

function buildEnrollmentDescription(
  yearLabel: string,
  childNames: string[],
): string {
  const names = childNames.filter((name) => name.trim() !== "");
  const prefix = `Innmelding ${yearLabel}`;
  if (names.length === 0) return prefix;

  const full = `${prefix} – ${names.join(", ")}`;
  if (full.length <= VIPPS_DESCRIPTION_MAX) return full;

  // Too long: keep the first name and summarise the rest.
  const summarised = `${prefix} – ${names[0]} +${names.length - 1} til`;
  if (summarised.length <= VIPPS_DESCRIPTION_MAX) return summarised;
  return summarised.slice(0, VIPPS_DESCRIPTION_MAX);
}

export async function createStudentEnrollment(
  formData: FormData,
): Promise<SignupResult> {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const limit = rateLimit(`apply:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return { ok: false, error: "For mange forsøk, prøv igjen senere." };
  }

  const termsAccepted = formData.get("terms_accepted") != null;
  if (!termsAccepted) {
    return {
      ok: false,
      fieldErrors: { terms_accepted: "Du må godta salgsbetingelsene" },
    };
  }

  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const phoneOk = (v: string) => /^\+?\d{8,15}$/.test(v.replace(/[\s-]/g, ""));
  const singleParent = formData.get("single_parent") != null;

  const readParent = (prefix: string) => {
    const first = readString(formData, `${prefix}_first_name`);
    const last = readString(formData, `${prefix}_last_name`);
    const email = readString(formData, `${prefix}_email`);
    const phone = readString(formData, `${prefix}_phone`);
    return {
      first,
      last,
      email,
      phone,
      complete: Boolean(first && last && emailOk(email) && phoneOk(phone)),
    };
  };
  const parents = { mother: readParent("mother"), father: readParent("father") };
  const parentErrors: Record<string, string> = {};

  if (singleParent) {
    if (!parents.mother.complete && !parents.father.complete) {
      parentErrors.parents =
        "Fyll ut navn, e-post og telefon for minst én foresatt";
    }
  } else {
    for (const prefix of ["mother", "father"] as const) {
      const p = parents[prefix];
      if (!p.first) parentErrors[`${prefix}_first_name`] = "Fornavn er påkrevd";
      if (!p.last) parentErrors[`${prefix}_last_name`] = "Etternavn er påkrevd";
      if (!p.email) parentErrors[`${prefix}_email`] = "E-post er påkrevd";
      else if (!emailOk(p.email))
        parentErrors[`${prefix}_email`] = "Ugyldig e-postadresse";
      if (!p.phone) parentErrors[`${prefix}_phone`] = "Telefon er påkrevd";
      else if (!phoneOk(p.phone))
        parentErrors[`${prefix}_phone`] = "Ugyldig telefonnummer";
    }
  }

  const address = readString(formData, "address");
  const postalCode = readString(formData, "postal_code");
  const city = readString(formData, "city");
  if (!address) parentErrors.address = "Adresse er påkrevd";
  if (!postalCode) parentErrors.postal_code = "Postnummer er påkrevd";
  if (!city) parentErrors.city = "Poststed er påkrevd";

  if (Object.keys(parentErrors).length > 0) {
    return { ok: false, fieldErrors: parentErrors };
  }

  const indices = readString(formData, "child_indices")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  if (indices.length === 0) {
    return { ok: false, error: "Legg til minst ett barn." };
  }

  const fieldErrors: Record<string, string> = {};
  const childPayloads: Record<string, unknown>[] = [];
  const childNames: string[] = [];

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

    childNames.push(`${childFirstName} ${childLastName}`.trim());
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
      mother_first_name: readOptionalString(formData, "mother_first_name"),
      mother_last_name: readOptionalString(formData, "mother_last_name"),
      mother_phone: readOptionalString(formData, "mother_phone"),
      mother_email: readOptionalString(formData, "mother_email"),
      father_first_name: readOptionalString(formData, "father_first_name"),
      father_last_name: readOptionalString(formData, "father_last_name"),
      father_phone: readOptionalString(formData, "father_phone"),
      father_email: readOptionalString(formData, "father_email"),
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
    .select("id, label, fee")
    .eq("is_active", true)
    .maybeSingle();
  const year = yearRow as unknown as {
    id: string;
    label: string;
    fee: number | null;
  } | null;
  if (!year?.fee) {
    return {
      ok: false,
      error: "Innmelding er ikke åpen ennå. Ta kontakt med skolen.",
    };
  }

  const reference = `isk-${randomUUID()}`;
  const amount = year.fee * 100 * childPayloads.length;
  const description = buildEnrollmentDescription(year.label, childNames);

  const { data: paymentRow, error: paymentError } = await admin
    .from("payments")
    .insert({
      school_year_id: year.id,
      reference,
      amount,
      currency: "NOK",
      method: "vipps",
      status: "opprettet",
      description,
    } as never)
    .select("id")
    .single();

  if (paymentError || !paymentRow) {
    console.error("createStudentEnrollment payment error", paymentError);
    return {
      ok: false,
      error: "Noe gikk galt under registreringen. Prøv igjen senere.",
    };
  }

  const paymentId = (paymentRow as unknown as { id: string }).id;

  const { error: insertError } = await admin
    .from("student_applications")
    .insert(childPayloads.map((row) => ({ ...row, payment_id: paymentId })) as never);

  if (insertError) {
    console.error("createStudentEnrollment insert error", insertError);
    await admin.from("payments").delete().eq("id", paymentId);
    return {
      ok: false,
      error: "Noe gikk galt under registreringen. Prøv igjen senere.",
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
