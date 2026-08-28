import Link from "next/link";
import {
  CalendarClock,
  ChevronDown,
  CircleCheck,
  CreditCard,
  Download,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
import { formatAge, schoolYearStart } from "@/lib/age";
import { deleteStudentApplication } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { DeleteButton } from "@/components/admin/delete-button";
import { RegisterStudentButton } from "@/components/admin/register-student-button";
import { StudentStatusSelect } from "@/components/admin/student-status-select";
import { StudentFilters } from "@/components/admin/student-filters";
import { Pagination } from "@/components/admin/pagination";
import { ExportButton } from "@/components/admin/export-button";
import {
  BulkActions,
  BulkSelectAll,
  BulkRowCheckbox,
} from "@/components/admin/bulk-actions";

type StudentApplicationRow = {
  id: string;
  family_id: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
  child_birth_date: string | null;
  child_gender: string | null;
  child_address: string | null;
  child_postal_code: string | null;
  child_city: string | null;
  child_email: string | null;
  child_phone: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  mother_phone: string | null;
  mother_email: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
  father_phone: string | null;
  father_email: string | null;
  desired_class: string | null;
  child_level_quran: string | null;
  child_level_arabic: string | null;
  child_level_islam: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
  payment_id: string | null;
  payments: { status: string | null } | null;
};

const paymentLabels: Record<string, string> = {
  fanget: "Betalt",
  autorisert: "Autorisert",
  opprettet: "Avventer betaling",
  avbrutt: "Avbrutt",
  feilet: "Feilet",
  refundert: "Refundert",
};

function paymentLabel(app: StudentApplicationRow): {
  label: string;
  paid: boolean;
} {
  const status = app.payments?.status ?? null;
  if (!app.payment_id || !status) {
    return { label: "Ikke startet", paid: false };
  }
  return { label: paymentLabels[status] ?? status, paid: status === "fanget" };
}

const genderLabels: Record<string, string> = {
  gutt: "Gutt",
  jente: "Jente",
};

function genderLabel(value: string | null): string {
  if (!value) return "-";
  return genderLabels[value] ?? value;
}

function fullName(first: string | null, last: string | null): string {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

function addressLine(app: StudentApplicationRow): string {
  const parts = [
    app.child_address,
    [app.child_postal_code, app.child_city].filter(Boolean).join(" "),
  ].filter((p) => p && p.length > 0);
  return parts.length ? parts.join(", ") : "-";
}

const levelLabels: Record<string, string> = {
  nybegynner: "Nybegynner",
  litt: "Litt erfaring",
  middels: "Middels",
  god: "God",
};

function levelLabel(value: string | null) {
  if (!value) return "-";
  return levelLabels[value] ?? value;
}

async function getApplications(
  q: string,
  status: string,
): Promise<StudentApplicationRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("student_applications")
      .select(
        "id, family_id, child_first_name, child_last_name, child_birth_date, child_gender, child_address, child_postal_code, child_city, child_email, child_phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, desired_class, child_level_quran, child_level_arabic, child_level_islam, message, status, created_at, payment_id, payments(status)",
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `child_first_name.ilike.%${term}%,child_last_name.ilike.%${term}%,mother_first_name.ilike.%${term}%,mother_last_name.ilike.%${term}%,father_first_name.ilike.%${term}%,father_last_name.ilike.%${term}%,child_email.ilike.%${term}%`,
      );
    }

    const { data } = await query;
    return (data as StudentApplicationRow[] | null) ?? [];
  } catch {
    return [];
  }
}

async function getRegisteredMap(): Promise<Map<string, string>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("students")
      .select("id, application_id")
      .not("application_id", "is", null);
    const rows =
      (data as { id: string; application_id: string | null }[] | null) ?? [];
    return new Map(
      rows
        .filter((r) => r.application_id)
        .map((r) => [r.application_id as string, r.id]),
    );
  } catch {
    return new Map();
  }
}

async function getPlacementOptions() {
  try {
    const supabase = await createClient();
    const [{ data: classes }, { data: years }] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name_no")
        .order("sort_order", { ascending: true }),
      supabase
        .from("school_years")
        .select("id, label, is_active")
        .order("label", { ascending: false }),
    ]);
    return {
      classes: (
        (classes as { id: string; name_no: string | null }[] | null) ?? []
      ).map((c) => ({ id: c.id, name: c.name_no ?? "(uten navn)" })),
      schoolYears: (
        (years as { id: string; label: string; is_active: boolean }[] | null) ??
        []
      ).map((y) => ({ id: y.id, label: y.label, is_active: y.is_active })),
    };
  } catch {
    return { classes: [], schoolYears: [] };
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value || value === "-") return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

const PAGE_SIZE = 25;

export default async function PameldingerPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/register">) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const [allApplications, registered, placement] = await Promise.all([
    getApplications(q, status),
    getRegisteredMap(),
    getPlacementOptions(),
  ]);
  const unregistered = allApplications.filter((a) => !registered.has(a.id));
  const total = unregistered.length;
  const from = (page - 1) * PAGE_SIZE;
  const applications = unregistered.slice(from, from + PAGE_SIZE);
  const activeYear = placement.schoolYears.find((y) => y.is_active);
  const defaultSchoolYearId = activeYear?.id ?? null;
  const ageYear =
    schoolYearStart(activeYear?.label) ?? new Date().getFullYear();
  const filtered = Boolean(q || status);
  const pageIds = applications.map((a) => a.id);
  const newCount = unregistered.filter(
    (application) => (application.status ?? "ny") === "ny",
  ).length;
  const paidCount = unregistered.filter(
    (application) => paymentLabel(application).paid,
  ).length;

  return (
    <div className="grid gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Innmeldinger
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
            Behandle nye innmeldinger, kontroller betalingen og registrer barnet
            når opptaket er avklart.
          </p>
        </div>
        <ExportButton entity="applications" />
      </header>

      <section
        aria-label="Status for innmeldinger"
        className="grid overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] sm:grid-cols-3"
      >
        <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
            <CalendarClock aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {newCount}
            </p>
            <p className="text-sm text-admin-muted">Nye til behandling</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <CreditCard aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {paidCount}
            </p>
            <p className="text-sm text-admin-muted">Betaling mottatt</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF8FD] text-[#245D7C]">
            <Users aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums">
              {total}
            </p>
            <p className="text-sm text-admin-muted">I gjeldende utvalg</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#E3DED3] sm:p-5">
        <StudentFilters />
      </section>

      <section
        aria-labelledby="applications-list-title"
        className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
          <div>
            <h2
              id="applications-list-title"
              className="font-heading text-xl font-bold"
            >
              Søknader til behandling
            </h2>
            <p className="mt-0.5 text-sm text-admin-muted" aria-live="polite">
              {total} {total === 1 ? "innmelding" : "innmeldinger"}
              {filtered ? " passer valgte filtre" : " venter i innboksen"}
            </p>
          </div>
          <Download aria-hidden="true" className="size-5 text-admin-muted" />
        </div>
        {applications.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
              <CircleCheck aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 font-heading text-xl font-bold">
              {filtered ? "Ingen treff i innboksen" : "Innboksen er tom"}
            </p>
            <p className="mt-1 max-w-md text-sm text-admin-muted">
              {filtered
                ? "Prøv et annet søk eller velg en annen status."
                : "Nye innmeldinger vises her når foresatte har sendt dem inn."}
            </p>
          </div>
        ) : (
          <BulkActions entity="applications" ids={pageIds}>
            <div className="flex min-h-12 items-center gap-3 border-b border-[#ECE8DF] bg-[#FBFAF6] px-4 text-sm text-admin-muted sm:px-5">
              <BulkSelectAll />
              <span>Velg alle på denne siden</span>
            </div>
            <ul className="divide-y divide-[#ECE8DF]">
              {applications.map((application) => {
                const payment = paymentLabel(application);
                const mother = fullName(
                  application.mother_first_name,
                  application.mother_last_name,
                );
                const father = fullName(
                  application.father_first_name,
                  application.father_last_name,
                );
                return (
                  <li key={application.id} className="p-4 sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(22rem,1.45fr)] lg:items-start">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="pt-1">
                          <BulkRowCheckbox id={application.id} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-heading text-lg font-bold">
                            {studentDisplayName(application) || "-"}
                          </p>
                          <p className="mt-0.5 text-sm text-admin-muted">
                            {formatAge(application.child_birth_date, ageYear)}{" "}
                            år, {genderLabel(application.child_gender)}
                            {application.desired_class
                              ? `, ønsker ${application.desired_class}`
                              : ""}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm text-admin-muted">
                            {mother || father
                              ? [
                                  mother
                                    ? `${mother}${application.mother_phone ? ` · ${application.mother_phone}` : ""}`
                                    : null,
                                  father
                                    ? `${father}${application.father_phone ? ` · ${application.father_phone}` : ""}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(", ")
                              : "Ingen foresatt registrert"}
                          </p>
                          {application.family_id ? (
                            <Link
                              href={`${basePath}/familier/${application.family_id}`}
                              className="mt-2 inline-flex min-h-10 items-center text-sm font-bold text-[#277A31] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              Åpne familie
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <dl className="grid gap-2 rounded-xl bg-[#F8F6F0] p-3 sm:grid-cols-3">
                          <div>
                            <dt className="text-xs font-bold text-admin-muted">
                              Betaling
                            </dt>
                            <dd className="mt-1">
                              <span
                                className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold ${
                                  payment.paid
                                    ? "bg-[#DCEDDD] text-[#216A2B]"
                                    : "bg-[#FEEDCA] text-[#775108]"
                                }`}
                              >
                                {payment.label}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-admin-muted">
                              Mottatt
                            </dt>
                            <dd className="mt-1 text-sm font-bold">
                              {formatDate(application.created_at)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-admin-muted">
                              Ønsket klasse
                            </dt>
                            <dd className="mt-1 text-sm font-bold">
                              {application.desired_class ?? "Ikke oppgitt"}
                            </dd>
                          </div>
                        </dl>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StudentStatusSelect
                            id={application.id}
                            status={application.status ?? "ny"}
                          />
                          <RegisterStudentButton
                            applicationId={application.id}
                            basePath={basePath}
                            classes={placement.classes}
                            schoolYears={placement.schoolYears}
                            defaultSchoolYearId={defaultSchoolYearId}
                          />
                          <DeleteButton
                            id={application.id}
                            label="påmelding"
                            action={deleteStudentApplication}
                          />
                        </div>
                      </div>
                    </div>

                    <details className="group mt-4 border-t border-[#ECE8DF] pt-2">
                      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-bold text-admin-muted outline-none hover:bg-[#F2F1EB] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                        Se alle opplysninger
                        <ChevronDown
                          aria-hidden="true"
                          className="size-4 transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <dl className="mt-2 grid gap-x-8 gap-y-4 rounded-xl bg-[#F8F6F0] p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <Field
                          label="Adresse"
                          value={addressLine(application)}
                        />
                        <Field
                          label="E-post barn"
                          value={application.child_email}
                        />
                        <Field
                          label="Telefon barn"
                          value={application.child_phone}
                        />
                        <Field
                          label="E-post foresatt 1"
                          value={application.mother_email}
                        />
                        <Field
                          label="E-post foresatt 2"
                          value={application.father_email}
                        />
                        <Field
                          label="Nivå (Koran / Arabisk / Islam)"
                          value={`${levelLabel(application.child_level_quran)} / ${levelLabel(application.child_level_arabic)} / ${levelLabel(application.child_level_islam)}`}
                        />
                        <Field label="Melding" value={application.message} />
                        <Field
                          label="Mottatt"
                          value={formatDate(application.created_at)}
                        />
                      </dl>
                    </details>
                  </li>
                );
              })}
            </ul>
          </BulkActions>
        )}
        {total > PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath={`${basePath}/register`}
            searchParams={sp}
          />
        ) : null}
      </section>
    </div>
  );
}
