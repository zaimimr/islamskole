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

export function isUpcoming(iso: string | null | undefined): boolean {
  if (!iso) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() >= Date.now();
}
