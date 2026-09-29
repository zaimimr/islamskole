import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ContinuesQuestion } from "@/components/portal/enroll/continues-question";
import { SiblingForm, type SiblingFamily } from "@/components/portal/enroll/sibling-form";
import { formatNok } from "@/lib/money";
import { getPortalContext } from "@/lib/portal/data";
import { getMyFamilies } from "@/lib/portal/family-data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/min-side/pamelding">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portal.enroll" });
  return { title: t("title") };
}

export default async function EnrollmentPage({ params }: PageProps<"/[locale]/min-side/pamelding">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const context = await getPortalContext();
  if (!context.user) redirect({ href: "/min-side/logg-inn", locale });

  const [t, families, { data: year }] = await Promise.all([
    getTranslations({ locale, namespace: "portal.enroll" }),
    getMyFamilies(),
    createAdminClient().from("school_years").select("label, fee, enrollment_fee").eq("is_active", true).maybeSingle(),
  ]);

  const children = families.flatMap((family) => family.children.filter((child) => child.active_this_year));
  const siblingFamilies: SiblingFamily[] = families.map((family) => ({
    id: family.id,
    name: family.display_name ?? "",
    parents: new Intl.ListFormat(locale === "en" ? "en-GB" : "nb-NO", { type: "conjunction" }).format(
      family.guardians.map((guardian) => [guardian.first_name, guardian.last_name].filter(Boolean).join(" ")).filter(Boolean),
    ),
    address: family.address ?? "",
    postalCode: family.postal_code ?? "",
    city: family.city ?? "",
  }));
  const deposit = year?.fee ? Math.min(year.enrollment_fee ?? year.fee, year.fee) * 100 : null;

  return (
    <div className="grid gap-10">
      <header className="grid gap-1">
        <h1 className="font-heading text-3xl font-semibold text-balance">{t("title")}</h1>
        <p className="text-pretty text-muted-foreground">{t("intro")}</p>
      </header>

      {families.length === 0 ? (
        <p className="soft-card p-5 text-muted-foreground sm:p-6">{t("noFamily")}</p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-8">
          <section aria-labelledby="continues-title" className="grid gap-3">
            <div className="grid gap-1">
              <h2 id="continues-title" className="font-heading text-2xl font-semibold">
                {t("continues.title")}
              </h2>
              <p className="text-pretty text-muted-foreground">{t("continues.intro")}</p>
            </div>
            {children.length ? (
              <ul className="soft-card grid divide-y divide-foreground/8 overflow-hidden">
                {children.map((child) => (
                  <ContinuesQuestion
                    key={child.id}
                    studentId={child.id}
                    name={child.first_name ?? ""}
                    value={child.continues_next_year}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("continues.none")}</p>
            )}
          </section>

          <section aria-labelledby="sibling-title" className="grid gap-3">
            <div className="grid gap-1">
              <h2 id="sibling-title" className="font-heading text-2xl font-semibold">
                {t("sibling.title")}
              </h2>
              <p className="text-pretty text-muted-foreground">{t("sibling.intro")}</p>
            </div>
            <div className="soft-card p-5 sm:p-6">
              {deposit ? (
                <SiblingForm families={siblingFamilies} deposit={formatNok(deposit)} />
              ) : (
                <p className="text-muted-foreground">{t("sibling.closed")}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
