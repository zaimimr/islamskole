import { getTranslations } from "next-intl/server";
import { CalendarDays, ChevronRight, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { osloToday } from "@/lib/dates";
import { getClassRoster, getMyClasses, getSchoolDays } from "@/lib/portal/data";
import { capitalize, defaultSchoolDay, formatSchoolDay } from "@/lib/portal/teacher-days";

export async function TeacherHome({ locale }: { locale: string }) {
  const [t, tHome, classes] = await Promise.all([
    getTranslations({ locale, namespace: "portal.teacher" }),
    getTranslations({ locale, namespace: "portal.home" }),
    getMyClasses(),
  ]);
  const days = await getSchoolDays(classes[0]?.school_year_id);
  const nextDay = defaultSchoolDay({ ...days, past: [] });
  const rosters = nextDay
    ? await Promise.all(classes.map((row) => getClassRoster(row.class_id, nextDay.id)))
    : classes.map(() => []);
  const today = osloToday();

  return (
    <section aria-labelledby="teacher-home-title" className="grid gap-3">
      <h2 id="teacher-home-title" className="text-2xl font-bold">
        {tHome("teacherTitle")}
      </h2>
      <ul className="grid gap-3">
        {classes.map((row, index) => {
          const reported = rosters[index].filter((student) => student.absence_report_id).length;
          return (
            <li key={row.class_id}>
              <Link
                href={`/min-side/klasse/${row.class_id}`}
                className="group grid gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/8 outline-none transition-shadow hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-start gap-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="font-heading text-xl font-semibold">
                      {locale === "en" ? row.name_en : row.name_no}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users aria-hidden="true" className="size-4 shrink-0" />
                      {t("students", { count: row.student_count })}
                      <span aria-hidden="true">·</span>
                      {row.school_year_label}
                    </p>
                  </div>
                  <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand-green-dark">
                    {t("open")}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                    {nextDay
                      ? nextDay.date === today
                        ? t("todayWithDate", { date: formatSchoolDay(nextDay.date, locale) })
                        : capitalize(formatSchoolDay(nextDay.date, locale))
                      : t("noDays")}
                    {nextDay?.cancelled ? ` (${t("day.cancelled")})` : null}
                  </span>
                  {nextDay ? (
                    <span className={reported ? "font-semibold text-accent-foreground" : "text-muted-foreground"}>
                      {t("reportedCount", { count: reported })}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
