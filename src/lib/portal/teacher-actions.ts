"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getPortalContext } from "@/lib/portal/data";
import { createClient } from "@/lib/supabase/server";
import type { PortalActionResult } from "@/lib/portal/types";

const uuid = z.string().uuid();

export async function deleteClassNote(lessonId: string): Promise<PortalActionResult> {
  if (!uuid.safeParse(lessonId).success) return { ok: false, error: "invalid" };
  const context = await getPortalContext();
  if (!context.user) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_notes")
    .delete()
    .eq("lesson_id", lessonId)
    .select("id, class_id, school_day_id");
  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "unknown" };

  if (data?.length) {
    await writeAudit({
      action: "class_note.delete",
      entityType: "class_note",
      entityId: data[0].id,
      metadata: { class_id: data[0].class_id, school_day_id: data[0].school_day_id, lesson_id: lessonId },
    });
  }
  revalidatePath("/[locale]/min-side", "layout");
  return { ok: true };
}

export async function startSubstitute(classId: string): Promise<PortalActionResult> {
  if (!uuid.safeParse(classId).success) return { ok: false, error: "invalid" };
  const context = await getPortalContext();
  if (!context.user) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_start_substitute", { p_class_id: classId });
  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "unknown" };

  await writeAudit({
    action: "class_substitute.start",
    entityType: "class",
    entityId: classId,
    metadata: { until: data },
  });
  revalidatePath("/[locale]/min-side", "layout");
  return { ok: true };
}

export async function endSubstitute(classId: string): Promise<PortalActionResult> {
  if (!uuid.safeParse(classId).success) return { ok: false, error: "invalid" };
  const context = await getPortalContext();
  if (!context.user) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_end_substitute", { p_class_id: classId });
  if (error) return { ok: false, error: "unknown" };

  await writeAudit({ action: "class_substitute.end", entityType: "class", entityId: classId });
  revalidatePath("/[locale]/min-side", "layout");
  return { ok: true };
}
