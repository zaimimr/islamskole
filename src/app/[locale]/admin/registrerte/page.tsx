import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { EleverFilters } from "@/components/admin/elever-filters";
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
  full_name: string | null;
  guardian_name: string | null;
  child_age: number | null;
  enrollments: {
    term: string;
    classes: { id: string; name_no: string | null } | null;
  }[];
  payments: { status: string; amount: number }[];
};

async function getStudents(q: string): Promise<StudentRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("students")
      .select(
        "id, full_name, guardian_name, child_age, enrollments(term, classes(id, name_no)), payments(status, amount)",
      )
      .order("created_at", { ascending: false });

    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,guardian_name.ilike.%${term}%,email.ilike.%${term}%`,
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

function classLabel(enrollments: StudentRow["enrollments"]) {
  if (!enrollments || enrollments.length === 0) return "-";
  return (
    enrollments
      .map((e) => e.classes?.name_no)
      .filter(Boolean)
      .join(", ") || "-"
  );
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
  const basePath = adminBasePath(locale);

  const [allStudents, classes] = await Promise.all([
    getStudents(q),
    getClasses(),
  ]);

  const students = allStudents.filter((student) => {
    if (classFilter) {
      const inClass = (student.enrollments ?? []).some(
        (e) => e.classes?.id === classFilter,
      );
      if (!inClass) return false;
    }
    if (payFilter && payFilter !== "alle") {
      if (payState(student.payments) !== payFilter) return false;
    }
    return true;
  });

  const totalPaid = students.reduce((s, st) => s + paidTotal(st.payments), 0);
  const totalPending = students.reduce(
    (s, st) => s + pendingTotal(st.payments),
    0,
  );

  const filtered = Boolean(q || classFilter || payFilter);

  return (
    <div>
      <PageHeader
        title="Elever"
        description="Registrerte elever, klasseplassering og betaling."
        newHref={`${basePath}/registrerte/ny`}
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

      <EleverFilters classes={classes} />

      <Card>
        <CardContent className="p-0">
          {students.length === 0 ? (
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
                  <TableHead>Betalt</TableHead>
                  <TableHead>Betaling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const state = payState(student.payments);
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`${basePath}/registrerte/${student.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {student.full_name ?? "-"}
                        </Link>
                      </TableCell>
                      <TableCell>{student.child_age ?? "-"}</TableCell>
                      <TableCell>{student.guardian_name ?? "-"}</TableCell>
                      <TableCell>{classLabel(student.enrollments)}</TableCell>
                      <TableCell>{formatNok(paidTotal(student.payments))}</TableCell>
                      <TableCell>
                        {state === "betalt" ? (
                          <Badge>Betalt</Badge>
                        ) : state === "venter" ? (
                          <Badge variant="secondary">Venter</Badge>
                        ) : (
                          <Badge variant="outline">Ingen</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
