import { routing } from "@/i18n/routing";

export function localePrefix(locale: string) {
  return locale === routing.defaultLocale ? "" : `/${locale}`;
}

export function adminBasePath(locale: string) {
  return `${localePrefix(locale)}/admin`;
}

export function loginPath(locale: string) {
  return `${localePrefix(locale)}/login`;
}
