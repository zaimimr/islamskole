import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TeacherDayNote = {
  id: string;
  homework: string | null;
  summary: string | null;
  updated_at: string;
};

export async function getClassNoteForDay(
  classId: string,
  schoolDayId: string,
): Promise<TeacherDayNote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_notes")
    .select("id, homework, summary, updated_at")
    .eq("class_id", classId)
    .eq("school_day_id", schoolDayId)
    .maybeSingle();
  if (error) {
    console.error("class_note failed", error);
    return null;
  }
  return data;
}
