import { getTranslations } from "next-intl/server";
import { HeartHandshakeIcon, BookOpenIcon, ShieldCheckIcon } from "lucide-react";
import { Section, SectionHeading } from "./Section";

const pillars = [
  { key: "wellbeing", icon: HeartHandshakeIcon, tone: "bg-secondary text-secondary-foreground" },
  { key: "learning", icon: BookOpenIcon, tone: "bg-accent text-accent-foreground" },
  { key: "identity", icon: ShieldCheckIcon, tone: "bg-primary/15 text-brand-green-dark" },
] as const;

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
        {pillars.map(({ key, icon: Icon, tone }) => (
          <li
            key={key}
            className="soft-card group flex flex-col gap-4 p-7 transition-transform duration-300 hover:-translate-y-1"
          >
            <span
              className={`inline-flex size-14 items-center justify-center rounded-2xl ${tone}`}
            >
              <Icon className="size-7" aria-hidden="true" />
            </span>
            <h3 className="text-xl font-bold">{t(`pillars.${key}.title`)}</h3>
            <p className="text-base text-muted-foreground text-balance-pretty">
              {t(`pillars.${key}.body`)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
