import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getPublishedClasses } from "@/lib/data";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { ClassCard } from "@/components/site/ClassCard";
import { EmptyState } from "@/components/site/EmptyState";
import { EnrollCta } from "@/components/site/EnrollCta";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/klasser">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "classes" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function ClassesPage({
  params,
}: PageProps<"/[locale]/klasser">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const t = await getTranslations("classes");
  const classes = await getPublishedClasses();

  return (
    <>
      <PageHeader
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <Section className="bg-card pt-12">
        <p className="mx-auto max-w-3xl text-center text-lg text-muted-foreground text-balance-pretty">
          {t("intro")}
        </p>
        <div className="mt-12">
          {classes.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((item) => (
                <ClassCard key={item.id} item={item} locale={typedLocale} />
              ))}
            </div>
          ) : (
            <EmptyState message={t("empty")} />
          )}
        </div>
      </Section>
      <EnrollCta />
    </>
  );
}
