"use client";

import { useTranslations } from "next-intl";
import { ClipboardPen, House, Users, Wallet } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/min-side", key: "home", icon: House },
  { href: "/min-side/familie", key: "family", icon: Users },
  { href: "/min-side/okonomi", key: "economy", icon: Wallet },
  { href: "/min-side/pamelding", key: "enroll", icon: ClipboardPen },
] as const;

export function PortalNav() {
  const t = useTranslations("portal.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="mx-auto w-full max-w-6xl px-4 pb-2 sm:px-6">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/min-side"
              ? pathname === "/min-side" || pathname.startsWith("/min-side/barn")
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap ring-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-primary/12 text-brand-green-dark ring-primary/30"
                    : "bg-card text-foreground ring-foreground/10 hover:bg-muted",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
