import type { Locale } from "@/i18n/routing";

const localeTag: Record<Locale, string> = {
  no: "nb-NO",
  en: "en-GB",
};

export function formatEventDate(
  iso: string | null | undefined,
  locale: Locale,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(localeTag[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatEventTime(
  iso: string | null | undefined,
  locale: Locale,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(localeTag[locale], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const EVENT_ARCHIVE_GRACE_DAYS = 3;

export function isThisWeek(startsAt: string | null | undefined): boolean {
  if (!startsAt) return false;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return date.getTime() >= now && date.getTime() <= now + weekMs;
}

export function isUpcoming(
  startsAt: string | null | undefined,
  endsAt?: string | null | undefined,
): boolean {
  const iso = endsAt ?? startsAt;
  if (!iso) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  const graceMs = EVENT_ARCHIVE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return date.getTime() >= Date.now() - graceMs;
}
