import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "./Section";

const values = ["openness", "respect", "tolerance", "clarity"] as const;

export async function ValuesStrip() {
  const t = await getTranslations("values");

  return (
    <Section ariaLabelledby="values-heading">
      <SectionHeading
        id="values-heading"
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {values.map((key) => (
          <li
            key={key}
            className="group flex flex-col overflow-hidden rounded-3xl bg-card text-center ring-1 ring-foreground/8 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="relative aspect-square w-full bg-primary/8">
              <Image
                src={`/brand/value-${key}.png`}
                alt=""
                fill
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-2 p-6">
              <h3 className="text-lg font-bold">{t(`items.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground text-balance-pretty">
                {t(`items.${key}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
