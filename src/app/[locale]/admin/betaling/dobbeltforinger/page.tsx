import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
import { PageHeader } from "@/components/admin/page-header";
import {
  DuplicateReview,
  type DuplicateCandidate,
} from "@/components/admin/duplicate-review";
import { Card, CardContent } from "@/components/ui/card";

type CandidateRow = {
  payment_id: string | null;
  matched_payment_id: string | null;
  matched_reference: string | null;
  matched_created_at: string | null;
  cited_reference: string | null;
  evidence: string | null;
  amount: number | null;
  description: string | null;
  paid_at: string | null;
  method: string | null;
  student_id: string | null;
  school_year_id: string | null;
};

async function getCandidates(): Promise<DuplicateCandidate[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("duplicate_payment_candidates")
    .select(
      "payment_id, matched_payment_id, matched_reference, matched_created_at, cited_reference, evidence, amount, description, paid_at, method, student_id, school_year_id",
    );

  const rows = (data as CandidateRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const studentIds = [
    ...new Set(rows.map((row) => row.student_id).filter(Boolean)),
  ] as string[];
  const yearIds = [
    ...new Set(rows.map((row) => row.school_year_id).filter(Boolean)),
  ] as string[];

  const [{ data: students }, { data: years }] = await Promise.all([
    supabase
      .from("students")
      .select("id, child_first_name, child_last_name")
      .in("id", studentIds),
    supabase.from("school_years").select("id, label").in("id", yearIds),
  ]);

  const nameById = new Map(
    ((students as
      | {
          id: string;
          child_first_name: string | null;
          child_last_name: string | null;
        }[]
      | null) ?? []
    ).map((student) => [student.id, studentDisplayName(student) || "Ukjent"]),
  );
  const yearById = new Map(
    (((years as { id: string; label: string }[] | null) ?? []).map((year) => [
      year.id,
      year.label,
    ]) ?? []) as [string, string][],
  );

  return rows
    .filter(
      (row): row is CandidateRow & {
        payment_id: string;
        matched_payment_id: string;
        matched_reference: string;
      } =>
        Boolean(row.payment_id && row.matched_payment_id && row.matched_reference),
    )
    .map((row) => ({
      paymentId: row.payment_id,
      matchedPaymentId: row.matched_payment_id,
      childName: row.student_id
        ? nameById.get(row.student_id) ?? "Ukjent"
        : "Ukjent",
      schoolYear: row.school_year_id
        ? yearById.get(row.school_year_id) ?? null
        : null,
      amount: row.amount ?? 0,
      manualDescription: row.description,
      manualPaidAt: row.paid_at,
      manualMethod: row.method ?? "annet",
      matchedReference: row.matched_reference,
      matchedCreatedAt: row.matched_created_at,
      citedReference: row.cited_reference,
      evidence: row.evidence ?? "unmatched",
    }));
}

export default async function DuplicatePaymentsPage() {
  const candidates = await getCandidates();
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.amount,
    0,
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Mistenkte dobbeltføringer"
        description="Betalinger som ser ut til å være registrert manuelt i tillegg til at de kom inn via Vipps."
      />

      {candidates.length > 0 ? (
        <Card>
          <CardContent className="p-4 text-sm">
            <span className="font-medium">
              {candidates.length} til gjennomgang
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {(total / 100).toLocaleString("nb-NO")} kr står oppført to
              ganger. Marker som dobbeltføring for å slutte å telle den manuelle
              raden, eller behold begge hvis det faktisk er to innbetalinger.
            </span>
          </CardContent>
        </Card>
      ) : null}

      <DuplicateReview candidates={candidates} />
    </div>
  );
}
