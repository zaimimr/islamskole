import { lessonTitle, slotRangeTimes } from "@/lib/lessons";
import type { PortalLesson, PortalTimeSlot } from "@/lib/portal/types";

export function lessonTeacherName(lesson: Pick<PortalLesson, "teacher_first_name" | "teacher_last_name">) {
  return [lesson.teacher_first_name, lesson.teacher_last_name].filter(Boolean).join(" ") || null;
}

export function lessonView(lesson: PortalLesson, slots: PortalTimeSlot[], wholeDayLabel: string) {
  return {
    id: lesson.lesson_id,
    title: lessonTitle(lesson, slots, wholeDayLabel),
    times: slotRangeTimes(slots, lesson),
    teacher: lessonTeacherName(lesson),
    isSubstitute: lesson.is_substitute,
    cancelled: lesson.cancelled,
    isMine: lesson.is_mine,
    note: lesson.note,
  };
}
