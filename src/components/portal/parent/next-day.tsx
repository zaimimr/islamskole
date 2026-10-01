import { getTranslations } from "next-intl/server";
import { CalendarDays, CalendarOff } from "lucide-react";
import { ChildAbsence } from "@/components/portal/parent/child-absence";
import { childName } from "@/components/portal/parent/child-card";
import { ChildLessons } from "@/components/portal/parent/child-lessons";
import { formatPortalDay } from "@/lib/portal/parent-format";
import type { PortalChild, PortalLesson, PortalSchoolDay, PortalTimeSlot } from "@/lib/portal/types";

type AbsenceOptions = {
  days: { id: string; label: string; reported: boolean }[];
  reports: { id: string; label: string; reason: string | null }[];
};

function dayAfter(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function NextDay({
  locale,
  today,
  upcoming,
  rows,
  lessons,
  slots,
}: {
  locale: string;
  today: string;
  upcoming: PortalSchoolDay[];
  rows: { child: PortalChild; options: AbsenceOptions }[];
  lessons: PortalLesson[];
  slots: PortalTimeSlot[];
}) {
  const t = await getTranslations({ locale, namespace: "portal.home.next" });
  const first = upcoming[0] ?? null;
  const open = upcoming.find((day) => !day.cancelled) ?? null;

  function dayLabel(date: string) {
    if (date === today) return t("today");
    if (date === dayAfter(today)) return t("tomorrow");
    return formatPortalDay(date, locale);
  }

  if (!first) {
    return (
      <section aria-labelledby="next-day-title" className="soft-card grid gap-2 p-5 sm:p-6">
        <h3 id="next-day-title" className="font-heading text-xl font-semibold">
          {t("title")}
        </h3>
        <p className="text-muted-foreground">{t("none")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="next-day-title" className="soft-card overflow-hidden">
      <div className="grid gap-3 px-5 pt-5 pb-4 sm:px-6">
        <h3 id="next-day-title" className="text-sm font-bold text-brand-green-dark">
          {t("title")}
        </h3>
        {first.cancelled ? (
          <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive">
            <CalendarOff aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
            <div className="grid gap-1">
              <p className="font-heading text-xl font-semibold first-letter:uppercase">
                {t("cancelled", { day: dayLabel(first.date) })}
              </p>
              {first.note ? <p className="text-pretty">{first.note}</p> : null}
            </div>
          </div>
        ) : null}
        {open ? (
          <p className="flex items-center gap-3">
            <CalendarDays aria-hidden="true" className="size-6 shrink-0 text-brand-green-dark" />
            <span className="font-heading text-2xl font-semibold first-letter:uppercase">
              {first.cancelled ? t("thenOpen", { day: dayLabel(open.date) }) : dayLabel(open.date)}
            </span>
          </p>
        ) : null}
        {open && !first.cancelled && open.note ? (
          <p className="text-pretty text-muted-foreground">{open.note}</p>
        ) : null}
      </div>
      {open && rows.length ? (
        <ul className="grid divide-y divide-foreground/8 border-t border-foreground/8">
          {rows.map(({ child, options }) => {
            const reported = options.days.find((day) => day.id === open.id)?.reported ?? false;
            const name = child.first_name ?? childName(child);
            return (
              <li key={`${child.student_id}-${child.class_id}`} className="grid gap-3 px-5 py-4 sm:px-6">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold">{name}</span>
                  <span className={reported ? "text-sm font-semibold text-accent-foreground" : "text-sm text-muted-foreground"}>
                    {reported ? t("reported") : t("expected")}
                  </span>
                </p>
                <ChildLessons
                  lessons={lessons.filter(
                    (lesson) => lesson.class_id === child.class_id && lesson.school_day_id === open.id,
                  )}
                  slots={slots}
                  locale={locale}
                />
                <ChildAbsence
                  studentId={child.student_id}
                  classId={child.class_id}
                  childName={name}
                  days={options.days}
                  reports={options.reports}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
