import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type LessonTab = {
  id: string;
  title: string;
  times: string;
  teacher: string | null;
  isSubstitute: boolean;
  cancelled: boolean;
  isMine: boolean;
  note: string | null;
};

export async function LessonTabs({
  classId,
  dayId,
  selectedId,
  lessons,
}: {
  classId: string;
  dayId: string;
  selectedId: string;
  lessons: LessonTab[];
}) {
  const t = await getTranslations("portal.teacher.lessons");
  return (
    <nav aria-label={t("title")}>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/min-side/klasse/${classId}?dag=${dayId}&time=${lesson.id}`}
              scroll={false}
              aria-current={lesson.id === selectedId ? "page" : undefined}
              className={cn(
                "grid min-h-16 gap-0.5 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                "aria-[current=page]:bg-primary/10 aria-[current=page]:ring-2 aria-[current=page]:ring-brand-green-dark",
                lesson.cancelled && "opacity-70",
              )}
            >
              <span className={cn("font-semibold", lesson.cancelled && "line-through")}>{lesson.title}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {lesson.times ? <span className="tabular-nums">{lesson.times}</span> : null}
                {lesson.teacher ? <span>{lesson.teacher}</span> : null}
                {lesson.isSubstitute ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {t("substitute")}
                  </span>
                ) : null}
                {lesson.isMine ? (
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-brand-green-dark">
                    {t("mine")}
                  </span>
                ) : null}
                {lesson.cancelled ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {t("cancelled")}
                  </span>
                ) : null}
              </span>
              {lesson.note ? <span className="text-sm text-pretty text-foreground/80">{lesson.note}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
