import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { ContactCard } from "@/components/site/ContactCard";
import { EnrollCta } from "@/components/site/EnrollCta";
import { MediaFrame } from "@/components/site/MediaFrame";
import { Blob } from "@/components/site/decor";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/kontakt">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function ContactPage({
  params,
}: PageProps<"/[locale]/kontakt">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <>
      <PageHeader
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Section className="bg-card">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <ContactCard showSummary />
          <div className="relative">
            <Blob className="-top-6 -right-6 -z-10 h-44 w-44 text-secondary animate-float" />
            <MediaFrame
              alt=""
              tone="green"
              className="aspect-[4/3] rounded-[2.2rem] shadow-[0_30px_70px_-40px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10"
              sizes="(min-width: 1024px) 45vw, 100vw"
            />
            <div className="mt-5 rounded-3xl bg-primary/8 p-6">
              <h2 className="text-lg font-bold">{t("summaryTitle")}</h2>
              <p className="mt-1.5 text-base text-muted-foreground">
                {t("addressValue")}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <EnrollCta />
    </>
  );
}
