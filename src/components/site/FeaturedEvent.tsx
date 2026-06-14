import { getTranslations } from "next-intl/server";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { localized, type EventItem } from "@/lib/data";
import type { Locale } from "@/i18n/routing";
import { MediaFrame } from "./MediaFrame";
import { formatEventDate, formatEventTime } from "./format";

export async function FeaturedEvent({
  event,
  locale,
}: {
  event: EventItem;
  locale: Locale;
}) {
  const t = await getTranslations("events");
  const title = localized(event, "title", locale);
  const excerpt = localized(event, "excerpt", locale);
  const dateLabel = formatEventDate(event.starts_at, locale);
  const startTime = formatEventTime(event.starts_at, locale);

  const facts = [
    dateLabel ? { icon: CalendarDaysIcon, value: dateLabel } : null,
    startTime ? { icon: ClockIcon, value: startTime } : null,
    event.location ? { icon: MapPinIcon, value: event.location } : null,
  ].filter((f): f is { icon: typeof CalendarDaysIcon; value: string } => f !== null);

  return (
    <section className="section-shell py-6 sm:py-8" aria-label={t("thisWeek")}>
      <div className="overflow-hidden rounded-[2.4rem] bg-secondary/60 ring-1 ring-foreground/8 md:grid md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-4 p-7 sm:p-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-sun px-4 py-1.5 text-sm font-bold text-[#3a2e00]">
            {t("thisWeek")}
          </span>
          <h2 className="font-heading text-2xl font-bold text-balance-pretty sm:text-3xl">
            {title}
          </h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-base font-semibold text-brand-green-dark">
            {facts.map(({ icon: Icon, value }) => (
              <li key={value} className="inline-flex items-center gap-1.5">
                <Icon className="size-4" aria-hidden="true" />
                {value}
              </li>
            ))}
          </ul>
          {excerpt && (
            <p className="text-base text-muted-foreground text-balance-pretty">
              {excerpt}
            </p>
          )}
          <Link
            href={`/aktiviteter/${event.slug}`}
            className="btn-pill-primary mt-1 w-fit"
          >
            {t("readMore")}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative min-h-56 md:min-h-full">
          <MediaFrame
            src={event.image_url}
            alt={title}
            tone="sun"
            priority
            sizes="(min-width: 768px) 45vw, 100vw"
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}
