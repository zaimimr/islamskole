import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/salgsbetingelser">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("title"), description: t("subtitle") };
}

type SellerRow = { label: string; value: string };
type TermsSection = { heading: string; body: string[] };

export default async function TermsPage({
  params,
}: PageProps<"/[locale]/salgsbetingelser">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  const seller = t.raw("seller") as SellerRow[];
  const sections = t.raw("sections") as TermsSection[];

  return (
    <>
      <PageHeader
        eyebrow={`${t("updatedLabel")} ${t("updated")}`}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Section className="bg-card">
        <div className="mx-auto max-w-3xl">
          <div className="soft-card p-7 sm:p-9">
            <h2 className="text-xl font-bold">{t("sellerTitle")}</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              {seller.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-0.5 sm:col-span-2 sm:grid-cols-subgrid"
                >
                  <dt className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {row.label}
                  </dt>
                  <dd className="text-base font-semibold text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-10 flex flex-col gap-10">
            {sections.map((section, index) => (
              <section key={section.heading} className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold">
                  <span className="text-muted-foreground">{index + 1}. </span>
                  {section.heading}
                </h2>
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-lg leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
