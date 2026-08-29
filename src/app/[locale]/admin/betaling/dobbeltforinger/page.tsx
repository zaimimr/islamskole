import Link from "next/link";
import { AlertTriangle, ArrowLeft, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { studentDisplayName } from "@/lib/student-name";
import { adminBasePath } from "@/components/admin/paths";
import {
  DuplicateReview,
  type DuplicateCandidate,
} from "@/components/admin/duplicate-review";

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

async function getCandidates(): Promise<
  { ok: true; candidates: DuplicateCandidate[] } | { ok: false }
> {
  try {
    const supabase = await createClient();
    const candidateResult = await supabase
      .from("duplicate_payment_candidates")
      .select(
        "payment_id, matched_payment_id, matched_reference, matched_created_at, cited_reference, evidence, amount, description, paid_at, method, student_id, school_year_id",
      );

    if (candidateResult.error) return { ok: false };
    const rows = (candidateResult.data as CandidateRow[] | null) ?? [];
    if (rows.length === 0) return { ok: true, candidates: [] };

    const studentIds = [
      ...new Set(rows.map((row) => row.student_id).filter(Boolean)),
    ] as string[];
    const yearIds = [
      ...new Set(rows.map((row) => row.school_year_id).filter(Boolean)),
    ] as string[];
    const [studentResult, yearResult] = await Promise.all([
      studentIds.length > 0
        ? supabase
            .from("students")
            .select("id, child_first_name, child_last_name")
            .in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      yearIds.length > 0
        ? supabase.from("school_years").select("id, label").in("id", yearIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentResult.error || yearResult.error) return { ok: false };

    const nameById = new Map(
      (
        (studentResult.data as
          | {
              id: string;
              child_first_name: string | null;
              child_last_name: string | null;
            }[]
          | null) ?? []
      ).map((student) => [
        student.id,
        studentDisplayName(student) || "Ukjent barn",
      ]),
    );
    const yearById = new Map(
      ((yearResult.data as { id: string; label: string }[] | null) ?? []).map(
        (year) => [year.id, year.label],
      ),
    );

    return {
      ok: true,
      candidates: rows
        .filter(
          (
            row,
          ): row is CandidateRow & {
            payment_id: string;
            matched_payment_id: string;
            matched_reference: string;
          } =>
            Boolean(
              row.payment_id && row.matched_payment_id && row.matched_reference,
            ),
        )
        .map((row) => ({
          paymentId: row.payment_id,
          matchedPaymentId: row.matched_payment_id,
          childName: row.student_id
            ? (nameById.get(row.student_id) ?? "Ukjent barn")
            : "Ukjent barn",
          schoolYear: row.school_year_id
            ? (yearById.get(row.school_year_id) ?? null)
            : null,
          amount: row.amount ?? 0,
          manualDescription: row.description,
          manualPaidAt: row.paid_at,
          manualMethod: row.method ?? "annet",
          matchedReference: row.matched_reference,
          matchedCreatedAt: row.matched_created_at,
          citedReference: row.cited_reference,
          evidence: row.evidence ?? "unmatched",
        })),
    };
  } catch {
    return { ok: false };
  }
}

export default async function DuplicatePaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const basePath = adminBasePath(locale);
  const result = await getCandidates();

  if (!result.ok) {
    return (
      <section
        aria-labelledby="duplicate-load-error"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[#F9DEDB] text-[#8B2F2B]">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1
          id="duplicate-load-error"
          className="mt-4 font-heading text-3xl font-bold tracking-[-0.02em]"
        >
          Kontrollisten kunne ikke lastes
        </h1>
        <p className="mt-2 max-w-prose text-admin-muted">
          Mulige dobbeltføringer er ikke markert som ferdigbehandlet. Prøv igjen
          før du avstemmer betalingene.
        </p>
        <Link
          href={`${basePath}/betaling/dobbeltforinger`}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-admin-action px-4 text-sm font-bold text-white outline-none transition-colors hover:bg-[#27672F] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Prøv igjen
        </Link>
      </section>
    );
  }

  const candidates = result.candidates;
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.amount,
    0,
  );

  return (
    <div className="grid gap-7 lg:gap-8">
      <header>
        <Link
          href={`${basePath}/betaling`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[#277A31] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tilbake til økonomi
        </Link>
        <h1 className="mt-3 text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          Betalinger til kontroll
        </h1>
        <p className="mt-1 max-w-3xl text-admin-muted">
          Sammenlign Vipps-betalingen med den manuelle registreringen og avgjør
          hva som skal telle i saldoen.
        </p>
      </header>

      {candidates.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl bg-[#FFF8E9] p-5 text-[#6B5524] ring-1 ring-[#E8D6AA] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
              <ReceiptText aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="font-heading text-xl font-semibold text-[#3F3216]">
                {candidates.length} betaling
                {candidates.length === 1 ? "" : "er"} må avgjøres
              </h2>
              <p className="mt-0.5 max-w-2xl text-sm">
                Det gjelder totalt{" "}
                <span className="font-bold tabular-nums">
                  {new Intl.NumberFormat("nb-NO", {
                    style: "currency",
                    currency: "NOK",
                    maximumFractionDigits: 0,
                  }).format(total / 100)}
                </span>
                . Ingen rader endres før du tar en beslutning i hver sak.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <DuplicateReview candidates={candidates} />
    </div>
  );
}
