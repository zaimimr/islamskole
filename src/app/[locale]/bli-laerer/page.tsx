import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeartHandshake, BookOpenText, Users, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { Blob } from "@/components/site/decor";
import { TeacherSignupForm } from "@/components/site/TeacherSignupForm";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bli-laerer">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "teacher" });
  return { title: t("title"), description: t("subtitle") };
}

const valueKeys = ["openness", "respect", "tolerance", "clarity"] as const;

const reasonIcons = [HeartHandshake, BookOpenText, Users, Sparkles] as const;
const reasonKeys = ["community", "knowledge", "children", "growth"] as const;

export default async function BliLaererPage({
  params,
}: PageProps<"/[locale]/bli-laerer">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teacher");
  const tv = await getTranslations("values");

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Section className="bg-card">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">
            {t("introTitle")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance-pretty">
            {t("introBody")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {reasonKeys.map((key, index) => {
            const Icon = reasonIcons[index];
            return (
              <div
                key={key}
                className="flex items-start gap-4 rounded-3xl bg-primary/6 p-6"
              >
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-brand-green-dark">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-heading text-lg font-bold">
                    {t(`reasons.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-base text-muted-foreground">
                    {t(`reasons.${key}.body`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">
            {t("valuesTitle")}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground text-balance-pretty">
            {t("valuesBody")}
          </p>
        </div>
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
          {valueKeys.map((key) => (
            <span
              key={key}
              className="rounded-full bg-secondary/50 px-5 py-2 text-base font-semibold text-brand-green-dark"
            >
              {tv(`items.${key}.title`)}
            </span>
          ))}
        </div>
      </Section>

      <Section className="bg-card">
        <div className="relative mx-auto max-w-2xl">
          <Blob className="-top-10 -left-10 -z-10 h-40 w-40 text-secondary animate-float" />
          <div className="rounded-[2.4rem] bg-background p-7 shadow-[0_30px_70px_-50px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10 sm:p-10">
            <h2 className="font-heading text-2xl font-bold">
              {t("formTitle")}
            </h2>
            <p className="mt-2 mb-7 text-base text-muted-foreground">
              {t("formSubtitle")}
            </p>
            <TeacherSignupForm />
          </div>
        </div>
      </Section>
    </>
  );
}
