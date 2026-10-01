import { OSLO } from "@/lib/dates";
import { statusByDay } from "@/lib/lessons";
import type { PortalAttendance } from "@/lib/portal/types";

export type PortalTerm = "autumn" | "spring";

function localeTag(locale: string) {
  return locale === "en" ? "en-GB" : "nb-NO";
}

export function formatPortalDay(
  date: string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(localeTag(locale), { timeZone: OSLO, ...options }).format(
    new Date(`${date.slice(0, 10)}T12:00:00Z`),
  );
}

export function formatPortalTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: OSLO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function currentTerm(today: string): { term: PortalTerm; from: string; to: string } {
  const year = today.slice(0, 4);
  return Number(today.slice(5, 7)) >= 8
    ? { term: "autumn", from: `${year}-08-01`, to: `${year}-12-31` }
    : { term: "spring", from: `${year}-01-01`, to: `${year}-07-31` };
}

export function summarizeAttendance(
  rows: PortalAttendance[],
  studentId: string,
  range: { from: string; to: string },
  today: string,
): { absent: number; late: number; present: number } {
  const summary = { absent: 0, late: 0, present: 0 };
  const days = statusByDay(
    rows.filter(
      (row) =>
        row.student_id === studentId &&
        row.date !== null &&
        row.date >= range.from &&
        row.date <= range.to &&
        row.date <= today,
    ),
  );
  for (const status of days.values()) {
    if (status === "fravaer" || status === "meldt_fravaer") summary.absent += 1;
    else if (status === "sent") summary.late += 1;
    else summary.present += 1;
  }
  return summary;
}
