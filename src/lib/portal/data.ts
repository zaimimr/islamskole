import "server-only";
import { cache } from "react";
import { getIsAdmin, getUser } from "@/lib/auth";
import { ageInYear, schoolYearStart } from "@/lib/age";
import { osloToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceStatus,
  PortalAbsenceReport,
  PortalAttendance,
  PortalChild,
  PortalClass,
  PortalClassNote,
  PortalContext,
  PortalGuardianContact,
  PortalPerson,
  PortalRosterRow,
  PortalSchoolDay,
  PortalSchoolDays,
} from "@/lib/portal/types";

function referenceYear(label: string | null | undefined): number {
  return schoolYearStart(label) ?? Number(osloToday().slice(0, 4));
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const getMyChildren = cache(async (): Promise<PortalChild[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_my_children");
  if (error) {
    console.error("portal_my_children failed", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row,
    birth_date: row.birth_date ?? null,
    age: ageInYear(row.birth_date, referenceYear(row.school_year_label)),
    teachers: asArray<PortalPerson>(row.teachers),
    remaining_ore: row.remaining_ore ?? null,
  }));
});

export const getMyClasses = cache(async (): Promise<PortalClass[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_my_classes");
  if (error) {
    console.error("portal_my_classes failed", error);
    return [];
  }
  return data ?? [];
});

const getGuardianIds = cache(async (): Promise<string[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_guardian_ids");
  if (error) {
    console.error("portal_guardian_ids failed", error);
    return [];
  }
  return (data ?? []) as string[];
});

export const getPortalContext = cache(async (): Promise<PortalContext> => {
  const user = await getUser();
  if (!user) {
    return {
      user: null,
      email: null,
      guardianIds: [],
      isTeacher: false,
      isGuardian: false,
      isAdmin: false,
    };
  }
  const [guardianIds, children, classes, isAdmin] = await Promise.all([
    getGuardianIds(),
    getMyChildren(),
    getMyClasses(),
    getIsAdmin(),
  ]);
  return {
    user,
    email: user.email ?? null,
    guardianIds,
    isTeacher: classes.length > 0,
    isGuardian: children.length > 0,
    isAdmin,
  };
});

const getActiveYear = cache(
  async (): Promise<{ id: string; label: string } | null> => {
    const [children, classes] = await Promise.all([getMyChildren(), getMyClasses()]);
    const known = children[0] ?? classes[0];
    if (known) return { id: known.school_year_id, label: known.school_year_label };
    const supabase = await createClient();
    const { data } = await supabase
      .from("school_years")
      .select("id, label")
      .eq("is_active", true)
      .maybeSingle();
    return data ?? null;
  },
);

export async function getClassRoster(
  classId: string,
  schoolDayId: string,
): Promise<PortalRosterRow[]> {
  const supabase = await createClient();
  const [{ data, error }, activeYear, classes] = await Promise.all([
    supabase.rpc("portal_class_roster", {
      p_class_id: classId,
      p_school_day_id: schoolDayId,
    }),
    getActiveYear(),
    getMyClasses(),
  ]);
  if (error) {
    if (error.code !== "42501") console.error("portal_class_roster failed", error);
    return [];
  }
  const label =
    classes.find((row) => row.class_id === classId)?.school_year_label ??
    activeYear?.label;
  const year = referenceYear(label);
  return (data ?? []).map((row) => ({
    ...row,
    birth_date: row.birth_date ?? null,
    age: ageInYear(row.birth_date, year),
    guardians: asArray<PortalGuardianContact>(row.guardians),
    attendance_status: (row.attendance_status ?? null) as AttendanceStatus | null,
    attendance_marked_at: row.attendance_marked_at ?? null,
    absence_report_id: row.absence_report_id ?? null,
    absence_reason: row.absence_reason ?? null,
  }));
}

export async function getSchoolDays(schoolYearId?: string): Promise<PortalSchoolDays> {
  const yearId = schoolYearId ?? (await getActiveYear())?.id ?? null;
  if (!yearId) return { schoolYearId: null, upcoming: [], past: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_days")
    .select("id, school_year_id, date, cancelled, note")
    .eq("school_year_id", yearId)
    .order("date", { ascending: true });
  if (error) {
    console.error("school_days failed", error);
    return { schoolYearId: yearId, upcoming: [], past: [] };
  }
  const today = osloToday();
  const days: PortalSchoolDay[] = data ?? [];
  return {
    schoolYearId: yearId,
    upcoming: days.filter((day) => day.date >= today),
    past: days.filter((day) => day.date < today).reverse(),
  };
}

export async function getClassNotes(
  classId: string,
  limit = 10,
  until?: string,
): Promise<PortalClassNote[]> {
  const supabase = await createClient();
  let query = supabase
    .from("class_notes")
    .select(
      "id, class_id, school_day_id, homework, summary, author_guardian_id, created_at, updated_at, school_days!inner(date)",
    )
    .eq("class_id", classId);
  if (until) query = query.lte("school_days.date", until);
  const { data, error } = await query
    .order("date", { referencedTable: "school_days", ascending: false })
    .limit(limit);
  if (error) {
    console.error("class_notes failed", error);
    return [];
  }
  return (data ?? [])
    .map(({ school_days, ...note }) => ({ ...note, date: school_days?.date ?? null }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export async function getMyAttendance(schoolYearId?: string): Promise<PortalAttendance[]> {
  const yearId = schoolYearId ?? (await getActiveYear())?.id ?? null;
  if (!yearId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, school_day_id, status, marked_at, school_days!inner(date, school_year_id)")
    .eq("school_days.school_year_id", yearId);
  if (error) {
    console.error("attendance failed", error);
    return [];
  }
  return (data ?? []).map(({ school_days, ...row }) => ({
    ...row,
    status: row.status as AttendanceStatus,
    date: school_days?.date ?? null,
  }));
}

export async function getMyAbsenceReports(
  options: { includeWithdrawn?: boolean } = {},
): Promise<PortalAbsenceReport[]> {
  const supabase = await createClient();
  let query = supabase
    .from("absence_reports")
    .select("id, student_id, school_day_id, reason, created_at, withdrawn_at, school_days!inner(date)")
    .order("created_at", { ascending: false });
  if (!options.includeWithdrawn) query = query.is("withdrawn_at", null);
  const { data, error } = await query;
  if (error) {
    console.error("absence_reports failed", error);
    return [];
  }
  return (data ?? []).map(({ school_days, ...row }) => ({
    ...row,
    date: school_days?.date ?? null,
  }));
}
