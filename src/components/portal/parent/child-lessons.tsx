import { getTranslations } from "next-intl/server";
import { attendanceStatusTone } from "@/components/portal/year-overview";
import { lessonView } from "@/lib/portal/lesson-view";
import type { AttendanceStatus, PortalLesson, PortalTimeSlot } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

export async function ChildLessons({
  lessons,
  slots,
  locale,
  statusByLesson,
}: {
  lessons: PortalLesson[];
  slots: PortalTimeSlot[];
  locale: string;
  statusByLesson?: Map<string, AttendanceStatus>;
}) {
  const t = await getTranslations({ locale, namespace: "portal.parent" });
  if (!lessons.length) return null;
  return (
    <ol className="grid gap-2">
      {lessons.map((lesson) => {
        const view = lessonView(lesson, slots, t("lessons.wholeDay"));
        const status = statusByLesson?.get(lesson.lesson_id);
        return (
          <li
            key={lesson.lesson_id}
            className={cn("grid gap-1 rounded-xl bg-muted/60 px-3 py-2.5", view.cancelled && "opacity-75")}
          >
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className={cn("font-semibold", view.cancelled && "line-through")}>{view.title}</span>
              {view.times ? <span className="text-sm text-muted-foreground tabular-nums">{view.times}</span> : null}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/75">
              {view.teacher ? <span>{t("lessons.teacher", { name: view.teacher })}</span> : null}
              {view.isSubstitute ? <span className="font-semibold">{t("lessons.substitute")}</span> : null}
              {view.cancelled ? <span className="font-semibold text-destructive">{t("lessons.cancelled")}</span> : null}
              {status ? (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", attendanceStatusTone[status])}>
                  {t(`status.${status}`)}
                </span>
              ) : null}
            </p>
            {view.note ? <p className="text-sm text-pretty text-foreground/80">{view.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
