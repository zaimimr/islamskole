import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Mail,
  MapPin,
  Search,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { adminBasePath } from "@/components/admin/paths";
import { getAdminFamilies } from "@/lib/families/service";

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("nb-NO");
}

function guardianName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Navn mangler";
}

const PAGE_SIZE = 40;

export default async function FamiliesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/familier">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const basePath = adminBasePath(locale);
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const requestedPage = Math.max(
    1,
    Number(typeof query.page === "string" ? query.page : "1") || 1,
  );
  const term = normalized(q);
  const allFamilies = await getAdminFamilies();

  const families = term
    ? allFamilies.filter((family) =>
        [
          family.displayName,
          family.address,
          family.postalCode,
          family.city,
          ...family.guardians.flatMap((guardian) => [
            guardian.firstName,
            guardian.lastName,
            guardian.email,
            guardian.phone,
          ]),
          ...family.students.flatMap((student) => [
            student.firstName,
            student.lastName,
          ]),
          ...family.applications.flatMap((application) => [
            application.firstName,
            application.lastName,
          ]),
        ].some((value) => normalized(value).includes(term)),
      )
    : allFamilies;
  const pageCount = Math.max(1, Math.ceil(families.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleFamilies = families.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const pageHref = (targetPage: number) => {
    const nextQuery = new URLSearchParams();
    if (q) nextQuery.set("q", q);
    if (targetPage > 1) nextQuery.set("page", String(targetPage));
    const suffix = nextQuery.toString();
    return `${basePath}/familier${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="grid gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.08em] text-admin-muted uppercase">
            Familier og elever
          </p>
          <h1 className="mt-1 text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Familier
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
            Ett samlet sted for foresatte, søsken, opptak, plassering og
            betaling.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${basePath}/elever`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D8D3C8] bg-white px-4 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Alle elever
          </Link>
          <Link
            href={`${basePath}/elever/ny`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <UserRoundPlus aria-hidden="true" className="size-4" />
            Ny elev
          </Link>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
        <form action={`${basePath}/familier`} role="search">
          <label htmlFor="family-search" className="text-sm font-bold">
            Finn familie, foresatt eller barn
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-[#2F7938]"
              />
              <input
                id="family-search"
                name="q"
                type="search"
                defaultValue={q}
                autoComplete="off"
                placeholder="For eksempel Rahman, 900 00 000 eller Haslum …"
                className="min-h-11 w-full rounded-xl border border-[#AFCFB3] bg-white pr-4 pl-11 text-base outline-none placeholder:text-admin-muted focus-visible:border-[#2F7938] focus-visible:ring-3 focus-visible:ring-[#2F7938]/20 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-5 text-sm font-bold text-white outline-none transition-colors hover:bg-[#245E2B] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Søk
            </button>
            {q ? (
              <Link
                href={`${basePath}/familier`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D8D3C8] px-4 text-sm font-bold outline-none hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Nullstill
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-admin-muted" aria-live="polite">
          {families.length} {families.length === 1 ? "familie" : "familier"}
          {q ? ` for «${q}»` : ""}
        </p>
      </div>

      {families.length === 0 ? (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-[#E3DED3]">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <Users aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 font-heading text-xl font-bold">
            {q ? "Ingen familier passer søket" : "Ingen familier ennå"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-admin-muted">
            {q
              ? "Prøv et annet navn, telefonnummer eller en annen adresse."
              : "Familier opprettes automatisk ved offentlig innmelding eller når en elev registreres manuelt."}
          </p>
        </section>
      ) : (
        <ul className="grid gap-3">
          {visibleFamilies.map((family) => {
            const primary =
              family.guardians.find((guardian) => guardian.isPrimaryContact) ??
              family.guardians[0];
            const convertedApplications = new Set(
              family.students
                .map((student) => student.applicationId)
                .filter((id): id is string => Boolean(id)),
            );
            const pendingApplications = family.applications.filter(
              (application) =>
                !convertedApplications.has(application.id) &&
                !["avslatt", "arkivert"].includes(application.status),
            );
            const childCount =
              family.students.length + pendingApplications.length;
            const attention =
              family.openReviews.length +
              pendingApplications.filter(
                (application) => application.status === "ny",
              ).length;

            return (
              <li key={family.id}>
                <Link
                  href={`${basePath}/familier/${family.id}`}
                  className="group grid gap-4 rounded-2xl bg-white p-4 outline-none ring-1 ring-[#E3DED3] transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.8fr)_auto] sm:items-center sm:p-5"
                >
                  <span className="flex min-w-0 gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] font-heading text-sm font-bold text-[#216A2B]">
                      {family.displayName
                        .replace(/^Familien?\s+/i, "")
                        .split(/\s|\//)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toLocaleUpperCase("nb-NO"))
                        .join("") || "F"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-heading text-lg font-bold">
                        {family.displayName}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-admin-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <Users aria-hidden="true" className="size-4" />
                          {childCount} {childCount === 1 ? "barn" : "barn"}
                        </span>
                        {family.address ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <MapPin
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                            <span className="truncate">
                              {[family.address, family.city]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </span>

                  <span className="min-w-0 text-sm">
                    <span className="block font-bold">
                      {primary
                        ? guardianName(primary.firstName, primary.lastName)
                        : "Foresatt mangler"}
                    </span>
                    {primary?.email ? (
                      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-admin-muted">
                        <Mail aria-hidden="true" className="size-4 shrink-0" />
                        <span className="truncate">{primary.email}</span>
                      </span>
                    ) : null}
                  </span>

                  <span className="flex items-center justify-between gap-3 sm:justify-end">
                    {attention > 0 ? (
                      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#FEEDCA] px-3 text-xs font-bold text-[#775108]">
                        <CircleAlert aria-hidden="true" className="size-3.5" />
                        {attention} {attention === 1 ? "sak" : "saker"}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-[#216A2B]">
                        Ingen åpne saker
                      </span>
                    )}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-admin-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Sider med familier"
          className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#E3DED3]"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#216A2B] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Forrige side
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-admin-muted">
            Side {page} av {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={pageHref(page + 1)}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#216A2B] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Neste side
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
