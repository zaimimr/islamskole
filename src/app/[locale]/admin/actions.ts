"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

  revalidateAdminAndSite();
  return { ok: true, id: (data as unknown as { id: string }).id };
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

  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
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
    description_no: readOptionalString(formData, "description_no"),
    description_en: readOptionalString(formData, "description_en"),
    curriculum_no: readOptionalString(formData, "curriculum_no"),
    curriculum_en: readOptionalString(formData, "curriculum_en"),
    image_url: readOptionalString(formData, "image_url"),
    sort_order: readNumber(formData, "sort_order") ?? 0,
    published: readBoolean(formData, "published"),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidateAdminAndSite();
  return { ok: true, id: (data as unknown as { id: string }).id };
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
    description_no: readOptionalString(formData, "description_no"),
    description_en: readOptionalString(formData, "description_en"),
    curriculum_no: readOptionalString(formData, "curriculum_no"),
    curriculum_en: readOptionalString(formData, "curriculum_en"),
    image_url: readOptionalString(formData, "image_url"),
    sort_order: readNumber(formData, "sort_order") ?? 0,
    published: readBoolean(formData, "published"),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update(payload as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function deleteClass(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAdminAndSite();
  return { ok: true, id };
}

export async function updateInfoBlock(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const payload = {
    title_no: readOptionalString(formData, "title_no"),
    title_en: readOptionalString(formData, "title_en"),
    body_no: readOptionalString(formData, "body_no"),
    body_en: readOptionalString(formData, "body_en"),
    image_url: readOptionalString(formData, "image_url"),
    sort_order: readNumber(formData, "sort_order") ?? 0,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("info_blocks")
    .update(payload as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

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

  revalidateAdminAndSite();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
