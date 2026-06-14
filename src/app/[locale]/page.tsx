import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublishedClasses, getPublishedEvents } from "@/lib/data";
import { Hero } from "@/components/site/Hero";
import { VisionPillars } from "@/components/site/VisionPillars";
import { ValuesStrip } from "@/components/site/ValuesStrip";
import { InfoSection } from "@/components/site/InfoSection";
import { EnrollCta } from "@/components/site/EnrollCta";
import { ContactCard } from "@/components/site/ContactCard";
import { ClassCard } from "@/components/site/ClassCard";
import { EventCard } from "@/components/site/EventCard";
import { EmptyState } from "@/components/site/EmptyState";
import { Section, SectionHeading } from "@/components/site/Section";
import { isUpcoming } from "@/components/site/format";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hero" });
  return {
    title: "Islamskole Bærum",
    description: t("subtitle"),
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const [t, classes, events] = await Promise.all([
    getTranslations(),
    getPublishedClasses(),
    getPublishedEvents(),
  ]);

  const previewClasses = classes.slice(0, 3);
  const previewEvents = events.filter((e) => isUpcoming(e.starts_at)).slice(0, 3);

  return (
    <>
      <Hero />

      <Section className="bg-card" ariaLabelledby="home-events-heading">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="home-events-heading"
            align="left"
            eyebrow={t("events.title")}
            title={t("events.previewTitle")}
            subtitle={t("events.previewSubtitle")}
          />
          <Link
            href="/aktiviteter"
            className="inline-flex shrink-0 items-center gap-1.5 text-base font-bold text-brand-green-dark outline-none focus-visible:underline"
          >
            {t("events.viewAll")}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-10">
          {previewEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {previewEvents.map((item) => (
                <EventCard key={item.id} item={item} locale={typedLocale} />
              ))}
            </div>
          ) : (
            <EmptyState message={t("events.emptyUpcoming")} />
          )}
        </div>
      </Section>

      <VisionPillars />
      <ValuesStrip />

      <Section ariaLabelledby="home-classes-heading">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="home-classes-heading"
            align="left"
            eyebrow={t("classes.title")}
            title={t("classes.previewTitle")}
            subtitle={t("classes.previewSubtitle")}
          />
          <Link
            href="/klasser"
            className="inline-flex shrink-0 items-center gap-1.5 text-base font-bold text-brand-green-dark outline-none focus-visible:underline"
          >
            {t("classes.viewAll")}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-10">
          {previewClasses.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {previewClasses.map((item) => (
                <ClassCard key={item.id} item={item} locale={typedLocale} />
              ))}
            </div>
          ) : (
            <EmptyState message={t("classes.empty")} />
          )}
        </div>
      </Section>

      <InfoSection />
      <EnrollCta />

      <Section ariaLabelledby="home-contact-heading">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SectionHeading
            id="home-contact-heading"
            align="left"
            eyebrow={t("contact.title")}
            title={t("contact.title")}
            subtitle={t("contact.subtitle")}
          />
          <ContactCard />
        </div>
      </Section>
    </>
  );
}
