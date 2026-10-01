import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/components/portal/portal-login-form";
import { PortalSmsLoginForm } from "@/components/portal/portal-sms-login-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getIsAdmin, getUser } from "@/lib/auth";
import { resolvePostLoginPath, safeNextPath } from "@/lib/auth-redirect";
import { smsEnabled } from "@/lib/sms";

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

  const sms = smsEnabled();
  const emailForm = (
    <PortalLoginForm invalidLink={query.lenke === "ugyldig"} next={next ?? undefined} />
  );

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 pt-2 sm:pt-8">
      <div className="grid gap-2">
        <h1 className="font-heading text-3xl font-semibold text-balance">{t("login.title")}</h1>
        <p className="text-pretty text-muted-foreground">{t(sms ? "login.introSms" : "login.intro")}</p>
      </div>
      <div className="soft-card p-5 sm:p-7">
        {sms ? (
          <Tabs defaultValue="email" className="gap-5">
            <TabsList className="w-full">
              <TabsTrigger value="email">{t("login.sms.tabEmail")}</TabsTrigger>
              <TabsTrigger value="sms">{t("login.sms.tabSms")}</TabsTrigger>
            </TabsList>
            <TabsContent value="email">{emailForm}</TabsContent>
            <TabsContent value="sms">
              <PortalSmsLoginForm next={next ?? undefined} />
            </TabsContent>
          </Tabs>
        ) : (
          emailForm
        )}
      </div>
    </div>
  );
}
