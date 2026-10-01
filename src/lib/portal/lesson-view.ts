import { joinTeacherNames, lessonTitle, slotRangeTimes } from "@/lib/lessons";
import type { PortalLesson, PortalTimeSlot } from "@/lib/portal/types";

function personName(first: string | null, last: string | null) {
  return [first, last].filter(Boolean).join(" ") || null;
}

export function lessonTeacherName(
  lesson: Pick<PortalLesson, "teacher_first_name" | "teacher_last_name" | "co_teacher_first_name" | "co_teacher_last_name">,
  locale?: string,
) {
  return joinTeacherNames(
    [
      personName(lesson.teacher_first_name, lesson.teacher_last_name),
      personName(lesson.co_teacher_first_name, lesson.co_teacher_last_name),
    ],
    locale,
  );
}

export function lessonView(lesson: PortalLesson, slots: PortalTimeSlot[], wholeDayLabel: string, locale?: string) {
  return {
    id: lesson.lesson_id,
    title: lessonTitle(lesson, slots, wholeDayLabel),
    times: slotRangeTimes(slots, lesson),
    teacher: lessonTeacherName(lesson, locale),
    isSubstitute: lesson.is_substitute,
    cancelled: lesson.cancelled,
    isMine: lesson.is_mine,
    note: lesson.note,
  };
}
