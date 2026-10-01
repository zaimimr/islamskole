import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, Pencil } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { ChildAbsence } from "@/components/portal/parent/child-absence";
import { childName, joinNames } from "@/components/portal/parent/child-card";
import { AttendanceYear, NotesYear } from "@/components/portal/year-overview";
import { getPortalContext } from "@/lib/portal/data";
import { absenceOptions, getParentData } from "@/lib/portal/parent-data";
import { currentTerm, summarizeAttendance } from "@/lib/portal/parent-format";
import { allSchoolDays } from "@/lib/portal/teacher-days";

export default async function ChildDetailPage({
  params,
}: PageProps<"/[locale]/min-side/barn/[studentId]">) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);
  const context = await getPortalContext();
  if (!context.user) redirect({ href: "/min-side/logg-inn", locale });

  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "portal.parent" }),
    getParentData(500),
  ]);
  const child = data.children.find((row) => row.student_id === studentId);
  if (!child) notFound();

  const name = childName(child);
  const className = locale === "en" ? child.class_name_en : child.class_name_no;
  const teachers = joinNames(child.teachers, locale);
  const { term, from, to } = currentTerm(data.today);
  const summary = summarizeAttendance(data.attendance, child.student_id, { from, to }, data.today);
  const options = absenceOptions(child, data.schoolDays.upcoming, data.reports, locale, data.today);
  const statusByDate = new Map(
    data.attendance
      .filter((row) => row.student_id === child.student_id && row.date)
      .map((row) => [row.date as string, row.status]),
  );
  const yearDays = allSchoolDays(data.schoolDays).filter((day) => !day.cancelled);

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
        <Link
          href={`/min-side/familie#child-${child.student_id}`}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-semibold text-brand-green-dark outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Pencil aria-hidden="true" className="size-4" />
          {t("editInfo")}
        </Link>
      </header>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <AttendanceYear
          id="detail-absence"
          title={t("attendance.title")}
          historyTitle={t("attendance.historyTitle")}
          days={yearDays}
          statusByDate={statusByDate}
          statusLabel={(status) => t(`status.${status}`)}
          locale={locale}
        >
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
        </AttendanceYear>

        <NotesYear
          id="detail-notes"
          title={t("note.yearTitle")}
          empty={t("note.empty")}
          notes={data.notesByClass.get(child.class_id) ?? []}
          labels={{ homework: t("note.homework"), summary: t("note.summary") }}
          locale={locale}
        />
      </div>
    </div>
  );
}
