import { getTranslations } from "next-intl/server";
import { DoorOpenIcon, HandHeartIcon, MessagesSquareIcon, CompassIcon } from "lucide-react";
import { Section, SectionHeading } from "./Section";

const values = [
  { key: "openness", icon: DoorOpenIcon },
  { key: "respect", icon: HandHeartIcon },
  { key: "tolerance", icon: MessagesSquareIcon },
  { key: "clarity", icon: CompassIcon },
] as const;

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
        {values.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="group flex flex-col items-center gap-3 rounded-3xl bg-card p-7 text-center ring-1 ring-foreground/8 transition-colors hover:bg-primary/5"
          >
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary/12 text-brand-green-dark transition-transform duration-300 group-hover:scale-110">
              <Icon className="size-8" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-bold">{t(`items.${key}.title`)}</h3>
            <p className="text-sm text-muted-foreground text-balance-pretty">
              {t(`items.${key}.body`)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
