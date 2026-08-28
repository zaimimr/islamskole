import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
import { formatAge, schoolYearStart } from "@/lib/age";
import { deleteStudentApplication } from "@/app/[locale]/admin/actions";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
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
import { Card, CardContent } from "@/components/ui/card";

type StudentApplicationRow = {
  id: string;
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
        "id, child_first_name, child_last_name, child_birth_date, child_gender, child_address, child_postal_code, child_city, child_email, child_phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, desired_class, child_level_quran, child_level_arabic, child_level_islam, message, status, created_at, payment_id, payments(status)",
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

  return (
    <div>
      <PageHeader
        title="Innmeldinger"
        description="Innmeldinger fra foresatte med betalingsstatus."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StudentFilters />
        <ExportButton entity="applications" />
      </div>

      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {filtered
                ? "Ingen innmeldinger samsvarer med søket."
                : "Ingen innmeldinger ennå."}
            </p>
          ) : (
            <BulkActions entity="applications" ids={pageIds}>
              <div className="flex items-center gap-3 border-b px-4 py-2 text-sm text-muted-foreground">
                <BulkSelectAll />
                <span>Velg alle på denne siden</span>
              </div>
              <ul className="divide-y">
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
                    <li key={application.id} className="p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="pt-1">
                          <BulkRowCheckbox id={application.id} />
                        </div>

                        <div className="min-w-56 flex-1">
                          <p className="font-medium">
                            {studentDisplayName(application) || "-"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatAge(application.child_birth_date, ageYear)}{" "}
                            år ·{" "}
                            {genderLabel(application.child_gender)}
                            {application.desired_class
                              ? ` · ønsker ${application.desired_class}`
                              : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
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
                                  .join("  |  ")
                              : "Ingen foresatt registrert"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              payment.paid
                                ? "bg-primary/15 text-brand-green-dark"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {payment.label}
                          </span>
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

                      <details className="group mt-2">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                          Detaljer
                          <span className="transition-transform group-open:rotate-180">
                            ▾
                          </span>
                        </summary>
                        <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
                          <Field label="Adresse" value={addressLine(application)} />
                          <Field
                            label="E-post barn"
                            value={application.child_email}
                          />
                          <Field
                            label="Telefon barn"
                            value={application.child_phone}
                          />
                          <Field
                            label="E-post mor"
                            value={application.mother_email}
                          />
                          <Field
                            label="E-post far"
                            value={application.father_email}
                          />
                          <Field
                            label="Nivå (Koran / Arabisk / Islam)"
                            value={`${levelLabel(application.child_level_quran)} / ${levelLabel(application.child_level_arabic)} / ${levelLabel(application.child_level_islam)}`}
                          />
                          <Field
                            label="Melding"
                            value={application.message}
                          />
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
        </CardContent>
      </Card>
    </div>
  );
}
