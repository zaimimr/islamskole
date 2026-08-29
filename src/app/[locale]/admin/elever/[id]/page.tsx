import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CircleDollarSign,
  GraduationCap,
  UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { DeleteButton } from "@/components/admin/delete-button";
import { StudentForm } from "@/components/admin/student-form";
import {
  EnrollmentManager,
  type EnrollmentRow,
} from "@/components/admin/enrollment-manager";
import {
  PaymentManager,
  type PaymentRow,
  type YearFee,
} from "@/components/admin/payment-manager";
import { deleteStudent } from "@/app/[locale]/admin/students-actions";
import { studentDisplayName } from "@/lib/student-name";
import { formatAge, schoolYearStart } from "@/lib/age";

type StudentData = {
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
  child_level_quran: string | null;
  child_level_arabic: string | null;
  child_level_islam: string | null;
  notes: string | null;
};

export default async function ElevDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const basePath = adminBasePath(locale);
  const listHref = `${basePath}/elever`;
  const supabase = await createClient();

  const [
    { data: studentData },
    { data: classData },
    { data: yearData },
    { data: enrollmentData },
    { data: allocationData },
    { data: balanceData },
    { data: feeData },
    { data: adjustmentData },
    { data: teacherData },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, family_id, child_first_name, child_last_name, child_birth_date, child_gender, child_address, child_postal_code, child_city, child_email, child_phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, child_level_quran, child_level_arabic, child_level_islam, notes",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id, name_no, price")
      .order("sort_order", { ascending: true }),
    supabase
      .from("school_years")
      .select("id, label, is_active, fee")
      .order("label", { ascending: false }),
    supabase
      .from("enrollments")
      .select(
        "id, school_year_id, status, classes(name_no, price), school_years(label)",
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_allocations")
      .select("payment_id, amount, school_year_id")
      .eq("student_id", id),
    supabase
      .from("student_balances")
      .select("school_year_id, owed, paid, remaining, state")
      .eq("student_id", id),
    supabase
      .from("student_fees")
      .select("school_year_id, amount, discount, note")
      .eq("student_id", id),
    supabase
      .from("student_fee_adjustments")
      .select(
        "id, school_year_id, type, amount, note, created_at, guardians(first_name, last_name)",
      )
      .eq("student_id", id)
      .is("revoked_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("guardians")
      .select("id, first_name, last_name")
      .eq("is_teacher", true)
      .order("first_name", { ascending: true }),
  ]);

  const student = studentData as StudentData | null;
  if (!student) notFound();

  const classes = (
    (classData as
      | { id: string; name_no: string | null; price: number | null }[]
      | null) ?? []
  ).map((c) => ({
    id: c.id,
    name: c.name_no ?? "(uten navn)",
    price: c.price,
  }));

  const yearsRaw =
    (yearData as
      | { id: string; label: string; is_active: boolean; fee: number | null }[]
      | null) ?? [];
  const schoolYears = yearsRaw.map((y) => ({ id: y.id, label: y.label }));
  const activeYear = yearsRaw.find((y) => y.is_active) ?? yearsRaw[0];
  const defaultSchoolYearId = activeYear?.id ?? null;

  const enrollmentRaw =
    (enrollmentData as
      | {
          id: string;
          school_year_id: string;
          status: string;
          classes: { name_no: string | null; price: number | null } | null;
          school_years: { label: string } | null;
        }[]
      | null) ?? [];

  const enrollments: EnrollmentRow[] = enrollmentRaw.map((e) => ({
    id: e.id,
    schoolYear: e.school_years?.label ?? "-",
    status: e.status,
    className: e.classes?.name_no ?? "(uten navn)",
    price: e.classes?.price ?? null,
  }));

  const activeEnrollment =
    enrollmentRaw.find(
      (e) => e.status === "aktiv" && e.school_year_id === defaultSchoolYearId,
    ) ?? enrollmentRaw.find((e) => e.status === "aktiv");
  const balancesByYear: Record<
    string,
    { owed: number; paid: number; remaining: number }
  > = {};
  for (const row of (balanceData as
    | {
        school_year_id: string | null;
        owed: number | null;
        paid: number | null;
        remaining: number | null;
      }[]
    | null) ?? []) {
    if (!row.school_year_id) continue;
    balancesByYear[row.school_year_id] = {
      owed: row.owed ?? 0,
      paid: row.paid ?? 0,
      remaining: row.remaining ?? 0,
    };
  }

  const feesByYear: Record<string, YearFee> = {};
  for (const row of (feeData as
    | {
        school_year_id: string;
        amount: number | null;
        discount: number | null;
        note: string | null;
      }[]
    | null) ?? []) {
    feesByYear[row.school_year_id] = {
      amount: row.amount ?? 0,
      discount: row.discount ?? 0,
      note: row.note,
    };
  }

  const adjustments = (
    (adjustmentData as
      | {
          id: string;
          school_year_id: string;
          type: string;
          amount: number;
          note: string;
          created_at: string | null;
          guardians: { first_name: string | null; last_name: string | null } | null;
        }[]
      | null) ?? []
  ).map((adjustment) => ({
    id: adjustment.id,
    schoolYearId: adjustment.school_year_id,
    type: adjustment.type,
    amount: adjustment.amount,
    note: adjustment.note,
    teacherName: adjustment.guardians
      ? [adjustment.guardians.first_name, adjustment.guardians.last_name]
          .filter(Boolean)
          .join(" ") || null
      : null,
    createdAt: adjustment.created_at,
  }));

  const teachers = (
    (teacherData as
      | { id: string; first_name: string | null; last_name: string | null }[]
      | null) ?? []
  ).map((teacher) => ({
    id: teacher.id,
    name:
      [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") ||
      "(uten navn)",
  }));

  const fallbackAmount =
    activeEnrollment?.classes?.price ?? activeYear?.fee ?? null;
  const defaultAmount = fallbackAmount;

  const allocations =
    (allocationData as
      | { payment_id: string; amount: number; school_year_id: string }[]
      | null) ?? [];

  const allocationByPayment = new Map(
    allocations.map((a) => [a.payment_id, a.amount]),
  );

  const paymentIds = [...new Set(allocations.map((a) => a.payment_id))];

  const paymentFilter = paymentIds.length
    ? `id.in.(${paymentIds.join(",")}),student_id.eq.${id}`
    : `student_id.eq.${id}`;

  const { data: refundData } = paymentIds.length
    ? await supabase
        .from("refunds")
        .select("payment_id, student_id, amount")
        .in("payment_id", paymentIds)
    : { data: [] };
  const refundRows = (refundData ?? []) as {
    payment_id: string;
    student_id: string | null;
    amount: number;
  }[];

  const { data: paymentData } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, description, status, method, paid_at, due_date, redirect_url, created_at, reference, voided_at, void_reason, payer_name, payer_phone, payer_email, vipps_state, vipps_payment_method, psp_reference, last_synced_at, captured_at, captured_amount, refunded_amount, student_id, school_year_id, school_years(label), payment_allocations(student_id, amount, students(child_first_name, child_last_name))",
    )
    .or(paymentFilter)
    .order("created_at", { ascending: false });

  const payments: PaymentRow[] = (
    (paymentData as
      | (Omit<
          PaymentRow,
          "schoolYear" | "allocatedAmount" | "sharedWith" | "schoolYearId"
        > & {
          school_year_id: string | null;
          school_years: { label: string } | null;
          captured_amount: number;
          refunded_amount: number;
          payment_allocations:
            | {
                student_id: string;
                amount: number;
                students: {
                  child_first_name: string | null;
                  child_last_name: string | null;
                } | null;
              }[]
            | null;
        })[]
      | null) ?? []
  ).map((p) => {
    const covers = (p.payment_allocations ?? []).length;
    return {
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      description: p.description,
      status: p.status,
      method: p.method,
      paid_at: p.paid_at,
      due_date: p.due_date,
      redirect_url: p.redirect_url,
      created_at: p.created_at,
      reference: p.reference,
      voided_at: p.voided_at,
      void_reason: p.void_reason,
      payer_name: p.payer_name,
      payer_phone: p.payer_phone,
      payer_email: p.payer_email,
      vipps_state: p.vipps_state,
      vipps_payment_method: p.vipps_payment_method,
      psp_reference: p.psp_reference,
      last_synced_at: p.last_synced_at,
      captured_at: p.captured_at,
      schoolYear: p.school_years?.label ?? null,
      schoolYearId: p.school_year_id,
      allocatedAmount: allocationByPayment.get(p.id) ?? null,
      sharedWith: covers > 1 ? covers : null,
      capturedAmount: p.captured_amount ?? 0,
      refundedAmount: p.refunded_amount ?? 0,
      refundAllocations: (p.payment_allocations ?? []).map((allocation) => ({
        studentId: allocation.student_id,
        name: allocation.students
          ? studentDisplayName(allocation.students) || "Ukjent barn"
          : "Ukjent barn",
        amount: allocation.amount,
        refunded: (refundRows ?? [])
          .filter(
            (refund) =>
              refund.payment_id === p.id &&
              refund.student_id === allocation.student_id,
          )
          .reduce((sum, refund) => sum + refund.amount, 0),
      })),
    };
  });

  const classByYear: Record<string, string> = {};
  for (const e of enrollmentRaw) {
    if (e.status === "aktiv" && !classByYear[e.school_year_id]) {
      classByYear[e.school_year_id] = e.classes?.name_no ?? "(uten navn)";
    }
  }

  const activeBalance = defaultSchoolYearId
    ? balancesByYear[defaultSchoolYearId]
    : null;
  const activeClass = activeEnrollment?.classes?.name_no ?? "Ikke plassert";

  const formatNok = (amount: number) =>
    `${(amount / 100).toLocaleString("nb-NO")} kr`;

  return (
    <div className="grid gap-5 sm:gap-6">
      <header>
        <Link
          href={listHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[#277A31] outline-none hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tilbake til elever
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-balance font-heading text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              {studentDisplayName(student) || "Elev"}
              {student.child_birth_date ? (
                <span className="ml-3 align-middle font-sans text-base font-bold text-admin-muted">
                  {formatAge(
                    student.child_birth_date,
                    schoolYearStart(activeYear?.label) ??
                      new Date().getFullYear(),
                  )}{" "}
                  år
                </span>
              ) : null}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-admin-muted sm:text-base">
              Følg opp skoleplass, betaling og elevopplysninger uten å miste
              familiekonteksten.
            </p>
          </div>
          {student.family_id ? (
            <Link
              href={`${basePath}/familier/${student.family_id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CFC9BD] bg-white px-4 text-sm font-bold outline-none transition-colors hover:bg-[#F2F1EB] focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <UsersRound
                aria-hidden="true"
                className="size-4 text-[#2F7938]"
              />
              Åpne familie
            </Link>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Aktiv elevstatus"
        className="grid overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] sm:grid-cols-3"
      >
        <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DCEDDD] text-[#216A2B]">
            <GraduationCap aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-admin-muted">Aktiv klasse</p>
            <p className="mt-1 font-heading text-xl font-bold">{activeClass}</p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EFF8FD] text-[#245D7C]">
            <GraduationCap aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-admin-muted">Skoleår</p>
            <p className="mt-1 font-heading text-xl font-bold">
              {activeYear?.label ?? "Ikke valgt"}
            </p>
          </div>
        </div>
        <div className="flex min-h-24 items-center gap-3 border-t border-[#ECE8DF] px-4 py-4 sm:border-t-0 sm:border-l sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEEDCA] text-[#775108]">
            <CircleDollarSign aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-admin-muted">
              Gjenstår å betale
            </p>
            <p className="mt-1 font-heading text-xl font-bold tabular-nums">
              {formatNok(activeBalance?.remaining ?? 0)}
            </p>
          </div>
        </div>
      </section>

      <PaymentManager
        studentId={student.id}
        classByYear={classByYear}
        schoolYears={schoolYears}
        defaultSchoolYearId={defaultSchoolYearId}
        defaultAmount={defaultAmount}
        balancesByYear={balancesByYear}
        feesByYear={feesByYear}
        payments={payments}
        adjustments={adjustments}
        teachers={teachers}
      />

      <EnrollmentManager
        studentId={student.id}
        classes={classes}
        schoolYears={schoolYears}
        enrollments={enrollments}
        defaultSchoolYearId={defaultSchoolYearId}
      />

      <StudentForm student={student} listHref={listHref} />

      <section className="flex flex-col gap-3 rounded-2xl bg-[#FFF2F1] p-4 ring-1 ring-[#E7B8B4] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="font-heading text-lg font-bold text-[#7F2923]">
            Slett elevoppføringen
          </h2>
          <p className="mt-1 text-sm text-[#7F2923]">
            Dette fjerner elevoppføringen permanent og kan ikke angres.
          </p>
        </div>
        <div className="flex min-h-11 items-center justify-end rounded-xl bg-white px-2 ring-1 ring-[#E7B8B4]">
          <span className="pl-2 text-sm font-bold text-[#9A3028]">
            Slett elev
          </span>
          <DeleteButton
            id={student.id}
            label="elev"
            action={deleteStudent}
            redirectTo={listHref}
          />
        </div>
      </section>
    </div>
  );
}
