import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarClock, CalendarRange, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { Blob } from "@/components/site/decor";
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
      />

      <Section className="bg-card">
        <div className="grid gap-3 sm:grid-cols-3">
          {factKeys.map((key, index) => {
            const Icon = factIcons[index];
            return (
              <div
                key={key}
                className="flex items-center gap-4 rounded-3xl bg-primary/6 p-6"
              >
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-brand-green-dark">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-foreground">
                  {t(`facts.${key}`)}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="relative mx-auto max-w-2xl">
          <Blob className="-top-10 -right-10 -z-10 h-40 w-40 text-accent animate-float" />
          <div className="rounded-[2.4rem] bg-card p-7 shadow-[0_30px_70px_-50px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10 sm:p-10">
            <h2 className="font-heading text-2xl font-bold">{t("formTitle")}</h2>
            <p className="mt-2 mb-7 text-base text-muted-foreground">
              {t("formSubtitle")}
            </p>
            <StudentSignupForm fee={fee} />
          </div>
        </div>
      </Section>
    </>
  );
}
