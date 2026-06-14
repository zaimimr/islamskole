"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type LocaleSwitcherProps = {
  tone?: "default" | "light";
};

export function LocaleSwitcher({ tone = "default" }: LocaleSwitcherProps) {
  const t = useTranslations("nav");
  const activeLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSelect(locale: string) {
    if (locale === activeLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale: locale as (typeof routing.locales)[number] });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("localeLabel")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-1",
        tone === "light"
          ? "bg-primary-foreground/15"
          : "bg-muted ring-1 ring-foreground/8",
      )}
    >
      {routing.locales.map((locale) => {
        const active = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => onSelect(locale)}
            disabled={isPending}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-bold uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60",
              active
                ? tone === "light"
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary text-primary-foreground"
                : tone === "light"
                  ? "text-primary-foreground/80 hover:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
