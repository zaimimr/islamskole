"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DayOption = {
  id: string;
  label: string;
  cancelled: boolean;
  isToday: boolean;
};

export function DaySwitcher({
  classId,
  days,
  selectedId,
}: {
  classId: string;
  days: DayOption[];
  selectedId: string;
}) {
  const t = useTranslations("portal.teacher.day");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const index = days.findIndex((day) => day.id === selectedId);
  const previous = index > 0 ? days[index - 1] : null;
  const next = index >= 0 && index < days.length - 1 ? days[index + 1] : null;
  const href = (id: string) => `/min-side/klasse/${classId}?dag=${id}`;

  function optionLabel(day: DayOption) {
    if (day.cancelled) return `${day.label} (${t("cancelled")})`;
    if (day.isToday) return `${day.label} (${t("today")})`;
    return day.label;
  }

  return (
    <div className="grid gap-2">
      <label htmlFor="school-day" className="text-sm font-semibold">
        {t("label")}
      </label>
      <div className="flex items-center gap-2">
        {previous ? (
          <Link
            href={href(previous.id)}
            scroll={false}
            aria-label={t("previous")}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "opacity-40")}>
            <ChevronLeft />
          </span>
        )}
        <div className="relative min-w-0 flex-1">
          <select
            id="school-day"
            value={selectedId}
            disabled={pending}
            onChange={(event) => {
              const id = event.target.value;
              startTransition(() => router.push(href(id), { scroll: false }));
            }}
            className="h-11 w-full min-w-0 appearance-none truncate rounded-xl border border-input bg-card pr-10 pl-3 text-base font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
          >
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {optionLabel(day)}
              </option>
            ))}
          </select>
          {pending ? (
            <Loader2 aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
          )}
        </div>
        {next ? (
          <Link
            href={href(next.id)}
            scroll={false}
            aria-label={t("next")}
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "opacity-40")}>
            <ChevronRight />
          </span>
        )}
      </div>
    </div>
  );
}
