import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { ChildAbsence } from "@/components/portal/parent/child-absence";
import { ClassNoteBody, childName, joinNames } from "@/components/portal/parent/child-card";
import { getPortalContext } from "@/lib/portal/data";
import { absenceOptions, getParentData } from "@/lib/portal/parent-data";
import { currentTerm, formatPortalDay, summarizeAttendance } from "@/lib/portal/parent-format";
import type { AttendanceStatus } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

const statusTone: Record<AttendanceStatus | "none", string> = {
  til_stede: "bg-primary/12 text-brand-green-dark",
  sent: "bg-brand-sun/35 text-[#4a3a00]",
  fravaer: "bg-destructive/10 text-destructive",
  meldt_fravaer: "bg-accent text-accent-foreground",
  none: "bg-muted text-muted-foreground",
};

export default async function ChildDetailPage({
  params,
}: PageProps<"/[locale]/min-side/barn/[studentId]">) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);
  const context = await getPortalContext();
  if (!context.user) redirect({ href: "/min-side/logg-inn", locale });

  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "portal.parent" }),
    getParentData(10),
  ]);
  const child = data.children.find((row) => row.student_id === studentId);
  if (!child) notFound();

  const name = childName(child);
  const className = locale === "en" ? child.class_name_en : child.class_name_no;
  const teachers = joinNames(child.teachers, locale);
  const { term, from, to } = currentTerm(data.today);
  const summary = summarizeAttendance(data.attendance, child.student_id, { from, to }, data.today);
  const options = absenceOptions(child, data.schoolDays.upcoming, data.reports, locale, data.today);
  const notes = (data.notesByClass.get(child.class_id) ?? []).filter((note) => note.homework || note.summary);
  const statusByDay = new Map(
    data.attendance
      .filter((row) => row.student_id === child.student_id)
      .map((row) => [row.school_day_id, row.status]),
  );
  const markedToday = data.schoolDays.upcoming.filter(
    (day) => day.date === data.today && statusByDay.has(day.id),
  );
  const pastDays = [...markedToday, ...data.schoolDays.past].filter((day) => !day.cancelled);

  return (
    <div className="grid gap-8">
      <Link
        href="/min-side"
        className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 font-semibold text-brand-green-dark outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
        {t("back")}
      </Link>

      <header className="grid gap-1">
        <h1 className="font-heading text-3xl font-semibold text-balance">{name}</h1>
        <p className="font-semibold text-brand-green-dark">
          {className}
          {child.age != null ? <span className="font-normal text-foreground/75"> · {t("age", { age: child.age })}</span> : null}
        </p>
        <p className="text-sm text-foreground/75">
          {teachers ? t("teachers", { names: teachers, count: child.teachers.length }) : t("noTeacher")}
        </p>
      </header>

      <section aria-labelledby="detail-absence" className="soft-card grid gap-4 p-5 sm:p-6">
        <h2 id="detail-absence" className="font-heading text-xl font-semibold">
          {t("attendance.title")}
        </h2>
        <p className="text-pretty">
          {summary.absent
            ? t("attendance.absent", { count: summary.absent, term: t(`term.${term}`) })
            : t("attendance.none", { term: t(`term.${term}`) })}
          {summary.late ? ` ${t("attendance.late", { count: summary.late })}` : null}
        </p>
        <ChildAbsence
          studentId={child.student_id}
          classId={child.class_id}
          childName={child.first_name ?? name}
          days={options.days}
          reports={options.reports}
        />
        {pastDays.length ? (
          <div className="grid gap-2 border-t border-foreground/8 pt-4">
            <h3 className="font-semibold">{t("attendance.historyTitle")}</h3>
            <ul className="grid gap-1">
              {pastDays.map((day) => {
                const status = statusByDay.get(day.id) ?? "none";
                return (
                  <li key={day.id} className="flex min-h-11 items-center justify-between gap-3">
                    <span className="first-letter:uppercase">{formatPortalDay(day.date, locale)}</span>
                    <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", statusTone[status])}>
                      {t(`status.${status}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="detail-notes" className="grid gap-4">
        <h2 id="detail-notes" className="font-heading text-xl font-semibold">
          {t("note.historyTitle")}
        </h2>
        {notes.length ? (
          <ol className="soft-card grid divide-y divide-foreground/8">
            {notes.map((note) => (
              <li key={note.id} className="grid gap-3 p-5 sm:p-6">
                <h3 className="font-heading text-lg font-semibold first-letter:uppercase">
                  {formatPortalDay(note.date, locale)}
                </h3>
                <ClassNoteBody note={note} labels={{ homework: t("note.homework"), summary: t("note.summary") }} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">{t("note.empty")}</p>
        )}
      </section>
    </div>
  );
}
