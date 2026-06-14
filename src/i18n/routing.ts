import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["no", "en"],
  defaultLocale: "no",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
