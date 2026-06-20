import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { guardianName, studentDisplayName } from "@/lib/student-name";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { EleverFilters } from "@/components/admin/elever-filters";
import { ClickableRow } from "@/components/admin/clickable-row";
import { Pagination } from "@/components/admin/pagination";
import { ExportButton } from "@/components/admin/export-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StudentRow = {
  id: string;
  child_first_name: string | null;
  child_last_name: string | null;
  mother_first_name: string | null;
  mother_last_name: string | null;
  father_first_name: string | null;
  father_last_name: string | null;
  child_birth_date: string | null;
  enrollments: {
    school_year_id: string;
    school_years: { label: string } | null;
    classes: { id: string; name_no: string | null } | null;
  }[];
  payments: { status: string; amount: number; school_year_id: string | null }[];
};

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

function displayAge(student: StudentRow): string {
  const age = ageFromBirthDate(student.child_birth_date);
  return age != null ? String(age) : "-";
}

async function getStudents(q: string): Promise<StudentRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("students")
      .select(
        "id, child_first_name, child_last_name, mother_first_name, mother_last_name, father_first_name, father_last_name, child_birth_date, enrollments(school_year_id, school_years(label), classes(id, name_no)), payments(status, amount, school_year_id)",
      )
      .order("created_at", { ascending: false });

    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `child_first_name.ilike.%${term}%,child_last_name.ilike.%${term}%,mother_first_name.ilike.%${term}%,mother_last_name.ilike.%${term}%,father_first_name.ilike.%${term}%,father_last_name.ilike.%${term}%,child_email.ilike.%${term}%`,
      );
    }

    const { data } = await query;
    return (data as StudentRow[] | null) ?? [];
  } catch {
    return [];
  }
}

async function getClasses() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("id, name_no")
      .order("sort_order", { ascending: true });
    return ((data as { id: string; name_no: string | null }[] | null) ?? []).map(
      (c) => ({ id: c.id, name: c.name_no ?? "(uten navn)" }),
    );
  } catch {
    return [];
  }
}

async function getSchoolYears() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("school_years")
      .select("id, label, is_active")
      .order("label", { ascending: false });
    return (
      (data as { id: string; label: string; is_active: boolean }[] | null) ?? []
    ).map((y) => ({ id: y.id, label: y.label, is_active: y.is_active }));
  } catch {
    return [];
  }
}

function classLabel(enrollments: StudentRow["enrollments"]) {
  if (!enrollments || enrollments.length === 0) return "-";
  return (
    enrollments
      .map((e) => e.classes?.name_no)
      .filter(Boolean)
      .join(", ") || "-"
  );
}

function yearLabels(enrollments: StudentRow["enrollments"]) {
  if (!enrollments || enrollments.length === 0) return [];
  return [
    ...new Set(
      enrollments
        .map((e) => e.school_years?.label)
        .filter((l): l is string => Boolean(l)),
    ),
  ].sort().reverse();
}

function paidTotal(payments: StudentRow["payments"]) {
  return (payments ?? [])
    .filter((p) => p.status === "fanget")
    .reduce((sum, p) => sum + p.amount, 0);
}

function pendingTotal(payments: StudentRow["payments"]) {
  return (payments ?? [])
    .filter((p) => p.status === "opprettet" || p.status === "autorisert")
    .reduce((sum, p) => sum + p.amount, 0);
}

function payState(payments: StudentRow["payments"]): "betalt" | "venter" | "ubetalt" {
  if ((payments ?? []).some((p) => p.status === "fanget")) return "betalt";
  if (
    (payments ?? []).some(
      (p) => p.status === "opprettet" || p.status === "autorisert",
    )
  )
    return "venter";
  return "ubetalt";
}

function formatNok(ore: number) {
  return `${(ore / 100).toLocaleString("nb-NO")} kr`;
}

const PAGE_SIZE = 25;

export default async function RegistrertePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const classFilter = typeof sp.class === "string" ? sp.class : "";
  const payFilter = typeof sp.pay === "string" ? sp.pay : "";
  const yearFilter = typeof sp.year === "string" ? sp.year : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const basePath = adminBasePath(locale);

  const [allStudents, classes, schoolYears] = await Promise.all([
    getStudents(q),
    getClasses(),
    getSchoolYears(),
  ]);

  const activeYear = schoolYears.find((y) => y.is_active);
  const activeYearId = activeYear?.id ?? null;
  const activeYearLabel = activeYear?.label ?? null;

  const realYear =
    yearFilter && yearFilter !== "needs_rollover" ? yearFilter : null;
  const scoped = (payments: StudentRow["payments"]) =>
    realYear
      ? payments.filter((p) => p.school_year_id === realYear)
      : payments;

  const students = allStudents.filter((student) => {
    if (yearFilter === "needs_rollover") {
      const hasEnrollments = (student.enrollments ?? []).length > 0;
      const inActive =
        activeYearId != null &&
        (student.enrollments ?? []).some(
          (e) => e.school_year_id === activeYearId,
        );
      if (!hasEnrollments || inActive) return false;
    } else if (realYear) {
      const inYear = (student.enrollments ?? []).some(
        (e) => e.school_year_id === realYear,
      );
      if (!inYear) return false;
    }
    if (classFilter) {
      const inClass = (student.enrollments ?? []).some(
        (e) => e.classes?.id === classFilter,
      );
      if (!inClass) return false;
    }
    if (payFilter && payFilter !== "alle") {
      const state = payState(scoped(student.payments));
      if (payFilter === "ikke_betalt") {
        if (state === "betalt") return false;
      } else if (state !== payFilter) {
        return false;
      }
    }
    return true;
  });

  const totalPaid = students.reduce(
    (s, st) => s + paidTotal(scoped(st.payments)),
    0,
  );
  const totalPending = students.reduce(
    (s, st) => s + pendingTotal(scoped(st.payments)),
    0,
  );

  const total = students.length;
  const from = (page - 1) * PAGE_SIZE;
  const pageStudents = students.slice(from, from + PAGE_SIZE);

  const filtered = Boolean(q || classFilter || payFilter || yearFilter);

  return (
    <div>
      <PageHeader
        title="Elever"
        description="Registrerte elever, klasseplassering og betaling."
        newHref={`${basePath}/elever/ny`}
        newLabel="Ny elev"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Antall elever</p>
            <p className="text-2xl font-bold">{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Betalt</p>
            <p className="text-2xl font-bold">{formatNok(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Utestående</p>
            <p className="text-2xl font-bold">{formatNok(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-2 flex justify-end">
        <ExportButton entity="students" />
      </div>

      <EleverFilters classes={classes} schoolYears={schoolYears} />

      <Card>
        <CardContent className="p-0">
          {pageStudents.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {filtered
                ? "Ingen elever samsvarer med søket."
                : "Ingen registrerte elever ennå."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Alder</TableHead>
                  <TableHead>Foresatt</TableHead>
                  <TableHead>Klasse</TableHead>
                  <TableHead>Skoleår</TableHead>
                  <TableHead>Betalt</TableHead>
                  <TableHead>Betaling</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageStudents.map((student) => {
                  const studentPayments = scoped(student.payments);
                  const state = payState(studentPayments);
                  return (
                    <ClickableRow
                      key={student.id}
                      href={`${basePath}/elever/${student.id}`}
                    >
                      <TableCell className="font-medium">
                        {studentDisplayName(student) || "-"}
                      </TableCell>
                      <TableCell>{displayAge(student)}</TableCell>
                      <TableCell>{guardianName(student) ?? "-"}</TableCell>
                      <TableCell>{classLabel(student.enrollments)}</TableCell>
                      <TableCell>
                        {(() => {
                          const years = yearLabels(student.enrollments);
                          if (years.length === 0)
                            return <span className="text-muted-foreground">-</span>;
                          const missingActive =
                            activeYearLabel != null &&
                            !years.includes(activeYearLabel);
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {years.map((y) => (
                                <Badge key={y} variant="outline">
                                  {y}
                                </Badge>
                              ))}
                              {missingActive ? (
                                <Badge variant="secondary" title={`Ikke i ${activeYearLabel}`}>
                                  Ny termin?
                                </Badge>
                              ) : null}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{formatNok(paidTotal(studentPayments))}</TableCell>
                      <TableCell>
                        {state === "betalt" ? (
                          <Badge>Betalt</Badge>
                        ) : state === "venter" ? (
                          <Badge variant="secondary">Lenke sendt</Badge>
                        ) : (
                          <Badge variant="outline">Ikke sendt</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </TableCell>
                    </ClickableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {total > PAGE_SIZE ? (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath={`${basePath}/elever`}
              searchParams={sp}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
