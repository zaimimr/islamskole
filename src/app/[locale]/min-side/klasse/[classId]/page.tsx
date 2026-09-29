import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarX, Info } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { AttendanceRoster } from "@/components/portal/teacher/attendance-roster";
import { ClassNoteEditor } from "@/components/portal/teacher/class-note-editor";
import { DaySwitcher } from "@/components/portal/teacher/day-switcher";
import { osloToday } from "@/lib/dates";
import {
  getClassForAdmin,
  getClassNotes,
  getClassRoster,
  getMyClasses,
  getPortalContext,
  getSchoolDays,
} from "@/lib/portal/data";
import {
  allSchoolDays,
  capitalize,
  defaultSchoolDay,
  formatSavedAt,
  formatSchoolDay,
} from "@/lib/portal/teacher-days";
import { getClassNoteForDay } from "@/lib/portal/teacher-notes";

export default async function TeacherClassPage({
  params,
  searchParams,
}: PageProps<"/[locale]/min-side/klasse/[classId]">) {
  const { locale, classId } = await params;
  setRequestLocale(locale);
  const [context, query, classes, t] = await Promise.all([
    getPortalContext(),
    searchParams,
    getMyClasses(),
    getTranslations("portal.teacher"),
  ]);
  if (!context.user) redirect({ href: "/min-side/logg-inn", locale });

  const current =
    classes.find((row) => row.class_id === classId) ??
    (context.isAdmin ? await getClassForAdmin(classId) : null);
  if (!current) notFound();

  const days = await getSchoolDays(current.school_year_id);
  const list = allSchoolDays(days);
  const requested = typeof query.dag === "string" ? list.find((day) => day.id === query.dag) : undefined;
  const day = requested ?? defaultSchoolDay(days);
  const today = osloToday();
  const className = locale === "en" ? current.name_en : current.name_no;

  const [roster, note, notes] = day
    ? await Promise.all([
        getClassRoster(classId, day.id),
        getClassNoteForDay(classId, day.id),
        getClassNotes(classId, 6, day.date),
      ])
    : [[], null, await getClassNotes(classId, 5, today)];
  const previousNotes = notes
    .filter((row) => !day || (row.date !== null && row.date < day.date))
    .slice(0, 5);
  const isFuture = day ? day.date > today : false;
  const markable = day ? !day.cancelled && !isFuture : false;

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <Link
          href={context.isGuardian ? "/min-side?fane=klasse" : "/min-side"}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg pr-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("back")}
        </Link>
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold text-balance">{className}</h1>
          <p className="text-muted-foreground">
            {t("students", { count: current.student_count })} · {current.school_year_label}
          </p>
        </div>
      </div>

      {day ? (
        <>
          <div className="grid gap-3">
            <DaySwitcher
              classId={classId}
              selectedId={day.id}
              days={list.map((item) => ({
                id: item.id,
                label: capitalize(
                  formatSchoolDay(item.date, locale, { weekday: "short", day: "numeric", month: "short" }),
                ),
                cancelled: item.cancelled,
                isToday: item.date === today,
              }))}
            />
            {day.cancelled ? (
              <p role="status" className="flex gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                <CalendarX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-semibold">{t("day.cancelledNotice")}</span>
                  {day.note ? ` ${day.note}` : null}
                </span>
              </p>
            ) : isFuture ? (
              <p role="status" className="flex gap-2 rounded-xl bg-muted p-3 text-sm">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {t("day.futureNotice")}
              </p>
            ) : null}
          </div>

          <section aria-labelledby="attendance-title" className="grid gap-3">
            <h2 id="attendance-title" className="text-2xl font-bold">
              {t("roster.title")}
            </h2>
            <AttendanceRoster key={day.id} rows={roster} schoolDayId={day.id} markable={markable} />
          </section>

          <section aria-labelledby="note-title" className="grid gap-3">
            <div className="grid gap-1">
              <h2 id="note-title" className="text-2xl font-bold">
                {t("note.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("note.intro")}</p>
            </div>
            <ClassNoteEditor
              key={day.id}
              classId={classId}
              schoolDayId={day.id}
              initialHomework={note?.homework ?? ""}
              initialSummary={note?.summary ?? ""}
              savedLabel={note?.updated_at ? formatSavedAt(note.updated_at, locale) : null}
              disabled={day.cancelled}
            />
          </section>
        </>
      ) : (
        <p className="rounded-2xl bg-card p-5 text-muted-foreground ring-1 ring-foreground/8">{t("noDays")}</p>
      )}

      <section aria-labelledby="previous-notes-title" className="grid gap-3">
        <h2 id="previous-notes-title" className="text-xl font-bold">
          {t("previous.title")}
        </h2>
        {previousNotes.length ? (
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/8">
            {previousNotes.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/min-side/klasse/${classId}?dag=${row.school_day_id}`}
                  className="grid gap-2 p-4 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <p className="font-semibold">
                    {row.date ? capitalize(formatSchoolDay(row.date, locale)) : null}
                  </p>
                  {row.homework ? (
                    <p className="text-sm">
                      <span className="font-semibold">{t("note.homework")}: </span>
                      <span className="whitespace-pre-line">{row.homework}</span>
                    </p>
                  ) : null}
                  {row.summary ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{t("note.summary")}: </span>
                      <span className="whitespace-pre-line">{row.summary}</span>
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("previous.empty")}</p>
        )}
      </section>
    </div>
  );
}
