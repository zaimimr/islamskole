"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { findAuthUserId, sendLoginLink } from "@/lib/login-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/portal/data";
import { isPlaceholderEmail } from "@/lib/portal/emails";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type PortalActionResult,
  type PortalErrorCode,
} from "@/lib/portal/types";

const MIN_FILL_MS = 2_000;
const uuid = z.string().uuid();
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

function dbError(error: { code?: string } | null | undefined): PortalErrorCode {
  switch (error?.code) {
    case "23505":
      return "duplicate";
    case "42501":
      return "forbidden";
    case "23503":
      return "not_found";
    default:
      return "unknown";
  }
}

function refreshPortal() {
  revalidatePath("/[locale]/min-side", "layout");
}

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function allowLogin(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("portal_login_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("portal login throttle failed", error);
    return false;
  }
  return data === true;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function isKnownEmail(email: string) {
  const admin = createAdminClient();
  const pattern = escapeLike(email);
  const [guardians, students] = await Promise.all([
    admin.from("guardians").select("id").ilike("email", pattern).limit(1),
    admin.from("students").select("id").ilike("child_email", pattern).limit(1),
  ]);
  if (guardians.error || students.error) {
    console.error("portal login lookup failed", guardians.error ?? students.error);
    return false;
  }
  if (guardians.data?.length || students.data?.length) return true;
  const userId = await findAuthUserId(email);
  if (!userId) return false;
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return profile?.role === "admin";
}

async function deliverLoginLink(email: string, locale: "no" | "en", next: string | undefined) {
  try {
    if (isPlaceholderEmail(email)) return;
    if (!(await allowLogin(`email:${email}`, 3, 600))) return;
    if (!(await isKnownEmail(email))) return;
    if (!(await allowLogin("global:known", 60, 3600))) {
      console.error("portal login global limit reached");
      return;
    }
    const result = await sendLoginLink({ email, locale, next });
    if (!result.ok) console.error("portal login link failed", result.error);
  } catch (error) {
    console.error("portal login failed", error);
  }
}

export async function sendPortalLoginLink(formData: FormData): Promise<PortalActionResult> {
  const ip = await clientIp();
  if (!(await allowLogin(`ip:${ip}`, 5, 60))) {
    return { ok: false, error: "rate_limited" };
  }

  if (String(formData.get("hp_field_t") ?? "").trim()) return { ok: true };
  const loadedAt = Number(formData.get("loaded_at"));
  if (!Number.isFinite(loadedAt) || Date.now() - loadedAt < MIN_FILL_MS) {
    return { ok: true };
  }

  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: "invalid" };

  const locale = formData.get("locale") === "en" ? "en" : "no";
  const next = String(formData.get("next") ?? "") || undefined;
  after(() => deliverLoginLink(parsed.data, locale, next));
  return { ok: true };
}

export async function signOutPortal(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

async function lessonContext(lessonId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select("id, class_id, school_day_id")
    .eq("id", lessonId)
    .maybeSingle();
  return { supabase, lesson: data };
}

const markAttendanceSchema = z.object({
  studentId: uuid,
  lessonId: uuid,
  status: z.enum(ATTENDANCE_STATUSES),
});

export async function markAttendance(
  studentId: string,
  lessonId: string,
  status: AttendanceStatus,
): Promise<PortalActionResult> {
  const parsed = markAttendanceSchema.safeParse({ studentId, lessonId, status });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { supabase, lesson } = await lessonContext(parsed.data.lessonId);
  if (!lesson) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        student_id: parsed.data.studentId,
        lesson_id: lesson.id,
        school_day_id: lesson.school_day_id,
        status: parsed.data.status,
        marked_by: user.id,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lesson_id" },
    )
    .select("student_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error ? dbError(error) : "forbidden" };

  await writeAudit({
    action: "attendance.mark",
    entityType: "attendance",
    entityId: parsed.data.studentId,
    metadata: { lesson_id: lesson.id, school_day_id: lesson.school_day_id, status: parsed.data.status },
  });
  refreshPortal();
  return { ok: true };
}

const markManySchema = z.object({
  studentIds: z.array(uuid).min(1).max(200),
  lessonId: uuid,
  status: z.enum(ATTENDANCE_STATUSES),
});

export async function markAttendanceMany(
  studentIds: string[],
  lessonId: string,
  status: AttendanceStatus,
): Promise<PortalActionResult> {
  const parsed = markManySchema.safeParse({ studentIds, lessonId, status });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { supabase, lesson } = await lessonContext(parsed.data.lessonId);
  if (!lesson) return { ok: false, error: "forbidden" };
  const ids = [...new Set(parsed.data.studentIds)];
  const markedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      ids.map((id) => ({
        student_id: id,
        lesson_id: lesson.id,
        school_day_id: lesson.school_day_id,
        status: parsed.data.status,
        marked_by: user.id,
        marked_at: markedAt,
      })),
      { onConflict: "student_id,lesson_id" },
    )
    .select("student_id");
  if (error) return { ok: false, error: dbError(error) };
  if ((data?.length ?? 0) !== ids.length) return { ok: false, error: "forbidden" };

  await writeAudit({
    action: "attendance.mark_many",
    entityType: "attendance",
    entityId: lesson.school_day_id,
    metadata: { lesson_id: lesson.id, student_ids: ids, status: parsed.data.status },
  });
  refreshPortal();
  return { ok: true };
}

const classNoteSchema = z.object({
  lessonId: uuid,
  homework: optionalText,
  summary: optionalText,
});

export async function saveClassNote(
  lessonId: string,
  note: { homework?: string | null; summary?: string | null },
): Promise<PortalActionResult> {
  const parsed = classNoteSchema.safeParse({ lessonId, ...note });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await getPortalContext();
  if (!context.user) return { ok: false, error: "unauthenticated" };

  const { supabase, lesson } = await lessonContext(parsed.data.lessonId);
  if (!lesson) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase
    .from("class_notes")
    .upsert(
      {
        lesson_id: lesson.id,
        class_id: lesson.class_id,
        school_day_id: lesson.school_day_id,
        homework: parsed.data.homework,
        summary: parsed.data.summary,
        author_guardian_id: context.guardianIds[0] ?? null,
      },
      { onConflict: "lesson_id" },
    )
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error ? dbError(error) : "forbidden" };

  await writeAudit({
    action: "class_note.save",
    entityType: "class_note",
    entityId: data.id,
    metadata: { class_id: lesson.class_id, school_day_id: lesson.school_day_id, lesson_id: lesson.id },
  });
  refreshPortal();
  return { ok: true, id: data.id };
}

const absenceSchema = z.object({
  studentId: uuid,
  schoolDayId: uuid,
  reason: optionalText,
});

export async function reportAbsence(
  studentId: string,
  schoolDayId: string,
  reason?: string | null,
): Promise<PortalActionResult> {
  const parsed = absenceSchema.safeParse({ studentId, schoolDayId, reason });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await getPortalContext();
  if (!context.user) return { ok: false, error: "unauthenticated" };
  if (!context.guardianIds.length) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("absence_reports")
    .insert({
      student_id: parsed.data.studentId,
      school_day_id: parsed.data.schoolDayId,
      reason: parsed.data.reason,
      reported_by_guardian_id: context.guardianIds[0],
    })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.code === "42501" ? "closed" : dbError(error) };
  }

  await writeAudit({
    action: "absence.report",
    entityType: "absence_report",
    entityId: data.id,
    metadata: { student_id: parsed.data.studentId, school_day_id: parsed.data.schoolDayId },
  });
  refreshPortal();
  return { ok: true, id: data.id };
}

export async function withdrawAbsence(id: string): Promise<PortalActionResult> {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("absence_reports")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("withdrawn_at", null)
    .select("id, student_id, school_day_id")
    .maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "not_found" };

  await writeAudit({
    action: "absence.withdraw",
    entityType: "absence_report",
    entityId: data.id,
    metadata: { student_id: data.student_id, school_day_id: data.school_day_id },
  });
  refreshPortal();
  return { ok: true, id: data.id };
}
