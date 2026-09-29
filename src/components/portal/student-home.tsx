import { getTranslations } from "next-intl/server";
import { joinNames } from "@/components/portal/parent/child-card";
import { AttendanceYear, NotesYear } from "@/components/portal/year-overview";
import { osloToday } from "@/lib/dates";
import { getMySelf, getSchoolDays } from "@/lib/portal/data";
import { allSchoolDays } from "@/lib/portal/teacher-days";

export async function StudentHome({ locale }: { locale: string }) {
  const [t, tParent, self] = await Promise.all([
    getTranslations({ locale, namespace: "portal.student" }),
    getTranslations({ locale, namespace: "portal.parent" }),
    getMySelf(),
  ]);
  const me = self.find((row) => row.class_id) ?? self[0];
  const days = me?.school_year_id ? await getSchoolDays(me.school_year_id) : null;
  const today = osloToday();
  const className = me ? (locale === "en" ? me.class_name_en : me.class_name_no) : null;
  const teachers = me ? joinNames(me.teachers, locale) : "";

  return (
    <section aria-labelledby="student-home-title" className="grid gap-6">
      <header className="grid gap-1">
        <h2 id="student-home-title" className="font-heading text-3xl font-semibold text-balance">
          {t("title")}
        </h2>
        {className ? (
          <p className="font-semibold text-brand-green-dark">
            {className}
            {me?.school_year_label ? (
              <span className="font-normal text-foreground/75"> · {me.school_year_label}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("noClass")}</p>
        )}
        {className ? (
          <p className="text-sm text-foreground/75">
            {teachers
              ? tParent("teachers", { names: teachers, count: me?.teachers.length ?? 0 })
              : tParent("noTeacher")}
          </p>
        ) : null}
      </header>

      {me && className ? (
        <>
          <NotesYear
            id="student-notes"
            title={tParent("note.yearTitle")}
            empty={tParent("note.empty")}
            notes={me.notes.filter((note) => note.date <= today)}
            labels={{ homework: tParent("note.homework"), summary: tParent("note.summary") }}
            locale={locale}
          />
          <AttendanceYear
            id="student-attendance"
            title={tParent("attendance.title")}
            historyTitle={tParent("attendance.historyTitle")}
            days={days ? allSchoolDays(days).filter((day) => !day.cancelled) : []}
            statusByDate={new Map(me.attendance.map((row) => [row.date, row.status]))}
            statusLabel={(status) => tParent(`status.${status}`)}
            locale={locale}
          />
        </>
      ) : null}
    </section>
  );
}
