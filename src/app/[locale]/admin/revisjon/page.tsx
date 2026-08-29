import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";

const PAGE_SIZE = 50;

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string | null;
};

const actionLabels: Record<string, string> = {
  "event.create": "Opprettet aktivitet",
  "event.update": "Oppdaterte aktivitet",
  "event.delete": "Slettet aktivitet",
  "class.create": "Opprettet klasse",
  "class.update": "Oppdaterte klasse",
  "class.delete": "Slettet klasse",
  "settings.update": "Oppdaterte innstillinger",
  "teacher.status": "Endret lærerstatus",
  "teacher.delete": "Slettet lærersøknad",
  "application.status": "Endret opptaksstatus",
  "application.delete": "Slettet påmelding",
  "application.bulk_status": "Endret flere opptaksstatuser",
  "user.create": "Opprettet bruker",
  "user.reset_password": "Tilbakestilte passord",
  "user.delete": "Slettet bruker",
  "teacher.bulk_status": "Endret flere lærerstatuser",
  "payment.capture_requested": "Ba Vipps om å trekke betaling",
  "payment.refund_requested": "Ba Vipps om refusjon",
  "payment.cancel_requested": "Avbrøt betalingsforespørsel",
  "payment.delete": "Slettet betalingsforespørsel",
  "student_fee.update": "Oppdaterte betalingskrav",
  "payment.void": "Annullerte betaling i oversikten",
  "payment.restore": "Gjenopprettet annullert betaling",
  "payment.mark_duplicate": "Markerte dobbeltføring",
  "payment.keep_separate": "Beholdt to separate betalinger",
  "payment.reallocate_year": "Fordelte skoleårsbetalinger på nytt",
  "payment.allocate": "Endret betalingsfordeling",
  "family.relationships_updated": "Oppdaterte familierelasjoner",
  "school_year.create": "Opprettet skoleår",
  "school_year.update": "Oppdaterte skoleår",
  "school_year.activate": "Aktiverte skoleår",
  "school_year.delete": "Slettet skoleår",
};

const entityLabels: Record<string, string> = {
  event: "Aktivitet",
  class: "Klasse",
  settings: "Innstillinger",
  teacher: "Lærer",
  application: "Påmelding",
  user: "Bruker",
  payment: "Betaling",
  student_fee: "Betalingskrav",
  family: "Familie",
  school_year: "Skoleår",
};

const metadataLabels: Record<string, string> = {
  amount: "Beløp",
  status: "Status",
  previous_status: "Tidligere status",
  count: "Antall",
  reason: "Årsak",
  duplicate_of: "Tilhører betaling",
  school_year_id: "Skoleår-ID",
  allocations: "Fordelinger",
};

const entityOptions = [
  "payment",
  "student_fee",
  "family",
  "application",
  "class",
  "school_year",
  "event",
  "teacher",
  "user",
  "settings",
];

function formatDate(value: string | null) {
  if (!value) return "Tidspunkt mangler";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tidspunkt mangler";
  return date.toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMetadataValue(key: string, value: unknown) {
  if (typeof value === "number" && key === "amount") {
    return new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      maximumFractionDigits: 0,
    }).format(value / 100);
  }
  if (Array.isArray(value)) return `${value.length} elementer`;
  if (value != null && typeof value === "object") {
    return `${Object.keys(value as Record<string, unknown>).length} felt`;
  }
  if (value == null || value === "") return "Ikke oppgitt";
  return String(value);
}

function metadataEntries(metadata: unknown) {
  if (metadata == null || typeof metadata !== "object") return [];
  return Object.entries(metadata as Record<string, unknown>).map(
    ([key, value]) => ({
      key,
      label: metadataLabels[key] ?? key.replaceAll("_", " "),
      value: formatMetadataValue(key, value),
    }),
  );
}

function buildAuditHref(
  basePath: string,
  values: { query: string; entityType: string; page?: number },
) {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.entityType) params.set("type", values.entityType);
  if ((values.page ?? 1) > 1) params.set("page", String(values.page));
  const suffix = params.toString();
  return `${basePath}/revisjon${suffix ? `?${suffix}` : ""}`;
}

async function getEntries(
  page: number,
  query: string,
  entityType: string,
): Promise<{ ok: true; rows: AuditRow[]; total: number } | { ok: false }> {
  try {
    const supabase = await createClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let request = supabase
      .from("audit_log")
      .select(
        "id, actor_email, action, entity_type, entity_id, metadata, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    const term = query.replace(/[%,()]/g, " ").trim();
    if (term) {
      request = request.or(
        `actor_email.ilike.%${term}%,action.ilike.%${term}%,entity_type.ilike.%${term}%,entity_id.ilike.%${term}%`,
      );
    }
    if (entityOptions.includes(entityType)) {
      request = request.eq("entity_type", entityType);
    }

    const result = await request;
    if (result.error) return { ok: false };

    return {
      ok: true,
      rows: (result.data as AuditRow[] | null) ?? [],
      total: result.count ?? 0,
    };
  } catch {
    return { ok: false };
  }
}

export default async function RevisjonPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/revisjon">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const entityType = typeof sp.type === "string" ? sp.type : "";
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const result = await getEntries(page, query, entityType);

  if (!result.ok) {
    return (
      <section
        aria-labelledby="audit-load-error"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1
          id="audit-load-error"
          className="mt-4 font-heading text-3xl font-bold tracking-[-0.02em]"
        >
          Revisjonshistorikken kunne ikke lastes
        </h1>
        <p className="mt-2 max-w-prose text-admin-muted">
          Historikken er ikke tom eller slettet. Prøv igjen før du bruker loggen
          til kontroll eller avstemming.
        </p>
        <Link
          href={buildAuditHref(basePath, { query, entityType, page })}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Prøv igjen
        </Link>
      </section>
    );
  }

  const filtered = Boolean(query || entityType);
  const fromRecord = result.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRecord = Math.min(page * PAGE_SIZE, result.total);
  const hasPrevious = page > 1;
  const hasNext = page * PAGE_SIZE < result.total;

  return (
    <div className="grid gap-7 lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
            Revisjonshistorikk
          </h1>
          <p className="mt-1 max-w-3xl text-admin-muted">
            Se hvem som endret hva, når det skjedde og hvilken post handlingen
            gjaldt.
          </p>
        </div>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#DCEDDD] px-3 text-sm font-bold text-[#216A2B]">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Skrivebeskyttet historikk
        </span>
      </header>

      <form
        action={`${basePath}/revisjon`}
        className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] md:grid-cols-[minmax(16rem,1fr)_14rem_auto] md:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="audit-search" className="text-sm font-bold">
            Søk i historikken
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-muted"
            />
            <input
              id="audit-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Bruker, handling eller ID"
              spellCheck={false}
              className="min-h-11 w-full rounded-xl border border-[#DCD7CC] bg-white pr-3 pl-10 text-sm outline-none transition-colors placeholder:text-[#6A716C] focus-visible:border-[#3C8F44] focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="audit-type" className="text-sm font-bold">
            Område
          </label>
          <select
            id="audit-type"
            name="type"
            defaultValue={entityType}
            className="min-h-11 w-full rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm outline-none focus-visible:border-[#3C8F44] focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">Alle områder</option>
            {entityOptions.map((option) => (
              <option key={option} value={option}>
                {entityLabels[option] ?? option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-none"
          >
            Vis hendelser
          </button>
          {filtered ? (
            <Link
              href={`${basePath}/revisjon`}
              aria-label="Nullstill søk og område"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-[#DCD7CC] bg-white outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="audit-results-title">
        <div className="mb-3">
          <h2
            id="audit-results-title"
            className="font-heading text-xl font-semibold"
          >
            {filtered ? "Filtrerte hendelser" : "Nyeste hendelser"}
          </h2>
          <p className="mt-0.5 text-sm text-admin-muted" aria-live="polite">
            {result.total === 0
              ? "Ingen hendelser funnet"
              : `Viser ${fromRecord}-${toRecord} av ${result.total}`}
          </p>
        </div>

        {result.rows.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-[#E3DED3]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F0F0ED] text-admin-muted">
              <FileClock aria-hidden="true" className="size-6" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-semibold">
              {filtered ? "Ingen hendelser samsvarer" : "Ingen hendelser ennå"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-admin-muted">
              {filtered
                ? "Prøv et annet søk eller velg alle områder."
                : "Administrative endringer vises her når de blir utført."}
            </p>
          </div>
        ) : (
          <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]">
            <li
              aria-hidden="true"
              className="hidden grid-cols-[11rem_minmax(11rem,1fr)_minmax(14rem,1.4fr)_9rem] gap-4 border-b border-[#E8E3D9] bg-[#FAF9F5] px-5 py-3 text-xs font-bold tracking-[0.04em] text-admin-muted uppercase lg:grid"
            >
              <span>Tidspunkt</span>
              <span>Bruker</span>
              <span>Handling</span>
              <span>Område</span>
            </li>
            {result.rows.map((row) => {
              const details = metadataEntries(row.metadata);
              return (
                <li
                  key={row.id}
                  className="border-b border-[#ECE8DF] px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="grid gap-3 lg:grid-cols-[11rem_minmax(11rem,1fr)_minmax(14rem,1.4fr)_9rem] lg:items-start lg:gap-4">
                    <p className="flex items-center gap-2 text-sm text-admin-muted lg:block">
                      <Clock3 aria-hidden="true" className="size-4 lg:hidden" />
                      {formatDate(row.created_at)}
                    </p>
                    <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <UserRound
                        aria-hidden="true"
                        className="size-4 shrink-0 text-admin-muted lg:hidden"
                      />
                      <span className="break-all">
                        {row.actor_email ?? "Systemhandling"}
                      </span>
                    </p>
                    <div>
                      <p className="font-bold">
                        {actionLabels[row.action] ?? row.action}
                      </p>
                      {details.length > 0 ? (
                        <p className="mt-0.5 text-sm text-admin-muted">
                          {details
                            .slice(0, 2)
                            .map((detail) => `${detail.label}: ${detail.value}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="w-fit rounded-full bg-[#F0F0ED] px-2.5 py-1 text-xs font-bold text-[#4E5550]">
                      {entityLabels[row.entity_type] ?? row.entity_type}
                    </span>
                  </div>

                  {row.entity_id || details.length > 0 ? (
                    <details className="group mt-3 rounded-xl bg-[#FAF9F5] ring-1 ring-[#E8E3D9]">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-bold outline-none hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                        Tekniske detaljer
                        <ChevronRight
                          aria-hidden="true"
                          className="size-4 text-admin-muted transition-transform group-open:rotate-90"
                        />
                      </summary>
                      <dl className="grid gap-3 border-t border-[#E8E3D9] px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {row.entity_id ? (
                          <div className="min-w-0">
                            <dt className="text-xs font-bold text-admin-muted">
                              Post-ID
                            </dt>
                            <dd className="mt-0.5 break-all font-mono text-xs">
                              {row.entity_id}
                            </dd>
                          </div>
                        ) : null}
                        {details.map((detail) => (
                          <div key={detail.key} className="min-w-0">
                            <dt className="text-xs font-bold text-admin-muted">
                              {detail.label}
                            </dt>
                            <dd className="mt-0.5 break-words">
                              {detail.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {result.total > 0 ? (
        <nav
          aria-label="Sider i revisjonshistorikken"
          className="flex items-center justify-between gap-3"
        >
          {hasPrevious ? (
            <Link
              href={buildAuditHref(basePath, {
                query,
                entityType,
                page: page - 1,
              })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Forrige
            </Link>
          ) : (
            <span className="min-h-11" />
          )}
          <span className="text-sm font-semibold text-admin-muted">
            Side {page} av {Math.max(1, Math.ceil(result.total / PAGE_SIZE))}
          </span>
          {hasNext ? (
            <Link
              href={buildAuditHref(basePath, {
                query,
                entityType,
                page: page + 1,
              })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] bg-white px-3 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Neste
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <span className="min-h-11" />
          )}
        </nav>
      ) : null}
    </div>
  );
}
