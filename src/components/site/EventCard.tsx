import { getTranslations } from "next-intl/server";
import { CalendarDaysIcon, MapPinIcon, ArrowRightIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { localized, type EventItem } from "@/lib/data";
import type { Locale } from "@/i18n/routing";
import { MediaFrame } from "./MediaFrame";
import { formatEventDate, isThisWeek } from "./format";

type EventCardProps = {
  item: EventItem;
  locale: Locale;
};

export async function EventCard({ item, locale }: EventCardProps) {
  const t = await getTranslations("events");
  const title = localized(item, "title", locale);
  const excerpt = localized(item, "excerpt", locale);
  const dateLabel = formatEventDate(item.starts_at, locale);
  const thisWeek = isThisWeek(item.starts_at);

  return (
    <article className="group/card soft-card flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <div className="relative">
        <MediaFrame
          src={item.image_url}
          alt={title}
          tone="sun"
          className="aspect-[16/10] w-full"
        />
        {thisWeek && (
          <span className="absolute left-3 top-3 rounded-full bg-brand-sun px-3 py-1 text-xs font-bold text-[#3a2e00] shadow-sm">
            {t("thisWeek")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-brand-green-dark">
          {dateLabel && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDaysIcon className="size-4" aria-hidden="true" />
              {dateLabel}
            </span>
          )}
          {item.location && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MapPinIcon className="size-4" aria-hidden="true" />
              {item.location}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        {excerpt && (
          <p className="line-clamp-3 text-base text-muted-foreground text-balance-pretty">
            {excerpt}
          </p>
        )}
        <Link
          href={`/aktiviteter/${item.slug}`}
          className="mt-auto inline-flex items-center gap-1.5 pt-2 text-base font-bold text-brand-green-dark outline-none focus-visible:underline"
        >
          {t("readMore")}
          <ArrowRightIcon
            className="size-4 transition-transform group-hover/card:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}
