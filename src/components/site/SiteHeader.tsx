"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleUserRound, MenuIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/klasser", key: "classes" },
  { href: "/aktiviteter", key: "events" },
  { href: "/om-oss", key: "about" },
  { href: "/bli-laerer", key: "teacher" },
  { href: "/kontakt", key: "contact" },
  { href: "/donasjon", key: "donate" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header sticky top-0 z-50 border-b border-foreground/8 bg-background/85 backdrop-blur-md">
      <div className="section-shell flex h-18 items-center justify-between gap-4 py-3">
        <Logo priority className="shrink-0" />

        <nav aria-label={t("menu")} className="hidden lg:block">
          <ul className="flex items-center gap-5 xl:gap-9">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-sm py-2 text-[0.95rem] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity",
                      active
                        ? "text-brand-green-dark after:opacity-100"
                        : "text-foreground/70 after:opacity-0 hover:text-foreground",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 lg:gap-5">
          <div className="hidden sm:block">
            <LocaleSwitcher variant="text" />
          </div>
          <Link
            href="/min-side/logg-inn"
            className="hidden rounded-sm py-2 text-[0.95rem] font-semibold whitespace-nowrap text-foreground/70 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:inline-flex"
          >
            {t("admin")}
          </Link>
          <Link
            href="/min-side/logg-inn"
            aria-label={t("admin")}
            className="inline-flex size-11 items-center justify-center rounded-full text-foreground/75 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          >
            <CircleUserRound aria-hidden="true" className="size-5" />
          </Link>
          <Link
            href="/pamelding"
            className="hidden min-h-10 items-center rounded-full bg-primary px-5 text-[0.95rem] font-semibold whitespace-nowrap text-primary-foreground transition-colors outline-none hover:bg-brand-green-dark focus-visible:ring-3 focus-visible:ring-ring/50 lg:inline-flex"
          >
            {t("enroll")}
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label={t("menu")}
                  className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-foreground/8 transition-colors outline-none hover:bg-primary/12 focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
                />
              }
            >
              <MenuIcon className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side="right"
              closeLabel={t("close")}
              className="w-[88%] max-w-sm gap-0 p-0"
            >
              <SheetHeader className="border-b border-foreground/8 p-5">
                <SheetTitle>
                  <Logo />
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {t("menuDescription")}
                </SheetDescription>
              </SheetHeader>
              <nav aria-label={t("menu")} className="flex flex-col gap-1 p-4">
                {navItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <SheetClose
                      key={item.href}
                      render={
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "rounded-2xl px-4 py-3 text-base font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            active
                              ? "bg-primary/12 text-brand-green-dark"
                              : "text-foreground/80 hover:bg-muted",
                          )}
                        >
                          {t(item.key)}
                        </Link>
                      }
                    />
                  );
                })}
              </nav>
              <div className="px-4 pb-2">
                <SheetClose
                  render={
                    <Link
                      href="/pamelding"
                      className="btn-pill-primary w-full justify-center"
                    >
                      {t("enrollCta")}
                    </Link>
                  }
                />
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-foreground/8 p-5">
                <LocaleSwitcher />
                <SheetClose
                  render={
                    <Link
                      href="/min-side/logg-inn"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold text-foreground/75 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <CircleUserRound aria-hidden="true" className="size-4.5" />
                      {t("admin")}
                    </Link>
                  }
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
