import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Copy,
  Mail,
  MapPin,
  Search,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { adminBasePath } from "@/components/admin/paths";
import { getAdminFamilies } from "@/lib/families/service";
import type { FamilyDetails } from "@/lib/families/repository";
import { createClient } from "@/lib/supabase/server";
import { formatNok } from "@/lib/money";
import { cn } from "@/lib/utils";
import { findDuplicateFamilies } from "./duplicates";

export const metadata: Metadata = { title: "Familier" };

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("nb-NO");
}

function guardianName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Navn mangler";
}

const PAGE_SIZE = 40;

const queues = [
  { id: "", label: "Alle" },
  { id: "skylder", label: "Skylder penger" },
  { id: "mangler_plass", label: "Mangler plass" },
  { id: "gjennomga", label: "Må gjennomgås" },
  { id: "ny", label: "Ny innmelding" },
] as const;

type QueueId = (typeof queues)[number]["id"];

type EnrollmentRow = {
  student_id: string;
  school_year_id: string;
  status: string;
  school_years: { label: string } | null;
};

type FamilyState = {
  remainingOre: number;
  missingPlacement: number;
  needsReview: boolean;
  newApplications: number;
};

async function getFamilyStates(families: FamilyDetails[]) {
  const supabase = await createClient();
  const { data: year, error: yearError } = await supabase
    .from("school_years")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  const activeYearId = (year as { id: string } | null)?.id ?? null;
  const [enrollmentResult, balanceResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, school_year_id, status, school_years(label)"),
    activeYearId
      ? supabase
          .from("student_balances")
          .select("student_id, remaining")
          .eq("school_year_id", activeYearId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const enrollments = (enrollmentResult.data as EnrollmentRow[] | null) ?? [];
  const remainingByStudent = new Map<string, number>();
  for (const row of (balanceResult.data as
    | { student_id: string | null; remaining: number | null }[]
    | null) ?? []) {
    if (row.student_id) remainingByStudent.set(row.student_id, row.remaining ?? 0);
  }
  const enrollmentsByStudent = new Map<string, EnrollmentRow[]>();
  for (const row of enrollments) {
    const list = enrollmentsByStudent.get(row.student_id) ?? [];
    list.push(row);
    enrollmentsByStudent.set(row.student_id, list);
  }

  const expectsPlacement = (studentId: string) => {
    const rows = enrollmentsByStudent.get(studentId) ?? [];
    if (activeYearId && rows.some((row) => row.school_year_id === activeYearId && row.status === "aktiv")) {
      return false;
    }
    if (rows.length === 0) return true;
    const latest = [...rows].sort((left, right) =>
      (right.school_years?.label ?? "").localeCompare(left.school_years?.label ?? ""),
    )[0];
    return latest.status === "aktiv";
  };

  const duplicates = findDuplicateFamilies(families);
  const states = new Map<string, FamilyState>();
  for (const family of families) {
    const converted = new Set(
      family.students
        .map((student) => student.applicationId)
        .filter((id): id is string => Boolean(id)),
    );
    states.set(family.id, {
      remainingOre: family.students.reduce(
        (sum, student) => sum + Math.max(remainingByStudent.get(student.id) ?? 0, 0),
        0,
      ),
      missingPlacement: activeYearId
        ? family.students.filter((student) => expectsPlacement(student.id)).length
        : 0,
      needsReview: family.openReviews.length > 0 || duplicates.has(family.id),
      newApplications: family.applications.filter(
        (application) =>
          application.status === "ny" && !converted.has(application.id),
      ).length,
    });
  }

  return {
    ok: !yearError && !enrollmentResult.error && !balanceResult.error,
    states,
    duplicates,
  };
}

function matchesQueue(state: FamilyState | undefined, queue: QueueId) {
  if (!queue) return true;
  if (!state) return false;
  if (queue === "skylder") return state.remainingOre > 0;
  if (queue === "mangler_plass") return state.missingPlacement > 0;
  if (queue === "gjennomga") return state.needsReview;
  return state.newApplications > 0;
}

export default async function FamiliesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/familier">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const basePath = adminBasePath(locale);
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const queue = (queues.find((item) => item.id === query.vis)?.id ?? "") as QueueId;
  const requestedPage = Math.max(
    1,
    Number(typeof query.page === "string" ? query.page : "1") || 1,
  );
  const term = normalized(q);
  const allFamilies = await getAdminFamilies();
  const { ok, states, duplicates } = await getFamilyStates(allFamilies);

  const searched = term
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
  const families = searched.filter((family) =>
    matchesQueue(states.get(family.id), queue),
  );
  const queueCounts = new Map(
    queues.map((item) => [
      item.id,
      searched.filter((family) => matchesQueue(states.get(family.id), item.id))
        .length,
    ]),
  );
  const pageCount = Math.max(1, Math.ceil(families.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleFamilies = families.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const hrefFor = (next: { page?: number; vis?: string }) => {
    const nextQuery = new URLSearchParams();
    if (q) nextQuery.set("q", q);
    const vis = next.vis ?? queue;
    if (vis) nextQuery.set("vis", vis);
    if (next.page && next.page > 1) nextQuery.set("page", String(next.page));
    const suffix = nextQuery.toString();
    return `${basePath}/familier${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="grid gap-4 sm:gap-6">
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Familier
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-admin-muted sm:mt-2 sm:text-base">
            Foresatte, søsken, plassering og betaling samlet per familie.
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

      <section className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
        <form action={`${basePath}/familier`} role="search">
          {queue ? <input type="hidden" name="vis" value={queue} /> : null}
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
                placeholder="For eksempel Rahman, 900 00 000 eller Haslum"
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
                href={`${basePath}/familier${queue ? `?vis=${queue}` : ""}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D8D3C8] px-4 text-sm font-bold outline-none hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Nullstill
              </Link>
            ) : null}
          </div>
        </form>
        <nav aria-label="Arbeidskøer" className="-mx-1 overflow-x-auto px-1">
          <ul className="flex min-w-max gap-2">
            {queues.map((item) => {
              const current = item.id === queue;
              return (
                <li key={item.id || "alle"}>
                  <Link
                    href={hrefFor({ vis: item.id, page: 1 })}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      current
                        ? "border-[#2F7938] bg-[#F0F8F1] text-[#216A2B]"
                        : "border-[#D8D3C8] bg-white hover:bg-[#F2F1EB]",
                    )}
                  >
                    {item.label}
                    <span className="tabular-nums text-admin-muted">
                      {queueCounts.get(item.id) ?? 0}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </section>

      {!ok ? (
        <p role="alert" className="rounded-xl bg-[#FFF2F1] p-3 text-sm text-[#8B2F2B]">
          Plassering og betaling kunne ikke lastes. Arbeidskøene kan være
          ufullstendige.
        </p>
      ) : null}

      <p className="text-sm text-admin-muted" aria-live="polite">
        {families.length} {families.length === 1 ? "familie" : "familier"}
        {q ? ` for «${q}»` : ""}
      </p>

      {families.length === 0 ? (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-[#E3DED3]">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <Users aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 font-heading text-xl font-bold">
            {q || queue ? "Ingen familier her" : "Ingen familier ennå"}
          </h2>
          <p className="mt-1 max-w-md text-sm text-admin-muted">
            {queue
              ? "Køen er tom. Velg en annen kø eller Alle."
              : q
                ? "Prøv et annet navn, telefonnummer eller en annen adresse."
                : "Familier opprettes automatisk ved offentlig innmelding eller når en elev registreres manuelt."}
          </p>
        </section>
      ) : (
        <ul className="grid gap-3">
          {visibleFamilies.map((family) => {
            const state = states.get(family.id);
            const duplicateMatches = duplicates.get(family.id) ?? [];
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
            const flags = [
              state?.needsReview
                ? duplicateMatches.length > 0
                  ? "Mulig duplikat"
                  : "Må gjennomgås"
                : null,
              state?.newApplications
                ? `${state.newApplications} ny innmelding`
                : null,
              state?.missingPlacement
                ? `${state.missingPlacement} mangler plass`
                : null,
            ].filter((flag): flag is string => Boolean(flag));

            return (
              <li key={family.id}>
                <Link
                  href={`${basePath}/familier/${family.id}`}
                  className="group grid gap-3 rounded-2xl bg-white p-4 outline-none ring-1 ring-[#E3DED3] transition-colors hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.8fr)_auto] sm:items-center sm:gap-4 sm:p-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-lg font-bold">
                      {family.displayName}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-admin-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Users aria-hidden="true" className="size-4" />
                        {childCount} barn
                      </span>
                      {family.address ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <MapPin aria-hidden="true" className="size-4 shrink-0" />
                          <span className="truncate">
                            {[family.address, family.city].filter(Boolean).join(", ")}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    {flags.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {flags.map((flag) => (
                          <span
                            key={flag}
                            className="inline-flex min-h-7 items-center gap-1 rounded-full bg-[#FEEDCA] px-2.5 text-xs font-bold text-[#775108]"
                          >
                            {flag === "Mulig duplikat" ? (
                              <Copy aria-hidden="true" className="size-3.5" />
                            ) : (
                              <CircleAlert aria-hidden="true" className="size-3.5" />
                            )}
                            {flag}
                          </span>
                        ))}
                      </span>
                    ) : null}
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
                    {state && state.remainingOre > 0 ? (
                      <span className="text-sm font-bold tabular-nums text-[#8B2F2B]">
                        Skylder {formatNok(state.remainingOre)}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-[#216A2B]">
                        Ingen utestående
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
              href={hrefFor({ page: page - 1 })}
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
              href={hrefFor({ page: page + 1 })}
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
