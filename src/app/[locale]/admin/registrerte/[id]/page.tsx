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

function currentTerm() {
  const now = new Date();
  const season = now.getMonth() + 1 >= 7 ? "Høst" : "Vår";
  return `${season} ${now.getFullYear()}`;
}

type StudentData = {
  id: string;
  full_name: string | null;
  child_age: number | null;
  guardian_name: string | null;
  email: string | null;
  phone: string | null;
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
  const listHref = `${basePath}/registrerte`;
  const supabase = await createClient();

  const { data: studentData } = await supabase
    .from("students")
    .select(
      "id, full_name, child_age, guardian_name, email, phone, level_quran, level_arabic, level_islam, notes",
    )
    .eq("id", id)
    .maybeSingle();

  const student = studentData as StudentData | null;
  if (!student) notFound();

  const { data: classData } = await supabase
    .from("classes")
    .select("id, name_no, price")
    .order("sort_order", { ascending: true });
  const classes = (
    (classData as
      | { id: string; name_no: string | null; price: number | null }[]
      | null) ?? []
  ).map((c) => ({
    id: c.id,
    name: c.name_no ?? "(uten navn)",
    price: c.price,
  }));

  const { data: enrollmentData } = await supabase
    .from("enrollments")
    .select("id, term, status, classes(name_no, price)")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  const enrollmentRaw =
    (enrollmentData as
      | {
          id: string;
          term: string;
          status: string;
          classes: { name_no: string | null; price: number | null } | null;
        }[]
      | null) ?? [];

  const enrollments: EnrollmentRow[] = enrollmentRaw.map((e) => ({
    id: e.id,
    term: e.term,
    status: e.status,
    className: e.classes?.name_no ?? "(uten navn)",
    price: e.classes?.price ?? null,
  }));

  const activeEnrollment = enrollmentRaw.find((e) => e.status === "aktiv");
  const defaultAmount = activeEnrollment?.classes?.price ?? null;

  const { data: paymentData } = await supabase
    .from("payments")
    .select("id, amount, currency, term, description, status, redirect_url, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: false });
  const payments = (paymentData as PaymentRow[] | null) ?? [];

  const enrollmentOptions = enrollments.map((e) => ({
    id: e.id,
    label: `${e.className} · ${e.term}`,
  }));
  const term = currentTerm();

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
        enrollments={enrollments}
        defaultTerm={term}
      />

      <PaymentManager
        studentId={student.id}
        enrollments={enrollmentOptions}
        defaultTerm={term}
        defaultAmount={defaultAmount}
        payments={payments}
      />

      <StudentForm student={student} listHref={listHref} />
    </div>
  );
}
