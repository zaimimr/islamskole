import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/components/portal/portal-login-form";
import { getIsAdmin, getUser } from "@/lib/auth";
import { resolvePostLoginPath, safeNextPath } from "@/lib/auth-redirect";

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
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);
  if (user) {
    redirect(resolvePostLoginPath({ next, isAdmin: await getIsAdmin(), locale }));
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 pt-2 sm:pt-8">
      <div className="grid gap-2">
        <h1 className="font-heading text-3xl font-semibold text-balance">{t("login.title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("login.intro")}</p>
      </div>
      <div className="soft-card p-5 sm:p-7">
        <PortalLoginForm
          invalidLink={query.lenke === "ugyldig"}
          next={next ?? undefined}
        />
      </div>
    </div>
  );
}
