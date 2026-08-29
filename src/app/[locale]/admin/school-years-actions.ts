"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

function readBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
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

const schoolYearSchema = z.object({
  label: z.string().min(1, "Navn er påkrevd (f.eks. 2026/2027)"),
});

async function clearActive() {
  const supabase = await createClient();
  await supabase
    .from("school_years")
    .update({ is_active: false } as never)
    .eq("is_active", true);
}

export async function createSchoolYear(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const label = readString(formData, "label");

  const parsed = schoolYearSchema.safeParse({ label });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const isActive = readBoolean(formData, "is_active");
  if (isActive) await clearActive();

  const payload = {
    label,
    starts_on: readOptionalString(formData, "starts_on"),
    ends_on: readOptionalString(formData, "ends_on"),
    fee: readNumber(formData, "fee"),
    enrollment_fee: readNumber(formData, "enrollment_fee") ?? 2000,
    sem1_due_on: readOptionalString(formData, "sem1_due_on"),
    sem2_due_on: readOptionalString(formData, "sem2_due_on"),
    is_active: isActive,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_years")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Det finnes allerede et skoleår med dette navnet" };
    }
    return { ok: false, error: error.message };
  }
  const schoolYearId = (data as unknown as { id: string }).id;
  await writeAudit({
    action: "school_year.create",
    entityType: "school_years",
    entityId: schoolYearId,
    metadata: { label, is_active: isActive },
  });
  revalidate();
  return { ok: true, id: schoolYearId };
}

export async function updateSchoolYear(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const label = readString(formData, "label");

  const parsed = schoolYearSchema.safeParse({ label });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const isActive = readBoolean(formData, "is_active");
  if (isActive) await clearActive();

  const payload = {
    label,
    starts_on: readOptionalString(formData, "starts_on"),
    ends_on: readOptionalString(formData, "ends_on"),
    fee: readNumber(formData, "fee"),
    enrollment_fee: readNumber(formData, "enrollment_fee") ?? 2000,
    sem1_due_on: readOptionalString(formData, "sem1_due_on"),
    sem2_due_on: readOptionalString(formData, "sem2_due_on"),
    is_active: isActive,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("school_years")
    .update(payload as never)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Det finnes allerede et skoleår med dette navnet" };
    }
    return { ok: false, error: error.message };
  }
  await writeAudit({
    action: "school_year.update",
    entityType: "school_years",
    entityId: id,
    metadata: { label, is_active: isActive },
  });
  revalidate();
  return { ok: true, id };
}

export async function setActiveSchoolYear(id: string): Promise<ActionResult> {
  await requireAdmin();
  await clearActive();
  const supabase = await createClient();
  const { error } = await supabase
    .from("school_years")
    .update({ is_active: true } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({
    action: "school_year.activate",
    entityType: "school_years",
    entityId: id,
  });
  revalidate();
  return { ok: true, id };
}

export async function deleteSchoolYear(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("school_years").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Kan ikke slette: skoleåret har elever plassert i klasser",
      };
    }
    return { ok: false, error: error.message };
  }
  await writeAudit({
    action: "school_year.delete",
    entityType: "school_years",
    entityId: id,
  });
  revalidate();
  return { ok: true, id };
}
