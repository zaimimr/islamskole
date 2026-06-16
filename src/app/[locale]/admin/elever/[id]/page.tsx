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

type StudentData = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  guardian_name: string | null;
  email: string | null;
  phone: string | null;
  guardian2_name: string | null;
  guardian2_email: string | null;
  guardian2_phone: string | null;
  student_email: string | null;
  student_phone: string | null;
  level_quran: string | null;
  level_arabic: string | null;
  level_islam: string | null;
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
        "id, full_name, birth_date, guardian_name, email, phone, guardian2_name, guardian2_email, guardian2_phone, student_email, student_phone, level_quran, level_arabic, level_islam, notes",
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
        "id, amount, currency, description, status, redirect_url, created_at, school_years(label)",
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
    redirect_url: p.redirect_url,
    created_at: p.created_at,
    schoolYear: p.school_years?.label ?? null,
  }));

  const enrollmentOptions = enrollments.map((e) => ({
    id: e.id,
    label: `${e.className} · ${e.schoolYear}`,
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title={student.full_name ?? "Elev"}
        description="Rediger elev, plassering og betaling."
        action={
          <DeleteButton id={student.id} label="elev" action={deleteStudent} />
        }
      />

      <EnrollmentManager
        studentId={student.id}
        classes={classes}
        schoolYears={schoolYears}
        enrollments={enrollments}
        defaultSchoolYearId={defaultSchoolYearId}
      />

      <PaymentManager
        studentId={student.id}
        enrollments={enrollmentOptions}
        schoolYears={schoolYears}
        defaultSchoolYearId={defaultSchoolYearId}
        defaultAmount={defaultAmount}
        payments={payments}
      />

      <StudentForm student={student} listHref={listHref} />
    </div>
  );
}
