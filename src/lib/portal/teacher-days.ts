import { OSLO } from "@/lib/dates";
import type { PortalSchoolDay, PortalSchoolDays } from "@/lib/portal/types";

export function allSchoolDays(days: PortalSchoolDays): PortalSchoolDay[] {
  return [...days.past].reverse().concat(days.upcoming);
}

export function defaultSchoolDay(days: PortalSchoolDays): PortalSchoolDay | null {
  return (
    days.upcoming.find((day) => !day.cancelled) ??
    days.upcoming[0] ??
    days.past[0] ??
    null
  );
}

export function formatSchoolDay(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nb-NO", {
    timeZone: OSLO,
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatSavedAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nb-NO", {
    timeZone: OSLO,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
