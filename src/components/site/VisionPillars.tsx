import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "./Section";

const pillars = ["wellbeing", "learning", "identity"] as const;

export async function VisionPillars() {
  const t = await getTranslations("vision");

  return (
    <Section className="bg-card" ariaLabelledby="vision-heading">
      <SectionHeading
        id="vision-heading"
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {pillars.map((key) => (
          <li
            key={key}
            className="soft-card group flex flex-col gap-0 overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="relative aspect-[4/3] w-full bg-primary/10">
              <Image
                src={`/brand/vision-${key}.png`}
                alt=""
                fill
                sizes="(min-width: 768px) 30vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-3 p-7">
              <h3 className="text-xl font-bold">{t(`pillars.${key}.title`)}</h3>
              <p className="text-base text-muted-foreground text-balance-pretty">
                {t(`pillars.${key}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
