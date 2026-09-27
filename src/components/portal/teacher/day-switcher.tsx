"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
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
          <SelectField
            id="school-day"
            value={selectedId}
            disabled={pending}
            onValueChange={(id) => {
              startTransition(() => router.push(href(id), { scroll: false }));
            }}
            triggerClassName="font-semibold sm:text-base"
            options={days.map((day) => ({
              value: day.id,
              label: optionLabel(day),
            }))}
          />
          {pending ? (
            <Loader2 aria-hidden="true" className="pointer-events-none absolute top-1/2 right-9 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
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
