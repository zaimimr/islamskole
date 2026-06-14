import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeftIcon, CalendarDaysIcon, ClockIcon, MapPinIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getEventBySlug, getPublishedEvents, localized } from "@/lib/data";
import { contentMetadata, eventJsonLd, siteUrl, localePath } from "@/lib/seo";
import { MediaFrame } from "@/components/site/MediaFrame";
import { ShareEvent } from "@/components/site/ShareEvent";
import { EnrollCta } from "@/components/site/EnrollCta";
import { Blob } from "@/components/site/decor";
import { formatEventDate, formatEventTime } from "@/components/site/format";

export async function generateStaticParams() {
  const events = await getPublishedEvents();
  return events.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/aktiviteter/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getEventBySlug(slug);
  if (!item) return { title: "Islamskole Bærum" };
  const typedLocale = locale as Locale;
  const title = localized(item, "title", typedLocale);
  return contentMetadata({
    locale: typedLocale,
    title,
    description:
      localized(item, "excerpt", typedLocale).slice(0, 160) ||
      `${title} - Islamskole Bærum.`,
    basePath: `/aktiviteter/${item.slug}`,
    image: item.image_url,
  });
}

export default async function EventDetailPage({
  params,
}: PageProps<"/[locale]/aktiviteter/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const item = await getEventBySlug(slug);
  if (!item) notFound();

  const t = await getTranslations("events");
  const tCommon = await getTranslations("common");
  const title = localized(item, "title", typedLocale);
  const body = localized(item, "body", typedLocale);
  const excerpt = localized(item, "excerpt", typedLocale);
  const shareUrl = `${siteUrl}${localePath(typedLocale, `/aktiviteter/${item.slug}`)}`;
  const dateLabel = formatEventDate(item.starts_at, typedLocale);
  const startTime = formatEventTime(item.starts_at, typedLocale);
  const endTime = formatEventTime(item.ends_at, typedLocale);
  const timeLabel = startTime
    ? endTime
      ? `${startTime} - ${endTime}`
      : startTime
    : null;

  const facts = [
    dateLabel
      ? { icon: CalendarDaysIcon, label: tCommon("date"), value: dateLabel }
      : null,
    timeLabel
      ? { icon: ClockIcon, label: tCommon("time"), value: timeLabel }
      : null,
    item.location
      ? { icon: MapPinIcon, label: tCommon("location"), value: item.location }
      : null,
  ].filter((f): f is { icon: typeof CalendarDaysIcon; label: string; value: string } => f !== null);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            eventJsonLd({
              title,
              description: excerpt || body,
              basePath: `/aktiviteter/${item.slug}`,
              image: item.image_url,
              location: item.location,
              startDate: item.starts_at,
              endDate: item.ends_at,
            }),
          ),
        }}
      />
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/45 via-background to-background">
        <Blob className="-top-20 -left-16 h-64 w-64 text-accent/50 animate-float" />
        <div className="section-shell relative pt-10 pb-14 sm:pt-14">
          <Link
            href="/aktiviteter"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green-dark outline-none hover:underline focus-visible:underline"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {tCommon("backToEvents")}
          </Link>
          <h1 className="mt-8 max-w-3xl text-4xl leading-tight font-bold text-balance-pretty sm:text-5xl">
            {title}
          </h1>
          {excerpt && (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground text-balance-pretty">
              {excerpt}
            </p>
          )}
        </div>
      </section>

      <div className="section-shell grid gap-10 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MediaFrame
            src={item.image_url}
            alt={title}
            tone="sun"
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="aspect-[16/9] w-full rounded-[2.2rem] shadow-[0_30px_70px_-40px_rgba(20,60,30,0.5)] ring-1 ring-foreground/10"
          />
          {body && (
            <div className="mt-8">
              <p className="text-lg whitespace-pre-line text-muted-foreground text-balance-pretty">
                {body}
              </p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-6 self-start">
          {facts.length > 0 && (
            <div className="soft-card flex flex-col gap-1 p-7">
              <h2 className="mb-2 text-xl font-bold">{t("detailsTitle")}</h2>
              <ul className="flex flex-col divide-y divide-foreground/8">
                {facts.map(({ icon: Icon, label, value }) => (
                  <li key={label} className="flex items-start gap-3 py-3.5">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-brand-green-dark">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {label}
                      </span>
                      <span className="text-base font-semibold text-foreground">
                        {value}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="soft-card p-7">
            <ShareEvent
              url={shareUrl}
              title={title}
              text={excerpt || body}
              location={item.location}
              startDate={item.starts_at}
              endDate={item.ends_at}
            />
          </div>
        </aside>
      </div>

      <EnrollCta />
    </>
  );
}
