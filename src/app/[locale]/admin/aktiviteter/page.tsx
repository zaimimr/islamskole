import Link from "next/link";
import { CalendarDays, Clock3, MapPin, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import { deleteEvent } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { siteUrl, localePath } from "@/lib/seo";
import { DeleteButton } from "@/components/admin/delete-button";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { buttonVariants } from "@/components/ui/button";

type EventRow = {
  id: string;
  slug: string | null;
  title_no: string | null;
  starts_at: string | null;
  location: string | null;
  published: boolean | null;
};

async function getEvents(): Promise<{ rows: EventRow[]; requestedAt: number }> {
  const requestedAt = Date.now();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id, slug, title_no, starts_at, location, published")
      .order("starts_at", { ascending: false });
    return { rows: (data as EventRow[] | null) ?? [], requestedAt };
  } catch {
    return { rows: [], requestedAt };
  }
}

function eventDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDay(value: string | null) {
  const date = eventDate(value);
  if (!date) return "--";
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    timeZone: "Europe/Oslo",
  });
}

function formatMonth(value: string | null) {
  const date = eventDate(value);
  if (!date) return "Dato";
  return date.toLocaleDateString("nb-NO", {
    month: "short",
    timeZone: "Europe/Oslo",
  });
}

function formatDateTime(value: string | null) {
  const date = eventDate(value);
  if (!date) return "Tidspunkt mangler";
  return date.toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function EventList({
  events,
  basePath,
  locale,
  emptyMessage,
}: {
  events: EventRow[];
  basePath: string;
  locale: Locale;
  emptyMessage: string;
}) {
  if (events.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-admin-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#ECE8DF]">
      {events.map((event) => (
        <li
          key={event.id}
          className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
        >
          <time
            dateTime={event.starts_at ?? undefined}
            className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#F7F6F1] text-center"
          >
            <span className="font-heading text-xl leading-none font-bold tabular-nums">
              {formatDay(event.starts_at)}
            </span>
            <span className="mt-1 text-[0.6875rem] font-bold text-admin-muted uppercase">
              {formatMonth(event.starts_at)}
            </span>
          </time>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-bold">
                {event.title_no ?? "Aktivitet uten tittel"}
              </h3>
              <span
                className={
                  event.published
                    ? "inline-flex items-center gap-1.5 rounded-full bg-[#DCEDDD] px-2.5 py-1 text-xs font-bold text-[#216A2B]"
                    : "inline-flex items-center gap-1.5 rounded-full bg-[#F0F0ED] px-2.5 py-1 text-xs font-bold text-[#4D554F]"
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    event.published
                      ? "size-2 rounded-full bg-[#3C8F44]"
                      : "size-2 rounded-full bg-[#7A827C]"
                  }
                />
                {event.published ? "Publisert" : "Utkast"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-admin-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 aria-hidden="true" className="size-3.5" />
                {formatDateTime(event.starts_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3.5" />
                {event.location ?? "Sted mangler"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {event.published && event.slug ? (
              <CopyLinkButton
                url={`${siteUrl}${localePath(
                  locale,
                  `/aktiviteter/${event.slug}`,
                )}`}
                showLabel
              />
            ) : null}
            <Link
              href={`${basePath}/aktiviteter/${event.id}`}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 px-3",
              })}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Rediger
            </Link>
            <DeleteButton
              id={event.id}
              label="aktivitet"
              action={deleteEvent}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AktiviteterPage({
  params,
}: PageProps<"/[locale]/admin/aktiviteter">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const { rows: events, requestedAt } = await getEvents();
  const upcomingEvents = events
    .filter((event) => {
      const date = eventDate(event.starts_at);
      return date ? date.getTime() >= requestedAt : true;
    })
    .sort(
      (first, second) =>
        (eventDate(first.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (eventDate(second.starts_at)?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );
  const previousEvents = events.filter((event) => {
    const date = eventDate(event.starts_at);
    return date ? date.getTime() < requestedAt : false;
  });

  return (
    <div className="grid gap-6 lg:gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            Aktiviteter
          </h1>
          <p className="mt-1 max-w-2xl text-admin-muted">
            Planlegg, publiser og finn igjen skolens arrangementer og nyheter.
          </p>
        </div>
        <Link
          href={`${basePath}/aktiviteter/ny`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus aria-hidden="true" className="size-4" />
          Ny aktivitet
        </Link>
      </header>

      {events.length === 0 ? (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-[#E3DED3]">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <CalendarDays aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 font-heading text-xl font-bold">
            Ingen aktiviteter ennå
          </h2>
          <p className="mt-1 max-w-sm text-sm text-admin-muted">
            Opprett en aktivitet og publiser den når innholdet er klart.
          </p>
          <Link
            href={`${basePath}/aktiviteter/ny`}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CFC8BA] px-4 text-sm font-bold text-[#277A31] outline-none transition-colors hover:bg-[#F7FBF7] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus aria-hidden="true" className="size-4" />
            Opprett aktivitet
          </Link>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
            <div className="border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
              <h2 className="font-heading text-xl font-bold">
                Kommende og uten dato
              </h2>
              <p className="mt-0.5 text-sm text-admin-muted">
                Innhold som fortsatt skal følges opp eller deles.
              </p>
            </div>
            <EventList
              events={upcomingEvents}
              basePath={basePath}
              locale={locale as Locale}
              emptyMessage="Ingen kommende aktiviteter."
            />
          </section>

          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
            <div className="border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
              <h2 className="font-heading text-xl font-bold">
                Tidligere aktiviteter
              </h2>
              <p className="mt-0.5 text-sm text-admin-muted">
                Publisert innhold og utkast fra tidligere datoer.
              </p>
            </div>
            <EventList
              events={previousEvents}
              basePath={basePath}
              locale={locale as Locale}
              emptyMessage="Ingen tidligere aktiviteter."
            />
          </section>
        </>
      )}
    </div>
  );
}
