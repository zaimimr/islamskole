import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UsersRoundIcon, GraduationCapIcon, HeartIcon } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/site/Section";
import { VisionPillars } from "@/components/site/VisionPillars";
import { ValuesStrip } from "@/components/site/ValuesStrip";
import { EnrollCta } from "@/components/site/EnrollCta";
import { MediaFrame } from "@/components/site/MediaFrame";
import { Blob } from "@/components/site/decor";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/om-oss">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/om-oss">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  const facts = [
    { icon: GraduationCapIcon, value: "12 år" },
    { icon: UsersRoundIcon, value: "8-12" },
    { icon: HeartIcon, value: "6-18" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <Section className="bg-card">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <Blob className="-top-8 -left-8 -z-10 h-44 w-44 text-secondary animate-float-slow" />
            <MediaFrame
              alt=""
              tone="green"
              className="aspect-[4/3] rounded-[2.2rem] shadow-[0_30px_70px_-40px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10"
              sizes="(min-width: 1024px) 45vw, 100vw"
            />
          </div>
          <div className="flex flex-col gap-5">
            <h2 className="text-3xl font-bold text-balance-pretty sm:text-4xl">
              {t("storyTitle")}
            </h2>
            <p className="text-lg text-muted-foreground text-balance-pretty">
              {t("storyBody")}
            </p>
          </div>
        </div>
      </Section>

      <VisionPillars />
      <ValuesStrip />

      <Section className="bg-card">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5 lg:order-2">
            <h2 className="text-3xl font-bold text-balance-pretty sm:text-4xl">
              {t("approachTitle")}
            </h2>
            <p className="text-lg text-muted-foreground text-balance-pretty">
              {t("approachBody")}
            </p>
          </div>
          <div className="relative lg:order-1">
            <Blob className="-right-8 -bottom-8 -z-10 h-44 w-44 text-accent animate-float" />
            <MediaFrame
              alt=""
              tone="sky"
              className="aspect-[4/3] rounded-[2.2rem] shadow-[0_30px_70px_-40px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10"
              sizes="(min-width: 1024px) 45vw, 100vw"
            />
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 rounded-[2.6rem] bg-primary/8 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-bold text-balance-pretty sm:text-4xl">
              {t("communityTitle")}
            </h2>
            <p className="text-lg text-muted-foreground text-balance-pretty">
              {t("communityBody")}
            </p>
          </div>
          <ul className="grid grid-cols-3 gap-4">
            {facts.map(({ icon: Icon, value }) => (
              <li
                key={value}
                className="flex flex-col items-center gap-2 rounded-3xl bg-card p-5 text-center ring-1 ring-foreground/8"
              >
                <Icon className="size-7 text-brand-green-dark" aria-hidden="true" />
                <span className="text-2xl font-bold">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <EnrollCta />
    </>
  );
}
