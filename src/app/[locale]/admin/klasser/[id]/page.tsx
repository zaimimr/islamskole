import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Mail, Phone, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { adminBasePath } from "@/components/admin/paths";
import { ClassForm, type ClassRecord } from "@/components/admin/class-form";
import { ageInYear, schoolYearStart } from "@/lib/age";
import { formatNok } from "@/lib/money";
import { formatOsloDate, osloToday } from "@/lib/dates";
import { studentDisplayName } from "@/lib/student-name";
import { cn } from "@/lib/utils";
import { RosterTools, type RosterCsvRow } from "./roster-tools";
import { ClassTeachers, type ClassTeacher } from "./class-teachers";

export const metadata: Metadata = { title: "Klasse" };

type EnrollmentRow = {
  student_id: string;
  students: {
    id: string;
    family_id: string | null;
    child_first_name: string | null;
    child_last_name: string | null;
    child_birth_date: string | null;
    mother_first_name: string | null;
    mother_last_name: string | null;
    mother_phone: string | null;
    mother_email: string | null;
    father_first_name: string | null;
    father_last_name: string | null;
    father_phone: string | null;
    father_email: string | null;
  } | null;
};

type GuardianRow = {
  family_id: string;
  is_primary_contact: boolean;
  sort_order: number;
  guardian: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type BalanceRow = {
  student_id: string | null;
  owed: number | null;
  paid: number | null;
  remaining: number | null;
};

type TeacherRow = {
  guardian: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type CandidateRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type SchoolDayRow = { id: string; date: string };

type AttendanceRow = {
  student_id: string;
  school_day_id: string;
  status: string;
};

type PayChip = { label: string; tone: "ok" | "warn" | "danger" | "neutral" };

const chipClasses: Record<PayChip["tone"], string> = {
  ok: "bg-[#DCEDDD] text-[#216A2B]",
  warn: "bg-[#FEEDCA] text-[#775108]",
  danger: "bg-[#F9DEDB] text-[#8B2F2B]",
  neutral: "bg-[#F0F0ED] text-[#4D554F]",
};

function payChip(balance: BalanceRow | undefined): PayChip {
  if (!balance) return { label: "Ingen krav", tone: "danger" };
  const owed = balance.owed ?? 0;
  const remaining = balance.remaining ?? 0;
  if (owed === 0) return { label: "Fritatt", tone: "neutral" };
  if (remaining <= 0) return { label: "Betalt", tone: "ok" };
  if ((balance.paid ?? 0) > 0) {
    return { label: `${formatNok(remaining)} igjen`, tone: "warn" };
  }
  return { label: "Ikke betalt", tone: "danger" };
}

function attendanceSummary(rows: AttendanceRow[], heldDays: number) {
  if (heldDays === 0) return null;
  if (rows.length === 0) return "Ikke ført";
  const absent = rows.filter(
    (row) => row.status === "fravaer" || row.status === "meldt_fravaer",
  ).length;
  const late = rows.filter((row) => row.status === "sent").length;
  const parts = [absent ? `${absent} fravær` : "Ingen fravær"];
  if (late) parts.push(`${late} sent`);
  return parts.join(", ");
}

function joinName(first: string | null, last: string | null) {
  return [first, last].filter(Boolean).join(" ");
}

async function getClassPage(id: string) {
  const supabase = await createClient();
  const [classResult, yearResult] = await Promise.all([
    supabase.from("classes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("school_years")
      .select("id, label")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const classRecord = (classResult.data as ClassRecord | null) ?? null;
  const activeYear = yearResult.data as { id: string; label: string } | null;
  if (!classRecord || !activeYear) {
    return {
      classRecord,
      activeYear,
      enrollments: [] as EnrollmentRow[],
      guardians: [] as GuardianRow[],
      balances: [] as BalanceRow[],
      teachers: [] as TeacherRow[],
      candidates: [] as CandidateRow[],
      schoolDays: [] as SchoolDayRow[],
      attendance: [] as AttendanceRow[],
      error: Boolean(classResult.error || yearResult.error),
    };
  }

  const enrollmentResult = await supabase
    .from("enrollments")
    .select(
      "student_id, students(id, family_id, child_first_name, child_last_name, child_birth_date, mother_first_name, mother_last_name, mother_phone, mother_email, father_first_name, father_last_name, father_phone, father_email)",
    )
    .eq("class_id", id)
    .eq("school_year_id", activeYear.id)
    .eq("status", "aktiv");
  const enrollments = (enrollmentResult.data as EnrollmentRow[] | null) ?? [];
  const studentIds = enrollments.map((row) => row.student_id);
  const familyIds = [
    ...new Set(
      enrollments
        .map((row) => row.students?.family_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [
    guardianResult,
    balanceResult,
    teacherResult,
    candidateResult,
    dayResult,
    attendanceResult,
  ] = await Promise.all([
    familyIds.length
      ? supabase
          .from("family_guardians")
          .select(
            "family_id, is_primary_contact, sort_order, guardian:guardians(first_name, last_name, phone, email)",
          )
          .in("family_id", familyIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase
          .from("student_balances")
          .select("student_id, owed, paid, remaining")
          .eq("school_year_id", activeYear.id)
          .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("class_teachers")
      .select("guardian:guardians!inner(id, first_name, last_name, phone, email)")
      .eq("class_id", id)
      .eq("school_year_id", activeYear.id)
      .eq("guardian.is_teacher", true),
    supabase
      .from("guardians")
      .select("id, first_name, last_name")
      .eq("is_teacher", true)
      .order("first_name", { ascending: true }),
    supabase
      .from("school_days")
      .select("id, date")
      .eq("school_year_id", activeYear.id)
      .eq("cancelled", false)
      .lte("date", osloToday())
      .order("date", { ascending: false }),
    studentIds.length
      ? supabase
          .from("attendance")
          .select("student_id, school_day_id, status, school_days!inner(school_year_id)")
          .eq("school_days.school_year_id", activeYear.id)
          .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    classRecord,
    activeYear,
    enrollments,
    guardians: (guardianResult.data as GuardianRow[] | null) ?? [],
    balances: (balanceResult.data as BalanceRow[] | null) ?? [],
    teachers: (teacherResult.data as TeacherRow[] | null) ?? [],
    candidates: (candidateResult.data as CandidateRow[] | null) ?? [],
    schoolDays: (dayResult.data as SchoolDayRow[] | null) ?? [],
    attendance: (attendanceResult.data as AttendanceRow[] | null) ?? [],
    error: Boolean(
      classResult.error ||
        yearResult.error ||
        enrollmentResult.error ||
        guardianResult.error ||
        balanceResult.error ||
        teacherResult.error ||
        candidateResult.error ||
        dayResult.error ||
        attendanceResult.error,
    ),
  };
}

export default async function KlassePage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/klasser/[id]">) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  const basePath = adminBasePath(locale);
  const listHref = `${basePath}/klasser`;
  const classHref = `${listHref}/${id}`;
  const tab = query.fane === "nettside" ? "nettside" : "elever";
  const data = await getClassPage(id);
  const { classRecord, activeYear } = data;

  if (!classRecord) notFound();

  const ageYear = schoolYearStart(activeYear?.label) ?? new Date().getFullYear();
  const primaryByFamily = new Map<string, GuardianRow["guardian"]>();
  for (const row of [...data.guardians].sort(
    (left, right) =>
      Number(right.is_primary_contact) - Number(left.is_primary_contact) ||
      left.sort_order - right.sort_order,
  )) {
    if (!primaryByFamily.has(row.family_id) && row.guardian) {
      primaryByFamily.set(row.family_id, row.guardian);
    }
  }
  const balanceByStudent = new Map(
    data.balances
      .filter((row) => row.student_id)
      .map((row) => [row.student_id as string, row]),
  );

  const heldDayIds = new Set(data.schoolDays.map((day) => day.id));
  const heldAttendance = data.attendance.filter((row) =>
    heldDayIds.has(row.school_day_id),
  );
  const attendanceByStudent = new Map<string, AttendanceRow[]>();
  const attendanceByDay = new Map<string, AttendanceRow[]>();
  for (const row of heldAttendance) {
    attendanceByStudent.set(row.student_id, [
      ...(attendanceByStudent.get(row.student_id) ?? []),
      row,
    ]);
    attendanceByDay.set(row.school_day_id, [
      ...(attendanceByDay.get(row.school_day_id) ?? []),
      row,
    ]);
  }

  const roster = data.enrollments
    .filter((row) => row.students)
    .map((row) => {
      const student = row.students!;
      const guardian = student.family_id
        ? primaryByFamily.get(student.family_id)
        : undefined;
      const guardianName = guardian
        ? joinName(guardian.first_name, guardian.last_name)
        : joinName(student.mother_first_name, student.mother_last_name) ||
          joinName(student.father_first_name, student.father_last_name);
      const phone = guardian
        ? guardian.phone
        : student.mother_phone || student.father_phone;
      const email = guardian
        ? guardian.email
        : student.mother_email || student.father_email;
      const age = ageInYear(student.child_birth_date, ageYear);
      return {
        id: student.id,
        name: studentDisplayName(student) || "Navn mangler",
        age,
        guardianName: guardianName || null,
        phone: phone ?? null,
        email: email ?? null,
        pay: payChip(balanceByStudent.get(student.id)),
        attendance: attendanceSummary(
          attendanceByStudent.get(student.id) ?? [],
          data.schoolDays.length,
        ),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "nb-NO"));

  const capacity = classRecord.capacity ?? null;
  const ratio = capacity ? Math.min(roster.length / capacity, 1) : 0;
  const full = capacity != null && roster.length >= capacity;
  const csvRows: RosterCsvRow[] = roster.map((row) => ({
    name: row.name,
    age: row.age != null ? String(row.age) : "",
    guardian: row.guardianName ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    payment: row.pay.label,
  }));
  const className = classRecord.name_no ?? "Klasse";
  const rosterIds = new Set(roster.map((row) => row.id));
  const daySummaries = data.schoolDays.slice(0, 12).map((day) => {
    const rows = (attendanceByDay.get(day.id) ?? []).filter((row) =>
      rosterIds.has(row.student_id),
    );
    const count = (status: string) =>
      rows.filter((row) => row.status === status).length;
    return {
      id: day.id,
      date: day.date,
      present: count("til_stede"),
      absent: count("fravaer"),
      reported: count("meldt_fravaer"),
      late: count("sent"),
      unmarked: Math.max(roster.length - rows.length, 0),
    };
  });
  const classTeachers: ClassTeacher[] = data.teachers
    .filter((row) => row.guardian)
    .map((row) => ({
      id: row.guardian!.id,
      name: joinName(row.guardian!.first_name, row.guardian!.last_name) || "(uten navn)",
      phone: row.guardian!.phone,
      email: row.guardian!.email,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "nb-NO"));
  const teacherCandidates = data.candidates.map((row) => ({
    id: row.id,
    name: joinName(row.first_name, row.last_name) || "(uten navn)",
  }));

  return (
    <div className="grid gap-6 lg:gap-7">
      <header>
        <Link
          href={listHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#277A31] outline-none transition-colors hover:bg-[#F2F7F2] focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Tilbake til klasser
        </Link>
        <h1 className="mt-3 text-balance font-heading text-[2rem] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
          {className}
        </h1>
        <p className="mt-1 max-w-2xl text-admin-muted">
          {activeYear
            ? `Elevliste for ${activeYear.label}`
            : "Velg et aktivt skoleår for å se elevlisten."}
        </p>
      </header>

      <nav
        aria-label="Klassevisning"
        className="flex gap-1 border-b border-[#E3DED3] print:hidden"
      >
        {[
          { id: "elever", label: "Elever i år", href: classHref },
          { id: "nettside", label: "Nettside", href: `${classHref}?fane=nettside` },
        ].map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={tab === item.id ? "page" : undefined}
            className="relative inline-flex min-h-11 items-center px-3 text-sm font-bold text-admin-muted outline-none transition-colors hover:text-foreground focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:text-[#277A31] aria-[current=page]:after:absolute aria-[current=page]:after:right-3 aria-[current=page]:after:bottom-0 aria-[current=page]:after:left-3 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-[#3C8F44]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "nettside" ? (
        <ClassForm classRecord={classRecord} listHref={listHref} />
      ) : data.error ? (
        <section className="rounded-2xl bg-white p-6 ring-1 ring-[#E3DED3]">
          <h2 className="font-heading text-xl font-bold">
            Elevlisten kunne ikke lastes
          </h2>
          <p className="mt-1 text-sm text-admin-muted">
            Last siden på nytt. Ingen elever er skjult med vilje.
          </p>
        </section>
      ) : (
        <>
          {activeYear ? (
            <ClassTeachers
              classId={classRecord.id}
              yearLabel={activeYear.label}
              assigned={classTeachers}
              candidates={teacherCandidates}
              teachersHref={`${basePath}/laerere`}
            />
          ) : null}
          <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] print:ring-0">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECE8DF] px-4 py-4 sm:px-5">
              <div className="grid min-w-48 gap-1.5">
                <p className="text-sm tabular-nums">
                  <span className="font-heading text-2xl font-bold">
                    {roster.length}
                  </span>
                  {capacity != null ? ` av ${capacity} plasser` : " elever"}
                  {full ? (
                    <span className="ml-2 rounded-full bg-[#F9DEDB] px-2 py-0.5 text-xs font-bold text-[#8B2F2B]">
                      Full
                    </span>
                  ) : null}
                </p>
                {capacity != null ? (
                  <span
                    aria-hidden="true"
                    className="h-2 w-full max-w-64 overflow-hidden rounded-full bg-[#ECE8DF]"
                  >
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        full ? "bg-[#C5524C]" : "bg-[#3C8F44]",
                      )}
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </span>
                ) : null}
              </div>
              <RosterTools
                rows={csvRows}
                fileName={`${className} ${activeYear?.label ?? ""}`
                  .trim()
                  .replace(/[^\p{L}\p{N}]+/gu, "-")
                  .concat(".csv")}
              />
            </div>

            {roster.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                <UsersRound aria-hidden="true" className="size-7 text-admin-muted" />
                <p className="mt-3 font-bold">Ingen elever i klassen ennå</p>
                <p className="mt-1 max-w-sm text-sm text-admin-muted">
                  Elever plasseres fra Opptak eller fra elevsiden.
                </p>
              </div>
            ) : (
              <>
                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="border-b border-[#ECE8DF] text-xs text-admin-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-bold">Navn</th>
                      <th scope="col" className="px-3 py-3 font-bold">Alder</th>
                      <th scope="col" className="px-3 py-3 font-bold">Foresatt</th>
                      <th scope="col" className="px-3 py-3 font-bold">Telefon</th>
                      <th scope="col" className="px-3 py-3 font-bold">Oppmøte</th>
                      <th scope="col" className="px-5 py-3 font-bold">Betaling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE8DF]">
                    {roster.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-3 font-bold">
                          <Link
                            href={`${basePath}/elever/${row.id}`}
                            className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {row.age != null ? `${row.age} år` : "-"}
                        </td>
                        <td className="px-3 py-3">{row.guardianName ?? "-"}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {row.phone ? (
                            <a
                              href={`tel:${row.phone.replace(/\s+/g, "")}`}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded font-bold text-[#277A31] underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <Phone aria-hidden="true" className="size-4 print:hidden" />
                              {row.phone}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-admin-muted">
                          {row.attendance ?? "-"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                              chipClasses[row.pay.tone],
                            )}
                          >
                            {row.pay.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <ul className="divide-y divide-[#ECE8DF] md:hidden">
                  {roster.map((row) => (
                    <li key={row.id} className="grid gap-2 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`${basePath}/elever/${row.id}`}
                          className="min-w-0 rounded font-heading text-lg font-bold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.name}
                          <span className="block font-sans text-sm font-normal text-admin-muted">
                            {row.age != null ? `${row.age} år` : "Alder mangler"}
                            {row.guardianName ? `, ${row.guardianName}` : ""}
                          </span>
                          {row.attendance ? (
                            <span className="block font-sans text-sm font-normal text-admin-muted">
                              Oppmøte: {row.attendance}
                            </span>
                          ) : null}
                        </Link>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                            chipClasses[row.pay.tone],
                          )}
                        >
                          {row.pay.label}
                        </span>
                      </div>
                      {row.phone || row.email ? (
                        <div className="flex flex-wrap gap-2">
                          {row.phone ? (
                            <a
                              href={`tel:${row.phone.replace(/\s+/g, "")}`}
                              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] px-3 text-sm font-bold text-[#277A31] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <Phone aria-hidden="true" className="size-4" />
                              Ring {row.phone}
                            </a>
                          ) : null}
                          {row.email ? (
                            <a
                              href={`mailto:${row.email}`}
                              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCD7CC] px-3 text-sm font-bold text-[#277A31] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <Mail aria-hidden="true" className="size-4" />
                              E-post
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          {daySummaries.length ? (
            <details className="group overflow-hidden rounded-2xl bg-white ring-1 ring-[#E3DED3] print:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 font-heading text-lg font-bold outline-none hover:bg-[#FBFAF6] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
                Oppmøte per skoledag
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 text-admin-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <ul className="divide-y divide-[#ECE8DF] border-t border-[#ECE8DF]">
                {daySummaries.map((day) => (
                  <li
                    key={day.id}
                    className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:px-5"
                  >
                    <span className="font-bold tabular-nums">
                      {formatOsloDate(day.date, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="text-sm text-admin-muted tabular-nums">
                      {day.unmarked === roster.length
                        ? "Ikke ført"
                        : [
                            `${day.present} til stede`,
                            day.absent ? `${day.absent} fravær` : null,
                            day.reported ? `${day.reported} meldt fravær` : null,
                            day.late ? `${day.late} sent` : null,
                            day.unmarked ? `${day.unmarked} ikke ført` : null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
