"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { LayoutDashboardIcon, LogInIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FooterAccountLink() {
  const t = useTranslations("nav");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const AccountIcon = isLoggedIn ? LayoutDashboardIcon : LogInIcon;

  return (
    <NextLink
      href={isLoggedIn ? "/admin" : "/login"}
      className="inline-flex min-h-11 items-center gap-1.5 font-semibold transition-colors hover:text-primary-foreground focus-visible:underline outline-none sm:min-h-0"
    >
      <AccountIcon className="size-4" aria-hidden="true" />
      {isLoggedIn ? t("dashboard") : t("admin")}
    </NextLink>
  );
}
