import { getTranslations } from "next-intl/server";
import { UsersIcon, CakeIcon, ArrowRightIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { localized, type ClassItem } from "@/lib/data";
import type { Locale } from "@/i18n/routing";
import { MediaFrame } from "./MediaFrame";

type ClassCardProps = {
  item: ClassItem;
  locale: Locale;
};

export async function ClassCard({ item, locale }: ClassCardProps) {
  const t = await getTranslations("classes");
  const name = localized(item, "name", locale);
  const description = localized(item, "description", locale);

  return (
    <article className="group/card soft-card flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <MediaFrame
        src={item.image_url}
        alt={name}
        tone="sky"
        className="aspect-[16/10] w-full"
      />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <h3 className="text-xl font-bold">{name}</h3>
        <div className="flex flex-wrap gap-2">
          {item.age_min != null && item.age_max != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
              <CakeIcon className="size-4" aria-hidden="true" />
              {t("ageYears", { min: item.age_min, max: item.age_max })}
            </span>
          )}
          {item.capacity != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              <UsersIcon className="size-4" aria-hidden="true" />
              {t("capacityValue", { count: item.capacity })}
            </span>
          )}
        </div>
        {description && (
          <p className="line-clamp-3 text-base text-muted-foreground text-balance-pretty">
            {description}
          </p>
        )}
        <Link
          href={`/klasser/${item.slug}`}
          className="mt-auto inline-flex items-center gap-1.5 pt-2 text-base font-bold text-brand-green-dark outline-none focus-visible:underline"
        >
          {t("detail")}
          <ArrowRightIcon
            className="size-4 transition-transform group-hover/card:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}
