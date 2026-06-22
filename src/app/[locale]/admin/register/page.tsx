import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function ageFromBirthDate(value: string | null): number | null {
  if (!value) return null;
  const b = new Date(value);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

function displayAge(app: StudentApplicationRow): string {
  const age = ageFromBirthDate(app.child_birth_date);
  return age != null ? String(age) : "-";
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
  const defaultSchoolYearId =
    placement.schoolYears.find((y) => y.is_active)?.id ?? null;
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <BulkSelectAll />
                  </TableHead>
                  <TableHead>Barn</TableHead>
                  <TableHead>Alder</TableHead>
                  <TableHead>Kjønn</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Mor</TableHead>
                  <TableHead>Far</TableHead>
                  <TableHead>Ønsket klasse</TableHead>
                  <TableHead>Nivå (Koran / Arabisk / Islam)</TableHead>
                  <TableHead>Betaling</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="w-8">
                      <BulkRowCheckbox id={application.id} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {studentDisplayName(application) || "-"}
                    </TableCell>
                    <TableCell>{displayAge(application)}</TableCell>
                    <TableCell>{genderLabel(application.child_gender)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {addressLine(application)}
                    </TableCell>
                    <TableCell>
                      {application.child_email ? (
                        <a
                          href={`mailto:${application.child_email}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {application.child_email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{application.child_phone ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fullName(
                        application.mother_first_name,
                        application.mother_last_name,
                      ) || "-"}
                      {application.mother_phone
                        ? ` · ${application.mother_phone}`
                        : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fullName(
                        application.father_first_name,
                        application.father_last_name,
                      ) || "-"}
                      {application.father_phone
                        ? ` · ${application.father_phone}`
                        : ""}
                    </TableCell>
                    <TableCell>{application.desired_class ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {levelLabel(application.child_level_quran)} /{" "}
                      {levelLabel(application.child_level_arabic)} /{" "}
                      {levelLabel(application.child_level_islam)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const payment = paymentLabel(application);
                        return (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              payment.paid
                                ? "bg-primary/15 text-brand-green-dark"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {payment.label}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <StudentStatusSelect
                        id={application.id}
                        status={application.status ?? "ny"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(application.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
