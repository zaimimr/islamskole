import { getTranslations } from "next-intl/server";
import { CalendarHeartIcon, ClockIcon, MapPinIcon, SparklesIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Blob, DottedArc, WaveDivider } from "./decor";
import { MediaFrame } from "./MediaFrame";

export async function Hero() {
  const t = await getTranslations("hero");

  const badges = [
    { icon: SparklesIcon, label: t("badgeAge") },
    { icon: ClockIcon, label: t("badgeWhen") },
    { icon: MapPinIcon, label: t("badgeWhere") },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-secondary/45 via-background to-background">
      <Blob className="-top-24 -left-24 h-80 w-80 text-primary/12 animate-float" />
      <Blob className="top-32 -right-20 h-72 w-72 text-accent/60 animate-float-slow" />
      <DottedArc className="bottom-24 left-8 hidden h-28 w-28 text-primary/20 lg:block" />

      <div className="section-shell relative grid items-center gap-12 pt-16 pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28">
        <div className="flex flex-col items-start gap-6 animate-rise">
          <span className="eyebrow">
            <CalendarHeartIcon className="size-4" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h1 className="text-4xl leading-[1.05] font-bold text-balance-pretty sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance-pretty sm:text-xl">
            {t("subtitle")}
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <Link href="/kontakt" className="btn-pill-primary">
              {t("ctaPrimary")}
            </Link>
            <Link href="/klasser" className="btn-pill-outline">
              {t("ctaSecondary")}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2.5 pt-4">
            {badges.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground/80 ring-1 ring-foreground/8"
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-rise [animation-delay:120ms]">
          <div className="absolute -top-6 -left-6 -z-10 h-full w-full rounded-[2.6rem] bg-primary/15" />
          <div className="absolute -right-5 -bottom-5 -z-10 size-28 rounded-full bg-secondary" />
          <MediaFrame
            alt=""
            tone="green"
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="aspect-[4/5] rounded-[2.4rem] shadow-[0_40px_80px_-40px_rgba(20,60,30,0.55)] ring-1 ring-foreground/10 sm:aspect-square"
          />
        </div>
      </div>

      <div className="text-card">
        <WaveDivider flip />
      </div>
    </section>
  );
}
