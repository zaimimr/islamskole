import { getTranslations } from "next-intl/server";
import { ClockIcon, CalendarRangeIcon, ClipboardCheckIcon, LibraryBigIcon } from "lucide-react";
import { Section, SectionHeading } from "./Section";

const items = [
  { icon: ClockIcon, titleKey: "scheduleTitle", bodyKey: "schedule" },
  { icon: CalendarRangeIcon, titleKey: "seasonTitle", bodyKey: "season" },
  { icon: ClipboardCheckIcon, titleKey: "enrollmentOpensTitle", bodyKey: "enrollmentOpens" },
  { icon: LibraryBigIcon, titleKey: "curriculumTitle", bodyKey: "curriculum" },
] as const;

export async function InfoSection() {
  const t = await getTranslations("info");

  return (
    <Section className="bg-card" ariaLabelledby="info-heading">
      <SectionHeading
        id="info-heading"
        eyebrow={t("title")}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, titleKey, bodyKey }) => (
          <li
            key={titleKey}
            className="flex flex-col gap-3 rounded-3xl bg-background p-6 ring-1 ring-foreground/8"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-brand-green-dark">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <h3 className="text-base font-bold">{t(titleKey)}</h3>
            <p className="text-sm text-muted-foreground text-balance-pretty">
              {t(bodyKey)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
