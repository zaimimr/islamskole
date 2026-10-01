import { getTranslations } from "next-intl/server";
import { ArrowRightIcon, SmartphoneIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Section, SectionHeading } from "./Section";
import { Blob } from "./decor";
import { VIPPS_NUMBER, VippsDonateButton } from "./VippsDonateButton";

export async function DonateCta() {
  const t = await getTranslations("donate");

  return (
    <Section ariaLabelledby="home-donate-heading">
      <div className="soft-card relative grid overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative p-7 sm:p-12">
          <Blob className="-top-20 -left-16 h-56 w-56 text-primary/8 animate-float-slow" />
          <div className="relative">
            <SectionHeading
              id="home-donate-heading"
              align="left"
              eyebrow={t("home.eyebrow")}
              title={t("home.title")}
              subtitle={t("home.body")}
            />
          </div>
        </div>
        <div className="relative flex flex-col items-start justify-center gap-5 bg-secondary/45 p-7 sm:p-12">
          <VippsDonateButton className="w-full sm:w-auto" />
          <p className="flex items-center gap-2 text-base text-foreground/80">
            <SmartphoneIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {t("numberLabel")}{" "}
              <span className="font-bold text-foreground tabular-nums">{VIPPS_NUMBER}</span>
            </span>
          </p>
          <Link
            href="/donasjon"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-base font-bold text-brand-green-dark outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("home.more")}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Section>
  );
}
