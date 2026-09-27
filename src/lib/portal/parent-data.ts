import "server-only";
import { getSiteSettings, getUpcomingEvents } from "@/lib/data";
import { osloToday } from "@/lib/dates";
import {
  getClassNotes,
  getMyAbsenceReports,
  getMyAttendance,
  getMyChildren,
  getSchoolDays,
} from "@/lib/portal/data";
import { formatPortalDay } from "@/lib/portal/parent-format";
import type { PortalAbsenceReport, PortalChild, PortalSchoolDay } from "@/lib/portal/types";

const ABSENCE_DAY_COUNT = 6;

export async function getParentData(noteLimit = 1) {
  const [children, schoolDays, attendance, reports, settings] = await Promise.all([
    getMyChildren(),
    getSchoolDays(),
    getMyAttendance(),
    getMyAbsenceReports(),
    getSiteSettings(),
  ]);
  const classIds = [...new Set(children.map((child) => child.class_id))];
  const today = osloToday();
  const noteLists = await Promise.all(classIds.map((id) => getClassNotes(id, noteLimit, today)));
  const notesByClass = new Map(classIds.map((id, index) => [id, noteLists[index]]));
  return {
    today,
    children,
    schoolDays,
    attendance,
    reports,
    notesByClass,
    contactEmail: settings?.contact_email ?? null,
  };
}

export async function getPortalEvents(limit = 4) {
  const now = Date.now();
  const events = await getUpcomingEvents();
  return events
    .filter((event) => event.starts_at && new Date(event.starts_at).getTime() >= now)
    .slice(0, limit);
}

export function absenceOptions(
  child: PortalChild,
  upcoming: PortalSchoolDay[],
  reports: PortalAbsenceReport[],
  locale: string,
  today: string,
) {
  const childReports = reports.filter(
    (report) => report.student_id === child.student_id && (report.date ?? "") >= today,
  );
  const reportedDays = new Set(childReports.map((report) => report.school_day_id));
  return {
    days: upcoming
      .filter((day) => !day.cancelled)
      .slice(0, ABSENCE_DAY_COUNT)
      .map((day) => ({
        id: day.id,
        label: formatPortalDay(day.date, locale),
        reported: reportedDays.has(day.id),
      })),
    reports: childReports
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .map((report) => ({
        id: report.id,
        label: formatPortalDay(report.date, locale),
        reason: report.reason,
      })),
  };
}
