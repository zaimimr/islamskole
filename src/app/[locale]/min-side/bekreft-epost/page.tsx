import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ConfirmEmailForm } from "@/components/portal/family/confirm-email-form";
import { buttonVariants } from "@/components/ui/button";
import { getEmailChangeByToken, isEmailChangeOpen } from "@/lib/portal/family-data";

export default async function ConfirmEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/min-side/bekreft-epost">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const token = typeof query.token === "string" ? query.token : "";
  const done = query.ferdig === "1";
  const [t, change] = await Promise.all([
    getTranslations({ locale, namespace: "portal.family.confirm" }),
    token && !done ? getEmailChangeByToken(token) : null,
  ]);

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 pt-2 sm:pt-8">
      <div className="soft-card p-5 sm:p-7">
        {done ? (
          <div className="grid gap-4" role="status">
            <h1 className="flex items-center gap-2 font-heading text-3xl font-semibold text-balance">
              <CheckCircle2 aria-hidden="true" className="size-7 shrink-0 text-brand-green-dark" />
              {t("successTitle")}
            </h1>
            <p className="text-pretty">{t("success")}</p>
            <Link href="/min-side/logg-inn" className={buttonVariants({ className: "w-full sm:w-fit" })}>
              {t("login")}
            </Link>
          </div>
        ) : change && isEmailChangeOpen(change) ? (
          <ConfirmEmailForm token={token} email={change.new_email} />
        ) : (
          <div className="grid gap-4">
            <h1 className="font-heading text-3xl font-semibold text-balance">{t("expiredTitle")}</h1>
            <p className="text-pretty">{t("expired")}</p>
            <Link href="/min-side" className={buttonVariants({ variant: "outline", className: "w-full sm:w-fit" })}>
              {t("home")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
