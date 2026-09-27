import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { localePrefix } from "@/components/admin/paths";
import { ChildCard } from "@/components/portal/parent/child-card";
import { UpcomingList } from "@/components/portal/parent/upcoming-list";
import { absenceOptions, getParentData, getPortalEvents } from "@/lib/portal/parent-data";
import { currentTerm, summarizeAttendance } from "@/lib/portal/parent-format";

const RECENT_NOTE_DAYS = 7;

function daysBefore(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export async function ParentHome({ locale }: { locale: string }) {
  const [t, data, events] = await Promise.all([
    getTranslations({ locale, namespace: "portal.parent" }),
    getParentData(),
    getPortalEvents(),
  ]);
  const { term, from, to } = currentTerm(data.today);
  const recentFrom = daysBefore(data.today, RECENT_NOTE_DAYS);
  const reportedNames = new Map<string, string[]>();
  for (const report of data.reports) {
    const child = data.children.find((row) => row.student_id === report.student_id);
    if (!child?.first_name) continue;
    const names = reportedNames.get(report.school_day_id) ?? [];
    if (!names.includes(child.first_name)) names.push(child.first_name);
    reportedNames.set(report.school_day_id, names);
  }
  const listFormat = new Intl.ListFormat(locale === "en" ? "en-GB" : "nb-NO", { type: "conjunction" });
  const contactHref = data.contactEmail
    ? `mailto:${data.contactEmail}`
    : `${localePrefix(locale)}/kontakt`;

  return (
    <div className="grid gap-10">
      <section aria-labelledby="parent-home-title" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="parent-home-title" className="font-heading text-3xl font-semibold text-balance">
            {t("title")}
          </h2>
          <p className="text-pretty text-muted-foreground">
            {t("intro", { count: data.children.length, year: data.children[0]?.school_year_label ?? "" })}
          </p>
        </div>
        <div className="grid gap-6">
          {data.children.map((child) => {
            const note = data.notesByClass.get(child.class_id)?.[0] ?? null;
            const options = absenceOptions(child, data.schoolDays.upcoming, data.reports, locale, data.today);
            return (
              <ChildCard
                key={`${child.student_id}-${child.class_id}`}
                child={child}
                locale={locale}
                note={note}
                noteIsRecent={Boolean(note?.date && note.date >= recentFrom)}
                attendance={summarizeAttendance(data.attendance, child.student_id, { from, to }, data.today)}
                term={term}
                days={options.days}
                reports={options.reports}
                contactHref={contactHref}
              />
            );
          })}
        </div>
      </section>

      <UpcomingList
        locale={locale}
        days={data.schoolDays.upcoming.slice(0, 4)}
        events={events}
        reported={Object.fromEntries(
          [...reportedNames].map(([dayId, names]) => [dayId, listFormat.format(names)]),
        )}
      />

      <p className="flex items-start gap-2 text-pretty text-muted-foreground">
        <Mail aria-hidden="true" className="mt-1 size-4 shrink-0" />
        <span>
          {t("questions")}{" "}
          <a
            href={contactHref}
            className="rounded-sm font-semibold text-brand-green-dark underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {data.contactEmail ?? t("contactPage")}
          </a>
        </span>
      </p>
    </div>
  );
}
