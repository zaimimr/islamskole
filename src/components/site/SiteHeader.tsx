"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MenuIcon, LogInIcon } from "lucide-react";
import NextLink from "next/link";
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
  { href: "/", key: "home" },
  { href: "/klasser", key: "classes" },
  { href: "/aktiviteter", key: "events" },
  { href: "/om-oss", key: "about" },
  { href: "/bli-laerer", key: "teacher" },
  { href: "/kontakt", key: "contact" },
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
    <header className="sticky top-0 z-50 border-b border-foreground/8 bg-background/85 backdrop-blur-md">
      <div className="section-shell flex h-18 items-center justify-between gap-4 py-3">
        <Logo priority />

        <nav aria-label={t("menu")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-full px-4 py-2 text-[0.95rem] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "bg-primary/12 text-brand-green-dark"
                        : "text-foreground/75 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>
          <NextLink
            href="/login"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-foreground/70 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
          >
            <LogInIcon className="size-4" aria-hidden="true" />
            {t("admin")}
          </NextLink>
          <Link
            href="/pamelding"
            className="btn-pill-primary hidden h-11 px-5 py-0 text-sm lg:inline-flex"
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
            <SheetContent side="right" className="w-[88%] max-w-sm gap-0 p-0">
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
              <div className="mt-auto flex flex-col gap-4 border-t border-foreground/8 p-5">
                <SheetClose
                  render={
                    <Link href="/pamelding" className="btn-pill-primary w-full">
                      {t("enroll")}
                    </Link>
                  }
                />
                <div className="flex items-center justify-between">
                  <SheetClose
                    render={
                      <NextLink
                        href="/login"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-foreground"
                      >
                        <LogInIcon className="size-4" aria-hidden="true" />
                        {t("admin")}
                      </NextLink>
                    }
                  />
                  <LocaleSwitcher />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
