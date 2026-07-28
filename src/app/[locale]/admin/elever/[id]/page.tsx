import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { StudentForm } from "@/components/admin/student-form";
import {
  EnrollmentManager,
  type EnrollmentRow,
} from "@/components/admin/enrollment-manager";
import {
  PaymentManager,
  type PaymentRow,
} from "@/components/admin/payment-manager";
import { deleteStudent } from "@/app/[locale]/admin/students-actions";
import { studentDisplayName } from "@/lib/student-name";

type StudentData = {
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
    { data: paymentData },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, child_first_name, child_last_name, child_birth_date, child_gender, child_address, child_postal_code, child_city, child_email, child_phone, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email, child_level_quran, child_level_arabic, child_level_islam, notes",
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
      .from("payments")
      .select(
        "id, amount, currency, description, status, method, reference, paid_at, redirect_url, created_at, school_years(label)",
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
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
  const defaultAmount =
    activeEnrollment?.classes?.price ?? activeYear?.fee ?? null;

  const payments: PaymentRow[] = (
    (paymentData as
      | (Omit<PaymentRow, "schoolYear"> & {
          school_years: { label: string } | null;
        })[]
      | null) ?? []
  ).map((p) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    description: p.description,
    status: p.status,
    method: p.method,
    reference: p.reference,
    paid_at: p.paid_at,
    redirect_url: p.redirect_url,
    created_at: p.created_at,
    schoolYear: p.school_years?.label ?? null,
  }));

  const classByYear: Record<string, string> = {};
  for (const e of enrollmentRaw) {
    if (e.status === "aktiv" && !classByYear[e.school_year_id]) {
      classByYear[e.school_year_id] = e.classes?.name_no ?? "(uten navn)";
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title={studentDisplayName(student) || "Elev"}
        description="Rediger elev, plassering og betaling."
        action={
          <DeleteButton
            id={student.id}
            label="elev"
            action={deleteStudent}
            redirectTo={listHref}
          />
        }
      />

      <PaymentManager
        studentId={student.id}
        classByYear={classByYear}
        schoolYears={schoolYears}
        defaultSchoolYearId={defaultSchoolYearId}
        defaultAmount={defaultAmount}
        payments={payments}
      />

      <EnrollmentManager
        studentId={student.id}
        classes={classes}
        schoolYears={schoolYears}
        enrollments={enrollments}
        defaultSchoolYearId={defaultSchoolYearId}
      />

      <StudentForm student={student} listHref={listHref} />
    </div>
  );
}
