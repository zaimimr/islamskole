import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { localized, type EventItem } from "@/lib/data";
import { osloToday } from "@/lib/dates";
import type { Locale } from "@/i18n/routing";
import { formatPortalDay, formatPortalTime } from "@/lib/portal/parent-format";
import type { PortalSchoolDay } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

type UpcomingItem =
  | { kind: "day"; key: string; date: string; day: PortalSchoolDay }
  | { kind: "event"; key: string; date: string; event: EventItem };

export async function UpcomingList({
  locale,
  days,
  events,
  reported,
}: {
  locale: string;
  days: PortalSchoolDay[];
  events: EventItem[];
  reported: Record<string, string>;
}) {
  const t = await getTranslations({ locale, namespace: "portal.parent.upcoming" });
  const items: UpcomingItem[] = [
    ...days.map((day) => ({ kind: "day" as const, key: day.id, date: day.date, day })),
    ...events.map((event) => ({
      kind: "event" as const,
      key: event.id,
      date: osloToday(new Date(event.starts_at ?? "")),
      event,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section aria-labelledby="upcoming-title" className="grid gap-3">
      <h2 id="upcoming-title" className="font-heading text-xl font-semibold">
        {t("title")}
      </h2>
      {items.length ? (
        <ol className="soft-card grid divide-y divide-foreground/8 overflow-hidden">
          {items.map((item) => {
            const dateBlock = (
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-14 shrink-0 place-content-center rounded-2xl text-center leading-none",
                  item.kind === "event"
                    ? "bg-brand-sun/35 text-[#4a3a00]"
                    : item.day.cancelled
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/12 text-brand-green-dark",
                )}
              >
                <span className="font-heading text-xl font-semibold tabular-nums">
                  {formatPortalDay(item.date, locale, { day: "numeric" }).replace(".", "")}
                </span>
                <span className="text-xs font-bold uppercase">
                  {formatPortalDay(item.date, locale, { month: "short" }).replace(".", "")}
                </span>
              </span>
            );
            const dateText = formatPortalDay(item.date, locale);

            if (item.kind === "day") {
              return (
                <li key={item.key} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                  {dateBlock}
                  <div className="min-w-0">
                    <p className="font-semibold first-letter:uppercase">{dateText}</p>
                    <p className={cn("text-sm", item.day.cancelled ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {item.day.cancelled ? t("cancelled") : t("schoolDay")}
                      {item.day.note ? ` · ${item.day.note}` : null}
                    </p>
                    {reported[item.day.id] && !item.day.cancelled ? (
                      <p className="text-sm font-semibold text-accent-foreground">
                        {t("reported", { names: reported[item.day.id] })}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            }

            const time = formatPortalTime(item.event.starts_at, locale);
            return (
              <li key={item.key}>
                <Link
                  href={`/aktiviteter/${item.event.slug}`}
                  className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5"
                >
                  {dateBlock}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-pretty">{localized(item.event, "title", locale as Locale)}</p>
                    <p className="text-sm text-muted-foreground first-letter:uppercase">
                      {[dateText, time, item.event.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </section>
  );
}
