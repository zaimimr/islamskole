import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarClock, CalendarRange, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { StudentSignupForm } from "@/components/site/StudentSignupForm";
import { contentMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";

async function getActiveFee() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("school_years")
    .select("fee")
    .eq("is_active", true)
    .maybeSingle();
  return (data as unknown as { fee: number | null } | null)?.fee ?? 5000;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pamelding">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "enrollForm" });
  return contentMetadata({
    locale: locale as Locale,
    title: t("title"),
    description: t("subtitle"),
    basePath: "/pamelding",
  });
}

const factIcons = [CalendarClock, CalendarRange, Sparkles] as const;
const factKeys = ["schedule", "season", "ages"] as const;

export default async function PameldingPage({
  params,
}: PageProps<"/[locale]/pamelding">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("enrollForm");
  const fee = await getActiveFee();

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        compact
      />

      <Section className="bg-card py-10 sm:py-12">
        <div className="grid overflow-hidden rounded-2xl border border-foreground/10 bg-border sm:grid-cols-3 sm:gap-px">
          {factKeys.map((key, index) => {
            const Icon = factIcons[index];
            return (
              <div key={key} className="flex items-center gap-4 bg-card p-5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-brand-green-dark">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {t(`facts.${key}`)}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-card p-6 shadow-[0_24px_60px_-44px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10 sm:p-10">
            <h2 className="font-heading text-2xl font-bold">
              {t("formTitle")}
            </h2>
            <p className="mt-2 mb-7 text-base text-muted-foreground">
              {t("formSubtitle")}
            </p>
            <StudentSignupForm fee={fee} locale={locale} />
          </div>
        </div>
      </Section>
    </>
  );
}
