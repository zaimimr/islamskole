import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/site/Logo";
import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { PortalSignOutButton } from "@/components/portal/portal-sign-out-button";
import { getUser } from "@/lib/auth";

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]/min-side">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portal" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function PortalLayout({
  children,
  params,
}: LayoutProps<"/[locale]/min-side">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, user] = await Promise.all([getTranslations("portal"), getUser()]);

  return (
    <div data-portal-shell className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-foreground/8 bg-background/90 supports-backdrop-filter:backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2 sm:px-6">
          <Logo priority className="mr-auto" />
          <LocaleSwitcher />
          {user ? (
            <div className="flex min-w-0 items-center gap-2">
              <p className="hidden min-w-0 text-right text-sm leading-tight sm:block">
                <span className="block text-muted-foreground">{t("signedInAs")}</span>
                <span className="block max-w-[14rem] truncate font-semibold">{user.email}</span>
              </p>
              <PortalSignOutButton label={t("signOut")} />
            </div>
          ) : null}
        </div>
        {user ? (
          <p className="mx-auto w-full max-w-3xl truncate px-4 pb-2 text-sm text-muted-foreground sm:hidden">
            {t("signedInAs")} <span className="font-semibold text-foreground">{user.email}</span>
          </p>
        ) : null}
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}
