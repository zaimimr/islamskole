import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { PortalLoginForm } from "@/components/portal/portal-login-form";
import { getUser } from "@/lib/auth";

export default async function PortalLoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/min-side/logg-inn">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, query, t] = await Promise.all([
    getUser(),
    searchParams,
    getTranslations("portal"),
  ]);
  if (user) redirect({ href: "/min-side", locale });

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 pt-2 sm:pt-8">
      <div className="grid gap-2">
        <h1 className="font-heading text-3xl font-semibold text-balance">{t("login.title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("login.intro")}</p>
      </div>
      <div className="soft-card p-5 sm:p-7">
        <PortalLoginForm invalidLink={query.lenke === "ugyldig"} />
      </div>
      <NextLink
        href="/login"
        className="inline-flex min-h-11 w-fit items-center rounded-lg px-1 text-sm font-semibold text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("login.adminHint")}
      </NextLink>
    </div>
  );
}
